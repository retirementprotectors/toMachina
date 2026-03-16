'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import {
  WIRE_DEFINITIONS, getWireStats, computeAutomationHealth, getAutomationSummary,
  type WireDefinition, type AutomationEntry, type AutomationHealth, type AtlasSource, type AtlasTool,
} from '@tomachina/core'
import { WireDiagram } from '../components/WireDiagram'
import { fetchWithAuth } from './fetchWithAuth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceRecord extends AtlasSource {
  _id: string; source_name?: string; carrier_name?: string; product_line?: string
  product_category?: string; data_domain?: string; source_type?: string
  current_source?: string; current_method?: string; current_frequency?: string
  current_owner_email?: string; target_source?: string; target_method?: string
  target_frequency?: string; gap_status?: string; automation_pct?: number
  priority?: string; portal?: string; automation_level?: string; notes?: string
  last_pull_at?: string; next_pull_due?: string; last_updated?: string
}
interface ToolRecord extends AtlasTool { _id: string }
interface AutomationRecord extends AutomationEntry { _id: string }
interface AuditRecord {
  _id: string; action_type?: string; action?: string; source_name?: string
  user?: string; details?: string; created_at?: string; [key: string]: unknown
}

// ColumnMapping — local fallback until Builder A ships @tomachina/core types
interface ColumnMapping {
  csv_header: string
  firestore_field: string
  confidence: number
  status: 'auto' | 'suggested' | 'unmapped'
  alternatives: { field: string; confidence: number }[]
}

interface IntrospectResult {
  match_method: string
  overall_confidence: number
  mappings: ColumnMapping[]
  format_id?: string
}

interface ImportReportRow {
  category: string
  count: number
  status: 'complete' | 'in_review' | 'skipped' | 'none'
}

interface ImportResult {
  total_received: number
  auto_matched: number
  new_created: number
  updated: number
  duplicates_removed: number
  flagged: number
  skipped: number
  errors: number
}

interface RecordMatchCandidate {
  record_index: number
  incoming: Record<string, unknown>
  candidates: {
    id: string
    data: Record<string, unknown>
    score: number
    match_fields: string[]
  }[]
  status: 'unresolved' | 'matched' | 'new'
  resolved_match_id?: string
}

type Section = 'import' | 'registry' | 'operations'
type RegistrySubTab = 'sources' | 'tools'
type OpsSubTab = 'pipeline' | 'health' | 'audit'
type ImportStep = 1 | 2 | 3 | 4

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAP_STATUSES = ['All', 'GREEN', 'YELLOW', 'RED', 'GRAY'] as const
const PRIORITIES = ['All', 'HIGH', 'MEDIUM', 'LOW'] as const
const DATA_DOMAINS = ['All', 'ACCOUNTS', 'COMMISSIONS', 'DEMOGRAPHICS', 'CLAIMS', 'ENROLLMENT', 'LICENSING', 'VALIDATION', 'RATES'] as const
const PRODUCT_LINES = ['All', 'ALL', 'MAPD', 'FIA', 'MYGA', 'MED_SUPP', 'BDRIA', 'LIFE'] as const

const TOOL_CATS = [
  { key: 'INTAKE_QUEUING', label: 'Intake & Queuing', icon: 'inbox', desc: 'Scanning, filing, queueing' },
  { key: 'EXTRACTION_APPROVAL', label: 'Extraction & Approval', icon: 'document_scanner', desc: 'OCR, classification, approval' },
  { key: 'NORMALIZATION_VALIDATION', label: 'Normalization', icon: 'verified', desc: 'Normalize, validate, clean' },
  { key: 'MATCHING_DEDUP', label: 'Matching & Dedup', icon: 'compare_arrows', desc: 'Client matching, deduplication' },
  { key: 'EXTERNAL_ENRICHMENT', label: 'Enrichment', icon: 'cloud_download', desc: 'WhitePages, NeverBounce, USPS' },
  { key: 'BULK_OPERATIONS', label: 'Bulk Operations', icon: 'dynamic_feed', desc: 'Batch processing, aggregation' },
] as const

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'import', label: 'Import', icon: 'upload_file' },
  { key: 'registry', label: 'Registry', icon: 'hub' },
  { key: 'operations', label: 'Operations', icon: 'monitoring' },
]

const IMPORT_CATEGORIES = [
  { key: 'medicare', label: 'Medicare' },
  { key: 'annuity', label: 'Annuity' },
  { key: 'life', label: 'Life' },
  { key: 'bdria', label: 'BD/RIA' },
] as const

const CAT_COLORS: Record<string, string> = {
  INTAKE_QUEUING: 'rgb(245,158,11)', EXTRACTION_APPROVAL: 'rgb(124,92,255)',
  NORMALIZATION_VALIDATION: 'rgb(16,185,129)', MATCHING_DEDUP: 'rgb(59,130,246)',
  EXTERNAL_ENRICHMENT: 'rgb(168,85,247)', BULK_OPERATIONS: 'rgb(249,115,22)',
}

const API_BASE = '/api'

const STEP_LABELS = ['Upload', 'Mapping', 'Preview', 'Report'] as const

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCsv(text: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line)
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gapColor(gap?: string) {
  const g = (gap || '').toUpperCase()
  if (g === 'GREEN') return { bg: 'rgba(16,185,129,0.15)', text: 'rgb(16,185,129)', label: 'Automated' }
  if (g === 'YELLOW') return { bg: 'rgba(245,158,11,0.15)', text: 'rgb(245,158,11)', label: 'Semi-Auto' }
  if (g === 'RED') return { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)', label: 'Manual/Missing' }
  if (g === 'GRAY') return { bg: 'rgba(156,163,175,0.15)', text: 'rgb(156,163,175)', label: 'Planned' }
  return { bg: 'var(--bg-surface)', text: 'var(--text-muted)', label: gap || 'Unknown' }
}

function hColor(h?: string) {
  const s = (h || '').toUpperCase()
  if (s === 'GREEN') return { bg: 'rgba(16,185,129,0.15)', text: 'rgb(16,185,129)' }
  if (s === 'YELLOW') return { bg: 'rgba(245,158,11,0.15)', text: 'rgb(245,158,11)' }
  if (s === 'RED') return { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)' }
  return { bg: 'rgba(156,163,175,0.15)', text: 'rgb(156,163,175)' }
}

function fmtDate(d?: string) {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function fmtDateTime(d?: string) {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return d }
}

function catLabel(key: string) { return TOOL_CATS.find((c) => c.key === key)?.label || key }
function catColor(key: string) { return CAT_COLORS[key] || 'var(--text-muted)' }

function confidenceColor(confidence: number) {
  if (confidence >= 90) return { bg: 'rgba(16,185,129,0.15)', text: 'rgb(16,185,129)', label: 'Auto-mapped' }
  if (confidence >= 50) return { bg: 'rgba(245,158,11,0.15)', text: 'rgb(245,158,11)', label: 'Suggested' }
  return { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)', label: 'Unmapped' }
}

// ---------------------------------------------------------------------------
// AtlasRegistry — Main Component (3-Section Layout)
// ---------------------------------------------------------------------------

export function AtlasRegistry({ portal }: { portal?: string }) {
  const srcQ = useMemo<Query<DocumentData>>(() => query(collections.sourceRegistry()), [])
  const { data: sources, loading, error } = useCollection<SourceRecord>(srcQ, `atlas-src-${portal || 'all'}`)
  const [activeSection, setActiveSection] = useState<Section>('import')
  const [registryTab, setRegistryTab] = useState<RegistrySubTab>('sources')
  const [opsTab, setOpsTab] = useState<OpsSubTab>('pipeline')

  if (loading) return (
    <div className="mx-auto max-w-7xl">
      <Hdr sub="Loading..." />
      <div className="mt-8 flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-7xl">
      <Hdr sub="Error loading data" />
      <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <span className="material-icons-outlined text-3xl" style={{ color: 'rgb(239,68,68)' }}>error</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Failed to load ATLAS data.</p>
      </div>
    </div>
  )

  const stats = srcStats(sources)

  return (
    <div className="mx-auto max-w-7xl">
      <Hdr sub={`${stats.total} data sources tracked`} />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon="hub" label="Total Sources" val={stats.total} />
        <Stat icon="speed" label="Avg Automation" val={`${stats.avgAuto}%`} accent />
        <Stat icon="check_circle" label="GREEN" val={stats.gaps['GREEN'] || 0} color="rgb(16,185,129)" />
        <Stat icon="warning" label="YELLOW" val={stats.gaps['YELLOW'] || 0} color="rgb(245,158,11)" />
        <Stat icon="error" label="RED" val={stats.gaps['RED'] || 0} color="rgb(239,68,68)" />
      </div>
      {/* Section Pills */}
      <div className="mt-6 flex gap-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all"
            style={{ background: activeSection === s.key ? 'var(--portal)' : 'var(--bg-surface)', color: activeSection === s.key ? '#fff' : 'var(--text-muted)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {activeSection === 'import' && <ImportSection />}
        {activeSection === 'registry' && (
          <div>
            <div className="mb-4 flex gap-1">
              <button onClick={() => setRegistryTab('sources')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: registryTab === 'sources' ? 'var(--portal)' : 'var(--bg-surface)', color: registryTab === 'sources' ? '#fff' : 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>hub</span>Sources
              </button>
              <button onClick={() => setRegistryTab('tools')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: registryTab === 'tools' ? 'var(--portal)' : 'var(--bg-surface)', color: registryTab === 'tools' ? '#fff' : 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>build</span>Tools
              </button>
            </div>
            {registryTab === 'sources' && <SourcesTab sources={sources} />}
            {registryTab === 'tools' && <ToolsTab />}
          </div>
        )}
        {activeSection === 'operations' && (
          <div>
            <div className="mb-4 flex gap-1">
              <button onClick={() => setOpsTab('pipeline')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: opsTab === 'pipeline' ? 'var(--portal)' : 'var(--bg-surface)', color: opsTab === 'pipeline' ? '#fff' : 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>route</span>Pipeline
              </button>
              <button onClick={() => setOpsTab('health')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: opsTab === 'health' ? 'var(--portal)' : 'var(--bg-surface)', color: opsTab === 'health' ? '#fff' : 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>monitor_heart</span>Health
              </button>
              <button onClick={() => setOpsTab('audit')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: opsTab === 'audit' ? 'var(--portal)' : 'var(--bg-surface)', color: opsTab === 'audit' ? '#fff' : 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>history</span>Audit
              </button>
            </div>
            {opsTab === 'pipeline' && <PipelineTab />}
            {opsTab === 'health' && <HealthTab sources={sources} />}
            {opsTab === 'audit' && <AuditTab />}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Section — 4-Step Wizard
// ---------------------------------------------------------------------------

function ImportSection() {
  const [step, setStep] = useState<ImportStep>(1)

  // Step 1 state
  const [file, setFile] = useState<File | null>(null)
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [category, setCategory] = useState<string>('medicare')
  const [analyzing, setAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 state
  const [introspectResult, setIntrospectResult] = useState<IntrospectResult | null>(null)
  const [editedMappings, setEditedMappings] = useState<ColumnMapping[]>([])
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Step 3 state
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [recordMatches, setRecordMatches] = useState<RecordMatchCandidate[]>([])
  const [showMatchReview, setShowMatchReview] = useState(false)

  // Step 4 state
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  // ── File handling ──

  const handleFileRead = useCallback((f: File) => {
    setFile(f)
    setAnalyzeError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') return
      const { headers, rows } = parseCsv(text)
      setParsedHeaders(headers)
      setParsedRows(rows)
    }
    reader.readAsText(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) handleFileRead(f)
  }, [handleFileRead])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileRead(f)
  }, [handleFileRead])

  const clearFile = useCallback(() => {
    setFile(null)
    setParsedHeaders([])
    setParsedRows([])
    setAnalyzeError(null)
  }, [])

  // ── Step 1 → 2: Analyze ──

  const handleAnalyze = useCallback(async () => {
    if (!file || parsedHeaders.length === 0) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetchWithAuth(`${API_BASE}/atlas/introspect`, {
        method: 'POST',
        body: JSON.stringify({
          headers: parsedHeaders,
          sample_rows: parsedRows.slice(0, 20),
          target_category: category,
        }),
      })
      const json = await res.json() as { success: boolean; data?: IntrospectResult; error?: string }
      if (json.success && json.data) {
        setIntrospectResult(json.data)
        setEditedMappings(json.data.mappings.map(m => ({ ...m })))
        setStep(2)
      } else {
        setAnalyzeError(json.error || 'Analysis failed')
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setAnalyzing(false)
    }
  }, [file, parsedHeaders, parsedRows, category])

  // ── Step 2 → 3: Confirm Mapping ──

  const handleConfirmMapping = useCallback(async () => {
    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await fetchWithAuth(`${API_BASE}/atlas/introspect/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          format_id: introspectResult?.format_id,
          mappings: editedMappings,
          save_to_library: saveToLibrary,
          target_category: category,
        }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (json.success) {
        // Build preview from first 5 rows using mappings
        setValidating(true)
        setPreviewError(null)
        const normalizedRows = parsedRows.slice(0, 5).map(row => {
          const normalized: Record<string, unknown> = {}
          editedMappings.forEach(m => {
            if (m.firestore_field && m.status !== 'unmapped') {
              normalized[m.firestore_field] = row[m.csv_header] ?? ''
            }
          })
          return normalized
        })
        setPreviewData(normalizedRows)
        // Validate via API + fetch match candidates
        try {
          const valRes = await fetchWithAuth(`${API_BASE}/import/validate-full`, {
            method: 'POST',
            body: JSON.stringify({
              records: normalizedRows,
              import_type: category,
              dry_run: true,
            }),
          })
          const valJson = await valRes.json() as { success: boolean; errors?: string[]; warnings?: string[]; data?: { match_candidates?: RecordMatchCandidate[] } }
          setValidationErrors(valJson.errors || valJson.warnings || [])

          // If the API returns match candidates, populate for review
          if (valJson.data?.match_candidates && valJson.data.match_candidates.length > 0) {
            setRecordMatches(valJson.data.match_candidates.map(mc => ({ ...mc, status: 'unresolved' as const })))
            setShowMatchReview(true)
          } else {
            setRecordMatches([])
            setShowMatchReview(false)
          }
        } catch {
          setValidationErrors(['Could not reach validation endpoint — preview shown without validation'])
          setRecordMatches([])
          setShowMatchReview(false)
        }
        setValidating(false)
        setStep(3)
      } else {
        setConfirmError(json.error || 'Confirmation failed')
      }
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setConfirming(false)
    }
  }, [introspectResult, editedMappings, saveToLibrary, category, parsedRows])

  // ── Step 3 → 4: Execute Import ──

  const handleImport = useCallback(async () => {
    setImporting(true)
    setImportError(null)
    try {
      // Normalize all rows using confirmed mappings
      const allNormalized = parsedRows.map(row => {
        const normalized: Record<string, unknown> = {}
        editedMappings.forEach(m => {
          if (m.firestore_field && m.status !== 'unmapped') {
            normalized[m.firestore_field] = row[m.csv_header] ?? ''
          }
        })
        return normalized
      })
      const res = await fetchWithAuth(`${API_BASE}/import/batch`, {
        method: 'POST',
        body: JSON.stringify({
          records: allNormalized,
          import_type: category,
          format_id: introspectResult?.format_id,
        }),
      })
      const json = await res.json() as { success: boolean; data?: ImportResult; error?: string }
      if (json.success && json.data) {
        setImportResult(json.data)
        setStep(4)
      } else {
        setImportError(json.error || 'Import failed')
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setImporting(false)
    }
  }, [parsedRows, editedMappings, category, introspectResult])

  // ── Reset to Step 1 ──

  const handleReset = useCallback(() => {
    setStep(1)
    setFile(null)
    setParsedHeaders([])
    setParsedRows([])
    setCategory('medicare')
    setAnalyzeError(null)
    setIntrospectResult(null)
    setEditedMappings([])
    setSaveToLibrary(true)
    setConfirmError(null)
    setPreviewData(null)
    setValidationErrors([])
    setPreviewError(null)
    setRecordMatches([])
    setShowMatchReview(false)
    setImportResult(null)
    setImportError(null)
  }, [])

  // ── Update a mapping's firestore_field ──

  const updateMappingField = useCallback((idx: number, newField: string) => {
    setEditedMappings(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], firestore_field: newField, status: newField ? 'suggested' : 'unmapped', confidence: newField ? Math.max(next[idx].confidence, 50) : 0 }
      return next
    })
  }, [])

  // ── Resolve a record match ──

  const resolveMatch = useCallback((recordIndex: number, action: 'matched' | 'new' | 'unresolved', matchId?: string) => {
    setRecordMatches(prev => prev.map(rm =>
      rm.record_index === recordIndex
        ? { ...rm, status: action, resolved_match_id: action === 'unresolved' ? undefined : matchId }
        : rm
    ))
  }, [])

  const unresolvedCount = useMemo(() => recordMatches.filter(rm => rm.status === 'unresolved').length, [recordMatches])

  // ── Get sample values for a header ──

  const getSamples = useCallback((header: string) => {
    return parsedRows.slice(0, 3).map(r => String(r[header] ?? '')).filter(Boolean)
  }, [parsedRows])

  // ── Build ledger rows from import result ──

  const buildLedgerRows = useCallback((): ImportReportRow[] => {
    if (!importResult) return []
    const r = importResult
    const total = r.total_received
    const outputSum = r.auto_matched + r.new_created + r.duplicates_removed + r.flagged + r.skipped + r.errors
    return [
      { category: 'Total Received', count: total, status: 'none' },
      { category: 'Auto-Matched', count: r.auto_matched, status: 'complete' },
      { category: 'New Created', count: r.new_created, status: 'complete' },
      { category: 'Updated', count: r.updated, status: 'complete' },
      { category: 'Duplicates Removed', count: r.duplicates_removed, status: 'complete' },
      { category: 'Flagged', count: r.flagged, status: r.flagged > 0 ? 'in_review' : 'none' },
      { category: 'Skipped', count: r.skipped, status: r.skipped > 0 ? 'skipped' : 'none' },
      { category: 'Errors', count: r.errors, status: 'none' },
      { category: 'Input = Output', count: outputSum, status: total === outputSum ? 'complete' : 'none' },
    ]
  }, [importResult])

  return (
    <div>
      {/* Step Progress Indicator */}
      <div className="mb-6 flex items-center gap-2">
        {([1, 2, 3, 4] as const).map((s) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: step >= s ? 'var(--portal)' : 'var(--bg-surface)',
                  color: step >= s ? '#fff' : 'var(--text-muted)',
                }}
              >
                {step > s ? <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span> : s}
              </div>
              <span className="text-[10px] font-medium text-[var(--text-muted)]">{STEP_LABELS[s - 1]}</span>
            </div>
            {s < 4 && (
              <div className="mb-4 h-0.5 flex-1" style={{ background: step > s ? 'var(--portal)' : 'var(--bg-surface)' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: Drop Zone ── */}
      {step === 1 && (
        <div>
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors"
              style={{
                borderColor: dragOver ? 'var(--portal)' : 'var(--border-subtle)',
                background: dragOver ? 'rgba(var(--portal-rgb), 0.05)' : 'var(--bg-card)',
              }}
            >
              <span className="material-icons-outlined text-4xl" style={{ color: 'var(--portal)' }}>upload_file</span>
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">Drop a CSV file here or click to browse</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Supports .csv files from any carrier or data source</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            </div>
          ) : (
            <div>
              {/* File Info Card */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined" style={{ color: 'var(--portal)' }}>description</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{file.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{parsedHeaders.length} columns, {parsedRows.length.toLocaleString()} rows</p>
                    </div>
                  </div>
                  <button onClick={clearFile}>
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              </div>

              {/* Category Selector */}
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                  >
                    {IMPORT_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || parsedHeaders.length === 0}
                  className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'var(--portal)' }}
                >
                  {analyzing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Analyzing {file.name}...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>
                      Analyze
                    </>
                  )}
                </button>
              </div>

              {analyzeError && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{analyzeError}</p>
                </div>
              )}

              {/* Column Preview */}
              {parsedHeaders.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Detected Columns</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedHeaders.map((h) => (
                      <span key={h} className="rounded bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-secondary)]">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Mapping Review ── */}
      {step === 2 && introspectResult && (
        <div>
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge text={introspectResult.match_method} bg="rgba(59,130,246,0.15)" fg="rgb(59,130,246)" />
              <Badge
                text={`${introspectResult.overall_confidence}% confidence`}
                bg={confidenceColor(introspectResult.overall_confidence).bg}
                fg={confidenceColor(introspectResult.overall_confidence).text}
              />
              <span className="text-xs text-[var(--text-muted)]">{editedMappings.length} columns</span>
            </div>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-all hover:bg-[var(--bg-surface)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_back</span>Back
            </button>
          </div>

          {/* Mapping Table */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
                  <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-3">CSV Column</th>
                    <th className="px-3 py-3">Firestore Field</th>
                    <th className="px-3 py-3">Confidence</th>
                    <th className="px-3 py-3">Sample Values</th>
                  </tr>
                </thead>
                <tbody>
                  {editedMappings.map((m, idx) => {
                    const cc = confidenceColor(m.confidence)
                    return (
                      <tr key={m.csv_header} className="border-b border-[var(--border-subtle)]">
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{m.csv_header}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={m.firestore_field}
                            onChange={(e) => updateMappingField(idx, e.target.value)}
                            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                            style={{ maxWidth: '200px' }}
                          />
                          {m.alternatives.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {m.alternatives.slice(0, 3).map((alt) => (
                                <button
                                  key={alt.field}
                                  onClick={() => updateMappingField(idx, alt.field)}
                                  className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                                >
                                  {alt.field} ({alt.confidence}%)
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge text={cc.label} bg={cc.bg} fg={cc.text} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {getSamples(m.csv_header).map((val, vi) => (
                              <span key={vi} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                                {String(val).slice(0, 30)}{String(val).length > 30 ? '...' : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
                className="rounded"
              />
              Save to format library
            </label>
            <button
              onClick={handleConfirmMapping}
              disabled={confirming}
              className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--portal)' }}
            >
              {confirming ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Confirming...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  Confirm Mapping
                </>
              )}
            </button>
          </div>

          {confirmError && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{confirmError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Record Preview ── */}
      {step === 3 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Record Preview</h3>
              <p className="text-xs text-[var(--text-muted)]">First {previewData?.length || 0} records after mapping normalization</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-all hover:bg-[var(--bg-surface)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_back</span>Back
            </button>
          </div>

          {validating ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              <span className="ml-3 text-sm text-[var(--text-muted)]">Validating records...</span>
            </div>
          ) : previewData && previewData.length > 0 ? (
            <div>
              {/* Validation warnings/errors */}
              {validationErrors.length > 0 && (
                <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <span className="material-icons-outlined shrink-0" style={{ fontSize: '18px', color: 'rgb(245,158,11)' }}>warning</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-400">Validation Notes</p>
                      <ul className="mt-1 space-y-0.5">
                        {validationErrors.map((err, i) => (
                          <li key={i} className="text-xs text-yellow-300">{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Record Match Review (TRK-182) — DeDup-style side-by-side */}
              {showMatchReview && recordMatches.length > 0 && (
                <div className="mb-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'rgb(245,158,11)' }}>compare_arrows</span>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">Record Matching Review</h4>
                      {unresolvedCount > 0 && (
                        <span className="rounded-full bg-[rgba(245,158,11,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(245,158,11)]">
                          {unresolvedCount} unresolved
                        </span>
                      )}
                      {unresolvedCount === 0 && (
                        <span className="rounded-full bg-[rgba(16,185,129,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(16,185,129)]">
                          All resolved
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowMatchReview(false)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {unresolvedCount === 0 ? 'Hide' : 'Collapse'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {recordMatches.map((rm) => (
                      <RecordMatchCard
                        key={rm.record_index}
                        match={rm}
                        onResolve={resolveMatch}
                        mappedFields={editedMappings.filter(m => m.status !== 'unmapped').map(m => m.firestore_field)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        <th className="px-4 py-3">#</th>
                        {Object.keys(previewData[0]).slice(0, 8).map((k) => (
                          <th key={k} className="px-3 py-3">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, ri) => (
                        <tr key={ri} className="border-b border-[var(--border-subtle)]">
                          <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{ri + 1}</td>
                          {Object.keys(row).slice(0, 8).map((k) => (
                            <td key={k} className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                              {String(row[k] ?? '').slice(0, 40)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Action */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-[var(--text-muted)]">
                  {parsedRows.length.toLocaleString()} total records will be imported as <span className="font-semibold text-[var(--text-primary)]">{category}</span>
                  {unresolvedCount > 0 && (
                    <span className="ml-2 text-[rgb(245,158,11)]">({unresolvedCount} records need matching review)</span>
                  )}
                </p>
                <button
                  onClick={handleImport}
                  disabled={importing || unresolvedCount > 0}
                  className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'var(--portal)' }}
                >
                  {importing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>cloud_upload</span>
                      Import {parsedRows.length.toLocaleString()} Records
                    </>
                  )}
                </button>
              </div>

              {importError && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{importError}</p>
                </div>
              )}
            </div>
          ) : (
            <Empty icon="preview" title="No Preview Data" desc="Could not generate preview records." />
          )}

          {previewError && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{previewError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Import Report ── */}
      {step === 4 && importResult && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="material-icons-outlined text-2xl" style={{ color: 'rgb(16,185,129)' }}>check_circle</span>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Import Complete</h3>
              <p className="text-xs text-[var(--text-muted)]">{file?.name} &mdash; {category} category</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-3 py-3 text-right">Count</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {buildLedgerRows().map((row, i) => {
                  const isBalance = row.category === 'Input = Output'
                  const balanced = isBalance && importResult.total_received === row.count
                  return (
                    <tr
                      key={i}
                      className="border-b border-[var(--border-subtle)]"
                      style={isBalance ? { background: balanced ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' } : undefined}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`text-sm ${isBalance ? 'font-bold' : 'font-medium'} text-[var(--text-primary)]`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-sm ${isBalance ? 'font-bold' : ''} text-[var(--text-primary)]`}>
                          {row.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.status === 'complete' && (
                          <span className="inline-flex items-center gap-1 text-xs text-[rgb(16,185,129)]">
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check_circle</span>Complete
                          </span>
                        )}
                        {row.status === 'in_review' && (
                          <span className="inline-flex items-center gap-1 text-xs text-[rgb(245,158,11)]">
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>pending</span>In Review
                          </span>
                        )}
                        {row.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>skip_next</span>Skipped
                          </span>
                        )}
                        {row.status === 'none' && isBalance && balanced && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[rgb(16,185,129)]">
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>verified</span>Balanced
                          </span>
                        )}
                        {row.status === 'none' && isBalance && !balanced && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[rgb(239,68,68)]">
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>error</span>Mismatch
                          </span>
                        )}
                        {row.status === 'none' && !isBalance && (
                          <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Import Another */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all hover:bg-[var(--bg-surface)]"
              style={{ color: 'var(--portal)', border: '1px solid var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Record Match Card — DeDup-style side-by-side (TRK-182)
// ---------------------------------------------------------------------------

function RecordMatchCard({ match, onResolve, mappedFields }: {
  match: RecordMatchCandidate
  onResolve: (recordIndex: number, action: 'matched' | 'new' | 'unresolved', matchId?: string) => void
  mappedFields: string[]
}) {
  const [expanded, setExpanded] = useState(match.status === 'unresolved')
  const displayFields = mappedFields.slice(0, 6) // Show up to 6 key fields

  const statusStyle = match.status === 'unresolved'
    ? { border: '1px solid rgb(245,158,11)', bg: 'rgba(245,158,11,0.04)' }
    : match.status === 'matched'
      ? { border: '1px solid rgb(16,185,129)', bg: 'rgba(16,185,129,0.04)' }
      : { border: '1px solid rgb(59,130,246)', bg: 'rgba(59,130,246,0.04)' }

  return (
    <div className="rounded-xl p-4" style={{ border: statusStyle.border, background: statusStyle.bg }}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined" style={{
            fontSize: '18px',
            color: match.status === 'unresolved' ? 'rgb(245,158,11)' : match.status === 'matched' ? 'rgb(16,185,129)' : 'rgb(59,130,246)',
          }}>
            {match.status === 'unresolved' ? 'help_outline' : match.status === 'matched' ? 'link' : 'person_add'}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Record #{match.record_index + 1}
          </span>
          {match.status === 'unresolved' && (
            <Badge text={`${match.candidates.length} candidate${match.candidates.length !== 1 ? 's' : ''}`} bg="rgba(245,158,11,0.15)" fg="rgb(245,158,11)" />
          )}
          {match.status === 'matched' && (
            <Badge text="Matched" bg="rgba(16,185,129,0.15)" fg="rgb(16,185,129)" />
          )}
          {match.status === 'new' && (
            <Badge text="New Record" bg="rgba(59,130,246,0.15)" fg="rgb(59,130,246)" />
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {/* Expanded side-by-side comparison */}
      {expanded && (
        <div className="mt-3">
          {/* Incoming record summary */}
          <div className="mb-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--portal)]">Incoming Record</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {displayFields.map(field => (
                <div key={field}>
                  <span className="text-[10px] text-[var(--text-muted)]">{field}</span>
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                    {String(match.incoming[field] ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate matches */}
          {match.candidates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Existing Records ({match.candidates.length})
              </p>
              {match.candidates.map((cand) => {
                const isSelected = match.resolved_match_id === cand.id
                const scoreColor = cand.score >= 90 ? 'rgb(16,185,129)' : cand.score >= 70 ? 'rgb(245,158,11)' : 'rgb(239,68,68)'
                return (
                  <div
                    key={cand.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-all"
                    style={{
                      borderColor: isSelected ? 'rgb(16,185,129)' : 'var(--border-subtle)',
                      background: isSelected ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                        {displayFields.map(field => {
                          const incoming = String(match.incoming[field] ?? '')
                          const existing = String(cand.data[field] ?? '')
                          const isMatch = incoming.toLowerCase() === existing.toLowerCase() && incoming !== ''
                          return (
                            <div key={field}>
                              <span className="text-[10px] text-[var(--text-muted)]">{field}</span>
                              <p className="truncate text-xs font-medium" style={{
                                color: isMatch ? 'rgb(16,185,129)' : existing ? 'var(--text-primary)' : 'var(--text-muted)',
                              }}>
                                {existing || '—'}
                                {isMatch && <span className="ml-1 text-[10px]">✓</span>}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                      {/* Match details */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{
                          background: `${scoreColor}15`, color: scoreColor,
                        }}>
                          {cand.score}% match
                        </span>
                        {cand.match_fields.map(mf => (
                          <span key={mf} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                            {mf}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Pick this match button */}
                    {match.status === 'unresolved' && (
                      <button
                        onClick={() => onResolve(match.record_index, 'matched', cand.id)}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ background: 'rgb(16,185,129)' }}
                      >
                        Match
                      </button>
                    )}
                    {isSelected && (
                      <span className="material-icons-outlined shrink-0" style={{ fontSize: '20px', color: 'rgb(16,185,129)' }}>
                        check_circle
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Action buttons */}
          {match.status === 'unresolved' && (
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <p className="text-xs text-[var(--text-muted)]">No match? This record will be created as new.</p>
              <button
                onClick={() => onResolve(match.record_index, 'new')}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={{ color: 'rgb(59,130,246)', border: '1px solid rgb(59,130,246)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person_add</span>
                Create New
              </button>
            </div>
          )}

          {/* Undo */}
          {match.status !== 'unresolved' && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => onResolve(match.record_index, 'unresolved')}
                className="text-xs text-[var(--text-muted)] underline hover:text-[var(--text-primary)]"
              >
                Undo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Primitives
// ---------------------------------------------------------------------------

function Hdr({ sub }: { sub: string }) {
  return (<div>
    <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS</h1>
    <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system &mdash; {sub}</p>
  </div>)
}

function Stat({ icon, label, val, accent, color }: { icon: string; label: string; val: number | string; accent?: boolean; color?: string }) {
  const c = color || (accent ? 'var(--portal)' : 'var(--text-primary)')
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: c }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold" style={{ color: c }}>{typeof val === 'number' ? val.toLocaleString() : val}</p>
    </div>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full px-3 py-1 text-xs font-medium transition-all"
      style={{ background: active ? 'var(--portal)' : 'var(--bg-surface)', color: active ? '#fff' : 'var(--text-muted)', border: active ? 'none' : '1px solid var(--border-subtle)' }}>
      {label}
    </button>
  )
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '16px' }}>search</span>
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
        style={{ minWidth: '200px' }} />
    </div>
  )
}

function Empty({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
      <span className="material-icons-outlined text-5xl" style={{ color: 'var(--portal)' }}>{icon}</span>
      <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{desc}</p>
    </div>
  )
}

function DField({ label, value }: { label: string; value: string }) {
  return (<div>
    <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{value || '-'}</p>
  </div>)
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: bg, color: fg }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: fg }} />{text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function srcStats(sources: SourceRecord[]) {
  let totalAuto = 0, autoCount = 0
  const gaps: Record<string, number> = {}
  for (const s of sources) {
    const g = (s.gap_status || '').toUpperCase()
    if (g) gaps[g] = (gaps[g] || 0) + 1
    if (s.automation_pct != null) { totalAuto += s.automation_pct; autoCount++ }
  }
  return { total: sources.length, avgAuto: autoCount > 0 ? Math.round(totalAuto / autoCount) : 0, gaps }
}

// ---------------------------------------------------------------------------
// Tab 1: Sources
// ---------------------------------------------------------------------------

function SourcesTab({ sources }: { sources: SourceRecord[] }) {
  const [gapF, setGapF] = useState('All')
  const [domF, setDomF] = useState('All')
  const [prodF, setProdF] = useState('All')
  const [priF, setPriF] = useState('All')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<SourceRecord | null>(null)

  const filtered = useMemo(() => sources.filter((s) => {
    if (gapF !== 'All' && (s.gap_status || '').toUpperCase() !== gapF) return false
    if (domF !== 'All' && (s.data_domain || '').toUpperCase() !== domF) return false
    if (prodF !== 'All' && (s.product_line || '').toUpperCase() !== prodF) return false
    if (priF !== 'All' && (s.priority || '').toUpperCase() !== priF) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(s.name || s.source_name || '').toLowerCase().includes(q) && !(s.carrier_name || '').toLowerCase().includes(q)) return false
    }
    return true
  }), [sources, gapF, domF, prodF, priF, search])

  if (sources.length === 0) return <Empty icon="hub" title="Source Registry Ready" desc="Seed ATLAS to populate. Carrier integrations, data feeds, and manual processes will appear here." />

  return (
    <div className="flex gap-4">
      <div className={sel ? 'flex-1 min-w-0' : 'w-full'}>
        <div className="flex flex-wrap items-center gap-2">
          <Search value={search} onChange={setSearch} placeholder="Search carrier or source..." />
          <div className="flex flex-wrap gap-1">
            {GAP_STATUSES.map((g) => <Pill key={g} label={g === 'All' ? 'All Status' : g} active={gapF === g} onClick={() => setGapF(g)} />)}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {DATA_DOMAINS.slice(0, 6).map((d) => <Pill key={d} label={d === 'All' ? 'All Domains' : d} active={domF === d} onClick={() => setDomF(d)} />)}
          {PRODUCT_LINES.slice(0, 5).map((p) => <Pill key={p} label={p === 'All' ? 'All Products' : p} active={prodF === p} onClick={() => setProdF(p)} />)}
          {PRIORITIES.map((p) => <Pill key={`p-${p}`} label={p === 'All' ? 'All Priority' : p} active={priF === p} onClick={() => setPriF(p)} />)}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">{filtered.length} of {sources.length} sources</p>

        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
                <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-4 py-3">Carrier / Source</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Domain</th>
                  <th className="px-3 py-3">Gap</th>
                  <th className="px-3 py-3">Automation</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-[var(--text-muted)]">No sources match filters.</td></tr>
                ) : filtered.map((s) => {
                  const gc = gapColor(s.gap_status)
                  return (
                    <tr key={s._id} onClick={() => setSel(sel?._id === s._id ? null : s)}
                      className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]"
                      style={sel?._id === s._id ? { background: 'var(--bg-surface)' } : undefined}>
                      <td className="px-4 py-2.5">
                        <p className="truncate font-medium text-[var(--text-primary)]" style={{ maxWidth: '200px' }}>{s.carrier_name || s.name || s.source_name || s._id}</p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]" style={{ maxWidth: '200px' }}>{s.name || s.source_name || ''}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{s.product_line || '-'}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{s.data_domain || '-'}</td>
                      <td className="px-3 py-2.5"><Badge text={s.gap_status || '-'} bg={gc.bg} fg={gc.text} /></td>
                      <td className="px-3 py-2.5">
                        {s.automation_pct != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(s.automation_pct, 100)}%`, background: s.automation_pct >= 75 ? 'rgb(16,185,129)' : s.automation_pct >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' }} />
                            </div>
                            <span className="text-[11px] text-[var(--text-muted)]">{s.automation_pct}%</span>
                          </div>
                        ) : <span className="text-[11px] text-[var(--text-muted)]">{s.automation_level || '-'}</span>}
                      </td>
                      <td className="px-3 py-2.5"><span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{s.current_method || s.type || '-'}</span></td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{s.current_frequency || s.frequency || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sel && (
        <div className="w-80 shrink-0 rounded-xl border border-[var(--portal)] bg-[var(--bg-card)] p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{sel.name || sel.source_name || sel._id}</h3>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{sel.carrier_name}</p>
            </div>
            <button onClick={() => setSel(null)} className="ml-2 shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <DField label="Product Line" value={sel.product_line || ''} />
            <DField label="Data Domain" value={sel.data_domain || ''} />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Gap Status</p>
              <Badge text={gapColor(sel.gap_status).label} bg={gapColor(sel.gap_status).bg} fg={gapColor(sel.gap_status).text} />
            </div>
            <DField label="Automation" value={sel.automation_pct != null ? `${sel.automation_pct}%` : (sel.automation_level || '')} />
            <DField label="Current Method" value={sel.current_method || sel.type || ''} />
            <DField label="Target Method" value={sel.target_method || ''} />
            <DField label="Frequency" value={sel.current_frequency || sel.frequency || ''} />
            <DField label="Target Frequency" value={sel.target_frequency || ''} />
            <DField label="Priority" value={sel.priority || ''} />
            <DField label="Owner" value={sel.current_owner_email || ''} />
            <DField label="Last Pull" value={fmtDate(sel.last_pull_at || sel.last_pull)} />
            <DField label="Next Due" value={fmtDate(sel.next_pull_due)} />
            <DField label="Portal" value={sel.portal || ''} />
            {sel.description && <DField label="Description" value={sel.description} />}
            {sel.notes && <DField label="Notes" value={sel.notes} />}
          </div>
          <p className="mt-4 text-[10px] text-[var(--text-muted)]">Created {fmtDate(sel.created_at)} &middot; Updated {fmtDate(sel.updated_at || sel.last_updated)}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Tools
// ---------------------------------------------------------------------------

function ToolsTab() {
  const [tools] = useState<ToolRecord[]>([]) // tool_registry — empty until seeded
  const [catF, setCatF] = useState('All')
  const [typeF, setTypeF] = useState('All')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<ToolRecord | null>(null)

  const toolTypes = useMemo(() => { const s = new Set<string>(); tools.forEach((t) => { if (t.tool_type) s.add(t.tool_type) }); return ['All', ...Array.from(s).sort()] }, [tools])
  const filtered = useMemo(() => tools.filter((t) => {
    if (catF !== 'All' && t.category !== catF) return false
    if (typeF !== 'All' && t.tool_type !== typeF) return false
    if (search && !(t.tool_name || '').toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [tools, catF, typeF, search])

  const catCounts = useMemo(() => { const c: Record<string, number> = {}; TOOL_CATS.forEach((x) => { c[x.key] = 0 }); tools.forEach((t) => { if (c[t.category] !== undefined) c[t.category]++ }); return c }, [tools])

  if (tools.length === 0) return (
    <div>
      <Empty icon="build" title="Tool Registry" desc="Seed ATLAS to populate the tool registry. 150+ tools across 6 pipeline categories will appear here." />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOL_CATS.map((cat) => (
          <div key={cat.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${catColor(cat.key)}15` }}>
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: catColor(cat.key) }}>{cat.icon}</span>
              </span>
              <div><p className="text-sm font-semibold text-[var(--text-primary)]">{cat.label}</p><p className="text-xs text-[var(--text-muted)]">{cat.desc}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex gap-4">
      <div className={sel ? 'flex-1 min-w-0' : 'w-full'}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TOOL_CATS.map((cat) => (
            <button key={cat.key} onClick={() => setCatF(catF === cat.key ? 'All' : cat.key)}
              className="rounded-lg border p-3 text-left transition-all"
              style={{ borderColor: catF === cat.key ? catColor(cat.key) : 'var(--border-subtle)', background: catF === cat.key ? `${catColor(cat.key)}10` : 'var(--bg-card)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px', color: catColor(cat.key) }}>{cat.icon}</span>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{cat.label}</p>
              <p className="text-lg font-bold" style={{ color: catColor(cat.key) }}>{catCounts[cat.key]}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Search value={search} onChange={setSearch} placeholder="Search tools..." />
          {toolTypes.map((t) => <Pill key={t} label={t === 'All' ? 'All Types' : t} active={typeF === t} onClick={() => setTypeF(t)} />)}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">{filtered.length} tools</p>
        <div className="mt-3 space-y-2">
          {filtered.map((t) => (
            <button key={t._id} onClick={() => setSel(sel?._id === t._id ? null : t)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-[var(--bg-surface)]"
              style={{ borderColor: sel?._id === t._id ? 'var(--portal)' : 'var(--border-subtle)', background: sel?._id === t._id ? 'var(--bg-surface)' : 'var(--bg-card)' }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${catColor(t.category)}15` }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: catColor(t.category) }}>{TOOL_CATS.find((c) => c.key === t.category)?.icon || 'extension'}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{t.tool_name}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${catColor(t.category)}20`, color: catColor(t.category) }}>{catLabel(t.category)}</span>
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{t.tool_type}</span>
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{t.source_project}</span>
                </div>
              </div>
              {t.runnable && <span className="material-icons-outlined shrink-0" style={{ fontSize: '16px', color: 'rgb(16,185,129)' }}>play_circle</span>}
            </button>
          ))}
        </div>
      </div>
      {sel && (
        <div className="w-80 shrink-0 rounded-xl border border-[var(--portal)] bg-[var(--bg-card)] p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{sel.tool_name}</h3>
            <button onClick={() => setSel(null)} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span></button>
          </div>
          <div className="mt-4 space-y-3">
            <DField label="Category" value={catLabel(sel.category)} />
            <DField label="Tool Type" value={sel.tool_type} />
            <DField label="Source Project" value={sel.source_project} />
            <DField label="Source File" value={sel.source_file} />
            <DField label="Run Target" value={sel.run_target} />
            <DField label="Product Lines" value={sel.product_lines} />
            <DField label="Data Domains" value={sel.data_domains} />
            <DField label="Used By" value={sel.used_by_frontend} />
            <DField label="Status" value={sel.status} />
            <DField label="Runnable" value={sel.runnable ? 'Yes' : 'No'} />
            {sel.description && <DField label="Description" value={sel.description} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3: Pipeline
// ---------------------------------------------------------------------------

function PipelineTab() {
  const ws = useMemo(() => getWireStats(), [])
  const products = useMemo(() => { const s = new Set<string>(); WIRE_DEFINITIONS.forEach((w) => s.add(w.product_line)); return ['All', ...Array.from(s).sort()] }, [])
  const [wireId, setWireId] = useState('__all__')
  const [prodF, setProdF] = useState('All')

  const visible = useMemo(() => {
    let w = WIRE_DEFINITIONS as WireDefinition[]
    if (prodF !== 'All') w = w.filter((x) => x.product_line === prodF || x.product_line === 'ALL')
    if (wireId !== '__all__') w = w.filter((x) => x.wire_id === wireId)
    return w
  }, [wireId, prodF])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="route" label="Total Wires" val={ws.totalWires} accent />
        <Stat icon="account_tree" label="Total Stages" val={ws.totalStages} />
        <Stat icon="cloud" label="External" val={ws.stageTypes['EXTERNAL'] || 0} color="rgb(168,85,247)" />
        <Stat icon="api" label="API Endpoints" val={ws.stageTypes['API_ENDPOINT'] || 0} color="rgb(59,130,246)" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(ws.stageTypes).sort(([, a], [, b]) => b - a).map(([type, count]) => (
          <span key={type} className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            {type}: <span className="font-semibold text-[var(--text-primary)]">{count}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select value={wireId} onChange={(e) => setWireId(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
          <option value="__all__">All Wires ({WIRE_DEFINITIONS.length})</option>
          {WIRE_DEFINITIONS.map((w) => <option key={w.wire_id} value={w.wire_id}>{w.name}</option>)}
        </select>
        {products.map((p) => <Pill key={p} label={p === 'All' ? 'All Products' : p} active={prodF === p} onClick={() => setProdF(p)} />)}
      </div>
      <div className="mt-4 space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No wires match the selected filters.</p>
          </div>
        ) : visible.map((wire) => <WireDiagram key={wire.wire_id} wire={wire} />)}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4: Health
// ---------------------------------------------------------------------------

function HealthTab({ sources }: { sources: SourceRecord[] }) {
  const [automations] = useState<AutomationRecord[]>([]) // automation_registry — empty until seeded
  const healthResults = useMemo<AutomationHealth[]>(() => { const now = Date.now(); return automations.map((a) => computeAutomationHealth(a, now)) }, [automations])
  const summary = useMemo(() => getAutomationSummary(automations), [automations])

  const staleSources = useMemo(() => {
    const now = Date.now()
    return sources.filter((s) => {
      const lp = s.last_pull_at || s.last_pull
      if (!lp) return (s.gap_status || '').toUpperCase() !== 'GRAY'
      const ms = new Date(lp).getTime()
      if (isNaN(ms)) return true
      const freq = s.current_frequency || s.frequency || 'NONE'
      const exp = freq === 'DAILY' ? 25 : freq === 'WEEKLY' ? 170 : freq === 'MONTHLY' ? 750 : 8760
      return (now - ms) / 3600000 > exp * 2
    })
  }, [sources])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="monitor_heart" label="Overall Health" val={`${summary.healthPct}%`} accent />
        <Stat icon="check_circle" label="Green" val={summary.green} color="rgb(16,185,129)" />
        <Stat icon="warning" label="Yellow" val={summary.yellow} color="rgb(245,158,11)" />
        <Stat icon="error" label="Red" val={summary.red} color="rgb(239,68,68)" />
      </div>

      {automations.length === 0 ? (
        <div className="mt-4"><Empty icon="monitor_heart" title="Automation Health" desc="Seed the automation_registry collection to track launchd agents, GAS triggers, and cloud functions." /></div>
      ) : (
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
                <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-4 py-3">Automation</th><th className="px-3 py-3">Schedule</th><th className="px-3 py-3">Last Run</th><th className="px-3 py-3">Health</th><th className="px-3 py-3">Elapsed / Expected</th>
                </tr>
              </thead>
              <tbody>
                {healthResults.map((h) => {
                  const hc = hColor(h.health); const entry = automations.find((a) => a.automation_id === h.automation_id)
                  return (
                    <tr key={h.automation_id} className="border-b border-[var(--border-subtle)]">
                      <td className="px-4 py-2.5"><p className="font-medium text-[var(--text-primary)]">{h.automation_name}</p>{entry && <p className="text-[11px] text-[var(--text-muted)]">{entry.automation_type}</p>}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{entry?.schedule || '-'}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{fmtDateTime(h.last_run_at)}</td>
                      <td className="px-3 py-2.5"><Badge text={h.health} bg={hc.bg} fg={hc.text} /></td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{h.elapsed_hours}h / {h.expected_hours}h</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'rgb(245,158,11)' }}>schedule</span>
          Stale Source Detection
          <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{staleSources.length} stale</span>
        </h3>
        {staleSources.length === 0 ? (
          <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-center">
            <span className="material-icons-outlined text-2xl" style={{ color: 'rgb(16,185,129)' }}>verified</span>
            <p className="mt-1 text-sm text-[var(--text-muted)]">All sources are within expected pull intervals.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {staleSources.slice(0, 20).map((s) => (
              <div key={s._id} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                <span className="material-icons-outlined shrink-0" style={{ fontSize: '18px', color: 'rgb(245,158,11)' }}>warning</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{s.carrier_name || s.name || s._id}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Last pull: {fmtDate(s.last_pull_at || s.last_pull)} &middot; Expected: {s.current_frequency || s.frequency || 'Unknown'}</p>
                </div>
                <Badge text={s.gap_status || '-'} bg={gapColor(s.gap_status).bg} fg={gapColor(s.gap_status).text} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 5: Audit
// ---------------------------------------------------------------------------

function AuditTab() {
  const [audits] = useState<AuditRecord[]>([]) // atlas_audit — empty until seeded
  const [actionF, setActionF] = useState('All')
  const actionTypes = useMemo(() => { const s = new Set<string>(); audits.forEach((a) => { if (a.action_type) s.add(a.action_type) }); return ['All', ...Array.from(s).sort()] }, [audits])
  const filtered = useMemo(() => actionF === 'All' ? audits : audits.filter((a) => a.action_type === actionF), [audits, actionF])

  if (audits.length === 0) return <Empty icon="history" title="Audit Trail" desc="ATLAS audit events will appear here as sources are created, updated, and pipelines run. Seed atlas_audit to populate." />

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {actionTypes.map((t) => <Pill key={t} label={t === 'All' ? 'All Actions' : t} active={actionF === t} onClick={() => setActionF(t)} />)}
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{filtered.length} events</p>
      <div className="mt-4 space-y-1">
        {filtered.map((a) => {
          const ic = auditIcon(a.action_type), icC = auditColor(a.action_type)
          return (
            <div key={a._id} className="flex gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: icC.replace('rgb(', 'rgba(').replace(')', ',0.12)'), color: icC }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{ic}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{a.action || a.action_type || 'Unknown'}</span>
                  {a.action_type && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{a.action_type}</span>}
                </div>
                {a.source_name && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{a.source_name}</p>}
                {a.details && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{a.details}</p>}
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">{a.user || 'system'} &middot; {fmtDateTime(a.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function auditIcon(t?: string) {
  const s = (t || '').toLowerCase()
  if (s.includes('create') || s.includes('add')) return 'add_circle'
  if (s.includes('update') || s.includes('edit')) return 'edit'
  if (s.includes('delete') || s.includes('remove')) return 'delete'
  if (s.includes('import') || s.includes('seed')) return 'cloud_upload'
  if (s.includes('run') || s.includes('execute')) return 'play_circle'
  return 'info'
}

function auditColor(t?: string) {
  const s = (t || '').toLowerCase()
  if (s.includes('create') || s.includes('add')) return 'rgb(16,185,129)'
  if (s.includes('update') || s.includes('edit')) return 'rgb(59,130,246)'
  if (s.includes('delete') || s.includes('remove')) return 'rgb(239,68,68)'
  if (s.includes('import') || s.includes('seed')) return 'rgb(168,85,247)'
  if (s.includes('run') || s.includes('execute')) return 'rgb(245,158,11)'
  return 'rgb(148,163,184)'
}
