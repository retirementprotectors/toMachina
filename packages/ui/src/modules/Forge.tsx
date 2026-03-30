'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchValidated } from './fetchValidated'
import { fetchWithAuth } from './fetchWithAuth' // HTML endpoint (roadmap) — not JSON, can't use fetchValidated
import { KanbanBoard, type KanbanColumn, type KanbanCard } from '../components/KanbanBoard'
import { useToast } from '../components/Toast'

/* ─── Types ─── */
interface Attachment {
  name: string
  original_name: string
  url: string
  content_type: string
  size: number
  path: string
  uploaded_at: string
  uploaded_by: string
}

interface TrackerItem {
  id: string
  item_id: string
  title: string
  description: string
  portal: string
  scope: string
  component: string
  section: string
  type: string
  status: string
  sprint_id: string | null
  discovery_url: string | null
  plan_link: string | null
  notes: string
  attachments?: Attachment[]
  created_by: string
  created_at: string
  updated_at: string
}

interface Sprint {
  id: string
  name: string
  description: string
  status: string
  phase?: string
  discovery_url: string | null
  plan_link: string | null
  prompt_text: string
  created_by: string
  created_at: string
  updated_at: string
}

/* ─── Constants ─── */
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  queue:           { color: 'rgb(251,191,36)', bg: 'rgba(251,191,36,0.15)', label: 'Queue' },
  not_touched:     { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Not Touched' },
  in_sprint:       { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'In Sprint' },
  seeded:          { color: 'rgb(251,146,60)', bg: 'rgba(251,146,60,0.15)', label: 'Discovery Audit' },
  disc_audited:    { color: 'rgb(234,88,12)', bg: 'rgba(234,88,12,0.15)', label: 'Plan' },
  planned:         { color: 'var(--portal, #4a7ab5)', bg: 'rgba(74,122,181,0.15)', label: 'Plan Audit' },
  plan_audited:    { color: 'rgb(99,102,241)', bg: 'rgba(99,102,241,0.15)', label: 'Build' },
  built:           { color: 'rgb(20,184,166)', bg: 'rgba(20,184,166,0.15)', label: 'Build Audit' },
  audited:         { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Deploy' },
  ux_audited:      { color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.15)', label: 'UX Audited' },
  confirmed:       { color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.15)', label: 'Confirmed' },
  deployed:        { color: 'rgb(16,185,129)', bg: 'rgba(16,185,129,0.15)', label: 'Deployed' },
  closed:          { color: 'rgb(107,114,128)', bg: 'rgba(107,114,128,0.15)', label: 'Closed' },
  // RAIDEN reactive statuses
  new:             { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'New' },
  triaging:        { color: 'rgb(251,191,36)', bg: 'rgba(251,191,36,0.15)', label: 'Triaging' },
  fixing:          { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Fixing' },
  verifying:       { color: 'rgb(99,102,241)', bg: 'rgba(99,102,241,0.15)', label: 'Verifying' },
  done:            { color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.15)', label: 'Done' },
  escalated:       { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Escalated' },
  // Terminal statuses
  deferred:        { color: 'rgb(156,163,175)', bg: 'rgba(156,163,175,0.15)', label: 'Deferred' },
  wont_fix:        { color: 'rgb(100,116,139)', bg: 'rgba(100,116,139,0.15)', label: "Won't Fix" },
  backlog:         { color: 'rgb(148,163,184)', bg: 'rgba(148,163,184,0.15)', label: 'Backlog' },
  blocked:         { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Blocked' },
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  broken:      { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Bug' },
  bug:         { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Bug' },
  idea:        { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  feat:        { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  feature:     { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  improve:     { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Enhancement' },
  enhancement: { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Enhancement' },
  question:    { color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.15)', label: 'Question' },
  test:        { color: 'rgb(20,184,166)', bg: 'rgba(20,184,166,0.15)', label: 'Test' },
}

const TYPES = ['broken', 'idea', 'improve', 'question', 'feat', 'bug', 'enhancement', 'test'] as const
const PORTALS = ['PRODASHX', 'RIIMO', 'SENTINEL', 'SHARED', 'INFRA', 'DATA'] as const
const SCOPES = ['Module', 'App', 'Platform', 'Data'] as const
const STATUSES = ['queue', 'not_touched', 'in_sprint', 'seeded', 'disc_audited', 'planned', 'plan_audited', 'built', 'audited', 'deployed', 'ux_audited', 'confirmed', 'closed', 'new', 'triaging', 'fixing', 'verifying', 'done', 'escalated', 'deferred', 'wont_fix', 'backlog', 'blocked'] as const

const API_BASE = '/api'

/* ─── Styles ─── */
const s = {
  bg: 'var(--bg, #0f1219)',
  surface: 'var(--bg-surface, #1c2333)',
  hover: 'var(--bg-hover, #232b3e)',
  border: 'var(--border-color, #2a3347)',
  text: 'var(--text-primary, #e2e8f0)',
  textSecondary: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  portal: 'var(--portal, #4a7ab5)',
}

/* ─── Error Boundary ─── */
class ForgeErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[THE DOJO ERROR BOUNDARY]', error.message, info.componentStack) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>The Dojo encountered an error</p>
          <pre style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap', maxWidth: 600, margin: '0 auto', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8 }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 6, border: 'none', background: '#4a7ab5', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Try Again</button>
        </div>
      )
    }
    return this.props.children
  }
}

/* ─── Safe Render: prevents React #31 by catching object-as-child ─── */
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') {
    console.warn('[FORGE] Object rendered as text — this would crash without safeStr:', val)
    return JSON.stringify(val)
  }
  return String(val)
}

/* ─── Helpers ─── */
function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '—' }
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Sub-Components (outside main to preserve focus) ─── */

function FSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--bg-surface, #1c2333)',
        border: '1px solid var(--border-color, #2a3347)',
        borderRadius: 6,
        padding: '6px 10px',
        color: 'var(--text-primary, #e2e8f0)',
        fontSize: 13,
        outline: 'none',
        minWidth: 110,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function FInput({ label, value, onChange, textarea }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
            borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
            outline: 'none', resize: 'vertical',
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
            borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
            outline: 'none',
          }}
        />
      )}
    </div>
  )
}

function FFormSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
          borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13, outline: 'none',
        }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isKnown = status in STATUS_CONFIG
  const cfg = STATUS_CONFIG[status] || { color: 'rgb(251,191,36)', bg: 'rgba(251,191,36,0.15)', label: status.replace(/_/g, ' ') }
  return (
    <span
      style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 12,
        fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color,
        whiteSpace: 'nowrap',
        border: isKnown ? 'none' : '1px dashed rgb(251,191,36)',
      }}
      title={isKnown ? cfg.label : `Unmapped status: "${status}" — displaying as-is`}
    >
      {cfg.label}
    </span>
  )
}

/* ─── Main Component ─── */
interface ForgeProps {
  portal: string
}

function ForgeInner({ portal }: ForgeProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<TrackerItem[]>([])
  const [allItems, setAllItems] = useState<TrackerItem[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', portal: '', scope: '', component: '', sprint_id: '', type: '', reporter: '' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editItem, setEditItem] = useState<TrackerItem | null>(null)
  const [editForm, setEditForm] = useState<Partial<TrackerItem>>({})
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [sprintForm, setSprintForm] = useState({ name: '', description: '', discovery_url: '' })
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptText, setPromptText] = useState('')
  const [promptSprintId, setPromptSprintId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string>('item_id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [bulkStatus, setBulkStatus] = useState('')
  const [view, setView] = useState<'grid' | 'workflow' | 'sprints' | 'sprint-detail' | 'dedup'>('grid')
  const [dedupGroups, setDedupGroups] = useState<Array<{ winner: TrackerItem; duplicates: TrackerItem[]; reason: string }>>([])
  const [dedupLoading, setDedupLoading] = useState(false)
  const [reopeningSprintId, setReopeningSprintId] = useState<string | null>(null)
  const [actionLoadingSprintId, setActionLoadingSprintId] = useState<string | null>(null)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [sprintEditField, setSprintEditField] = useState<string | null>(null)
  const [sprintEditValue, setSprintEditValue] = useState('')
  const [auditRound, setAuditRound] = useState<{ current_round: number; passed_count: number; failed_count: number; pending_count: number; total_items: number } | null>(null)
  // Track selected field values per group: { groupIndex: { fieldKey: itemIndex } }
  const [dedupSelections, setDedupSelections] = useState<Record<number, Record<string, number>>>({})
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showDiscoveryImport, setShowDiscoveryImport] = useState(false)
  const [discoveryContent, setDiscoveryContent] = useState('')
  const [discoveryPreview, setDiscoveryPreview] = useState<Record<string, unknown> | null>(null)
  const [discoveryPreviewing, setDiscoveryPreviewing] = useState(false)
  const [discoveryImporting, setDiscoveryImporting] = useState(false)
  const pageSize = 25

  // ─── TRK-14233/14235/14234: Dojo tab state (localStorage persisted) ───
  const DOJO_TAB_KEY = 'dojo-active-tab'
  const [dojoTab, setDojoTab] = useState<'ronin' | 'raiden'>(() => {
    if (typeof window === 'undefined') return 'ronin'
    try { return (localStorage.getItem(DOJO_TAB_KEY) as 'ronin' | 'raiden') || 'ronin' } catch { return 'ronin' }
  })
  const switchDojoTab = (tab: 'ronin' | 'raiden') => {
    setDojoTab(tab)
    try { localStorage.setItem(DOJO_TAB_KEY, tab) } catch { /* noop */ }
  }

  // ─── TRK-14234: RAIDEN Kanban state ───
  const [raidenItems, setRaidenItems] = useState<TrackerItem[]>([])
  const [raidenLoading, setRaidenLoading] = useState(false)

  const loadRaidenItems = useCallback(async () => {
    setRaidenLoading(true)
    try {
      const result = await fetchValidated<TrackerItem[]>(`${API_BASE}/tracker?limit=1000`)
      if (result.success) {
        // Filter to RAIDEN items (agent=raiden) or items with RAIDEN-specific statuses
        const all = result.data || []
        const raiden = all.filter(i =>
          (i as unknown as Record<string, unknown>).agent === 'raiden' ||
          ['new', 'triaging', 'fixing', 'verifying', 'done', 'escalated'].includes(i.status)
        )
        setRaidenItems(raiden)
      }
    } catch { /* silent */ }
    setRaidenLoading(false)
  }, [])

  useEffect(() => {
    if (dojoTab === 'raiden') loadRaidenItems()
  }, [dojoTab, loadRaidenItems])

  // Auto-refresh RAIDEN every 30s when on RAIDEN tab
  useEffect(() => {
    if (dojoTab !== 'raiden') return
    const interval = setInterval(() => loadRaidenItems(), 30000)
    return () => clearInterval(interval)
  }, [dojoTab, loadRaidenItems])

  // ─── TRK-14238: Quick Submit modal state ───
  const [showQuickSubmit, setShowQuickSubmit] = useState(false)
  const [quickSubmitForm, setQuickSubmitForm] = useState({ title: '', type: 'bug', priority: 'P2', screenshot: null as File | null })
  const [quickSubmitError, setQuickSubmitError] = useState('')
  const [quickSubmitting, setQuickSubmitting] = useState(false)

  const openQuickSubmit = useCallback(() => {
    setQuickSubmitForm({ title: '', type: 'bug', priority: 'P2', screenshot: null })
    setQuickSubmitError('')
    setShowQuickSubmit(true)
  }, [])

  const submitQuickForm = async () => {
    if (!quickSubmitForm.title.trim()) {
      setQuickSubmitError('Title is required')
      return
    }
    setQuickSubmitting(true)
    setQuickSubmitError('')
    try {
      const result = await fetchValidated<{ id: string; item_id: string }>(`${API_BASE}/tracker`, {
        method: 'POST',
        body: JSON.stringify({
          title: quickSubmitForm.title.trim(),
          type: quickSubmitForm.type,
          priority: quickSubmitForm.priority,
          agent: 'raiden',
          source: 'dojo_board',
          status: 'new',
          portal: portal.toUpperCase(),
        }),
      })
      if (result.success) {
        showToast(`Submitted: ${result.data?.item_id || 'item'} — RAIDEN is triaging`, 'success')
        setShowQuickSubmit(false)
        await loadRaidenItems()
        await loadItems()
      } else {
        setQuickSubmitError((result as unknown as Record<string, unknown>).error as string || 'Submit failed')
      }
    } catch (err) {
      setQuickSubmitError(String(err))
    }
    setQuickSubmitting(false)
  }

  // Keyboard shortcut Ctrl+N for Quick Submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n' && dojoTab === 'raiden') {
        e.preventDefault()
        openQuickSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dojoTab, openQuickSubmit])

  // ─── TRK-14237: Auto-Triage modal state ───
  const [showAutoTriage, setShowAutoTriage] = useState(false)
  const [autoTriageLoading, setAutoTriageLoading] = useState(false)
  const [autoTriageResult, setAutoTriageResult] = useState<Record<string, unknown> | null>(null)

  const runAutoTriage = async () => {
    setAutoTriageLoading(true)
    setAutoTriageResult(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>(`${API_BASE}/sprints/auto`, {
        method: 'POST',
        body: JSON.stringify({ scope: 'raiden', status: 'new', groupBy: 'component' }),
      })
      if (result.success) {
        setAutoTriageResult(result.data || {})
      } else {
        showToast('Auto-triage failed', 'error')
        setShowAutoTriage(false)
      }
    } catch (err) {
      showToast(`Auto-triage error: ${String(err)}`, 'error')
      setShowAutoTriage(false)
    }
    setAutoTriageLoading(false)
  }

  const confirmAutoTriage = async () => {
    showToast('RAIDEN queue sorted and grouped', 'success')
    setShowAutoTriage(false)
    setAutoTriageResult(null)
    await loadRaidenItems()
  }

  /* ─── Data Loading ─── */
  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.portal) params.set('portal', filters.portal)
      if (filters.scope) params.set('scope', filters.scope)
      if (filters.component) params.set('component', filters.component)
      if (filters.sprint_id) params.set('sprint_id', filters.sprint_id)
      if (filters.type) params.set('type', filters.type)
      if (search) params.set('search', search)
      params.set('limit', '1000')
      const result = await fetchValidated<TrackerItem[]>(`${API_BASE}/tracker?${params}`)
      if (result.success) setItems(result.data || [])
    } catch { /* silent */ }
    setLoading(false)
    // Also refresh unfiltered items for sprint cards
    try {
      const allResult = await fetchValidated<TrackerItem[]>(`${API_BASE}/tracker?limit=1000`)
      if (allResult.success) setAllItems(allResult.data || [])
    } catch { /* silent */ }
  }, [filters, search])

  const loadAllItems = useCallback(async () => {
    try {
      const result = await fetchValidated<TrackerItem[]>(`${API_BASE}/tracker?limit=1000`)
      if (result.success) setAllItems(result.data || [])
    } catch { /* silent */ }
  }, [])

  const loadSprints = useCallback(async () => {
    try {
      const result = await fetchValidated<Sprint[]>(`${API_BASE}/sprints`)
      if (result.success) setSprints(result.data || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])
  useEffect(() => { loadAllItems() }, [loadAllItems])
  useEffect(() => { loadSprints() }, [loadSprints])

  // Auto-refresh every 30s so new tickets from other agents appear
  useEffect(() => {
    const interval = setInterval(() => { loadItems(); loadAllItems(); loadSprints() }, 30000)
    return () => clearInterval(interval)
  }, [loadItems, loadAllItems, loadSprints])

  /* ─── Derived ─── */
  const components = useMemo(() => {
    const set = new Set(items.map(i => i.component).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const reporters = useMemo(() => {
    const set = new Set(items.map(i => i.created_by).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const sortedItems = useMemo(() => {
    let list = [...items]
    if (filters.reporter) list = list.filter(i => i.created_by === filters.reporter)
    list.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortField] as string || ''
      const bv = (b as unknown as Record<string, unknown>)[sortField] as string || ''
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [items, sortField, sortDir, filters.reporter])

  const pagedItems = useMemo(() => {
    const start = page * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [sortedItems, page])

  const totalPages = Math.ceil(items.length / pageSize)

  const activeSprint = useMemo(() => {
    if (!filters.sprint_id) return null
    return sprints.find(s => s.id === filters.sprint_id) || null
  }, [filters.sprint_id, sprints])

  const sprintProgress = useMemo(() => {
    if (!activeSprint) return { confirmed: 0, total: 0 }
    const total = items.length
    const confirmed = items.filter(i => i.status === 'confirmed').length
    return { confirmed, total }
  }, [activeSprint, items])

  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    return STATUSES.map(status => {
      const cfg = STATUS_CONFIG[status]
      const statusItems = items.filter(i => i.status === status)
      const cards: KanbanCard[] = statusItems.map(item => ({
        id: item.id,
        title: item.title,
        subtitle: item.item_id,
        badges: [
          ...(TYPE_CONFIG[item.type] ? [{ label: TYPE_CONFIG[item.type].label, color: TYPE_CONFIG[item.type].color }] : []),
          { label: item.portal || '', color: 'var(--portal, #4a7ab5)' },
          ...(item.component ? [{ label: item.component, color: '#e07c3e' }] : []),
        ].filter(b => b.label),
        meta: [
          ...(item.section ? [{ text: item.section }] : []),
          ...(item.attachments?.length ? [{ icon: 'attach_file', text: `${item.attachments.length}` }] : []),
        ],
        onClick: () => openEdit(item),
      }))
      return { id: status, title: `${cfg?.label || status} (${statusItems.length})`, cards, color: cfg?.color }
    })
  }, [items])

  // Sprint lifecycle phases + phase detection
  const SPRINT_PHASES = ['unseeded', 'seeded', 'disc_audited', 'planned', 'plan_audited', 'built', 'audited', 'deployed', 'ux_audited', 'confirmed'] as const
  const PHASE_CONFIG: Record<string, { label: string; color: string; action: string; actionLabel: string }> = {
    unseeded:      { label: 'Seed',            color: 'rgb(245,158,11)',        action: 'seed',            actionLabel: '#LetsSeedTheDiscovery' },
    seeded:        { label: 'Discovery Audit', color: 'rgb(251,146,60)',        action: 'audit_discovery', actionLabel: '#LetsAuditTheDiscovery' },
    disc_audited:  { label: 'Plan',            color: 'rgb(234,88,12)',         action: 'prompt',          actionLabel: '#LetsPlanIt' },
    planned:       { label: 'Plan Audit',      color: 'var(--portal, #4a7ab5)', action: 'audit_plan',      actionLabel: '#LetsAuditThePlan' },
    plan_audited:  { label: 'Build',           color: 'rgb(99,102,241)',        action: 'prompt',          actionLabel: '#LetsBuildIt' },
    built:         { label: 'Build Audit',     color: 'rgb(20,184,166)',        action: 'audit',           actionLabel: '#LetsAuditTheBuild' },
    audited:       { label: 'Deploy',          color: 'rgb(168,85,247)',        action: 'sendit',          actionLabel: '#SendIt' },
    deployed:      { label: 'Deployed',        color: 'rgb(16,185,129)',        action: 'ux_audit',        actionLabel: '#LetsAuditTheUX' },
    ux_audited:    { label: 'UX Audited',      color: 'rgb(34,197,94)',         action: 'confirm',         actionLabel: '#LandedIt!!!' },
    confirmed:     { label: 'Complete',        color: 'rgb(34,197,94)',         action: 'reopen',          actionLabel: 'Reopen Sprint' },
  }

  // Ranks define phase progression — each phase has a unique rank, no collisions
  const STATUS_RANK: Record<string, number> = {
    queue: 0, not_touched: 1, in_sprint: 2, seeded: 3, disc_audited: 4, planned: 5,
    plan_audited: 6, built: 7, audited: 8, deployed: 9, ux_audited: 10, confirmed: 11,
    closed: 11,
    // RAIDEN statuses map to sprint-equivalent ranks
    new: 0, triaging: 1, fixing: 5, verifying: 7, done: 11, escalated: 0,
    backlog: 0, blocked: 0,
  }
  // Fallback for truly unknown statuses: treat as mid-pipeline (planned) rather than
  // rank 0 which would silently drag the entire sprint phase back to "unseeded"
  const getStatusRank = (status: string): number => STATUS_RANK[status] ?? 5

  const sprintCards = useMemo(() => {
    return sprints.map(sp => {
      const sprintItems = allItems.filter(i => i.sprint_id === sp.id)
      const bugs = sprintItems.filter(i => i.type === 'broken').length
      const enhancements = sprintItems.filter(i => i.type === 'improve').length
      const features = sprintItems.filter(i => i.type === 'idea').length
      const questions = sprintItems.filter(i => i.type === 'question').length
      const confirmed = sprintItems.filter(i => ['confirmed', 'closed'].includes(i.status)).length
      const total = sprintItems.length

      // Phase = lowest status rank among active items (bottleneck), or stored phase for empty sprints
      const activeItems = sprintItems.filter(i => !['deferred', 'wont_fix', 'blocked', 'closed'].includes(i.status))
      // Default: unseeded (shows #LetsSeedTheDiscovery)
      // in_sprint is a RAIDEN reactive status — never used in FORGE sprint pipeline
      let phase = 'unseeded'
      if (sp.status === 'complete') {
        phase = 'confirmed'
      } else if (activeItems.length > 0) {
        // Use getStatusRank() — unknown statuses fall to mid-pipeline (5) not 0, preventing
        // a single unrecognized status from dragging the whole sprint to "unseeded"
        const minRank = Math.min(...activeItems.map(i => getStatusRank(i.status)))
        if (minRank >= 11) phase = 'confirmed'
        else if (minRank >= 10) phase = 'ux_audited'
        else if (minRank >= 9) phase = 'deployed'
        else if (minRank >= 8) phase = 'audited'
        else if (minRank >= 7) phase = 'built'
        else if (minRank >= 6) phase = 'plan_audited'
        else if (minRank >= 5) phase = 'planned'
        else if (minRank >= 4) phase = 'disc_audited'
        else if (minRank >= 3) phase = 'seeded'
        else phase = 'unseeded'
      } else if (sp.phase && sp.phase !== 'in_sprint') {
        // No active items — use stored phase (but never in_sprint)
        phase = sp.phase
      }

      return { ...sp, items: sprintItems, bugs, enhancements, features, questions, confirmed, total, phase }
    })
  }, [sprints, allItems])

  /* ─── Handlers ─── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedItems.map(i => i.id)))
    }
  }

  const openEdit = (item: TrackerItem) => {
    setEditItem(item)
    setEditForm({ ...item })
  }

  const closeEdit = () => {
    setEditItem(null)
    setEditForm({})
  }

  const saveEdit = async () => {
    if (!editItem) return
    try {
      const result = await fetchValidated(`${API_BASE}/tracker/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      })
      if (result.success) {
        closeEdit()
        await loadItems()
      }
    } catch { /* silent */ }
  }

  const confirmItem = async () => {
    if (!editItem) return
    try {
      await fetchValidated(`${API_BASE}/tracker/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'confirmed' }),
      })
      closeEdit()
      await loadItems()
    } catch { /* silent */ }
  }

  const deleteItem = async () => {
    if (!editItem) return
    try {
      const result = await fetchValidated(`${API_BASE}/tracker/${editItem.id}`, { method: 'DELETE' })
      if (result.success) {
        closeEdit()
        await loadItems()
      }
    } catch { /* silent */ }
  }

  const createSprint = async () => {
    try {
      const result = await fetchValidated(`${API_BASE}/sprints`, {
        method: 'POST',
        body: JSON.stringify({
          name: sprintForm.name,
          description: sprintForm.description,
          discovery_url: sprintForm.discovery_url || null,
          item_ids: Array.from(selectedIds),
        }),
      })
      if (result.success) {
        setShowCreateSprint(false)
        setSprintForm({ name: '', description: '', discovery_url: '' })
        setSelectedIds(new Set())
        await loadItems()
        await loadSprints()
      }
    } catch { /* silent */ }
  }

  const generatePrompt = async (sprintId?: string, phase?: string) => {
    const sid = sprintId || activeSprint?.id
    if (!sid) return
    const phaseParam = phase || 'discovery'
    try {
      const promptResult = await fetchValidated<{ prompt: string }>(`${API_BASE}/sprints/${sid}/prompt?phase=${phaseParam}`)
      if (promptResult.success) {
        setPromptText(promptResult.data?.prompt || '')
        setPromptSprintId(sid)
        setShowPrompt(true)
        // Move items forward based on phase (use allItems, not filtered items)
        const targetStatus = phaseParam === 'discovery' ? 'planned' : phaseParam === 'building' ? 'built' : null
        const fromStatuses = phaseParam === 'discovery' ? ['disc_audited', 'seeded'] : phaseParam === 'building' ? ['plan_audited', 'planned'] : []
        const sprintItems = targetStatus ? allItems.filter(i => i.sprint_id === sid && fromStatuses.includes(i.status)) : []
        if (sprintItems.length > 0) {
          await fetchValidated(`${API_BASE}/tracker/bulk`, {
            method: 'PATCH',
            body: JSON.stringify({ ids: sprintItems.map(i => i.id), updates: { status: targetStatus } }),
          })
          await loadItems()
        }
      }
    } catch { /* silent */ }
  }

  const bulkUpdateStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetchValidated(`${API_BASE}/tracker/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: bulkStatus }),
          })
        )
      )
      setSelectedIds(new Set())
      setBulkStatus('')
      await loadItems()
    } catch { /* silent */ }
  }

  const savePromptToSprint = async () => {
    if (!promptSprintId || !promptText) return
    try {
      await fetchValidated(`${API_BASE}/sprints/${promptSprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ prompt_text: promptText }),
      })
      await loadSprints()
    } catch { /* silent */ }
  }

  const copyPrompt = async () => {
    navigator.clipboard.writeText(promptText)
    await savePromptToSprint()
  }

  const printPrompt = async () => {
    await savePromptToSprint()
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>The Dojo Sprint Prompt</title>
<style>
@page { size: letter; margin: 0.75in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; background: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
h1 { font-size: 20px; margin-bottom: 8px; color: #e07c3e; }
p { font-size: 12px; color: #64748b; margin-bottom: 20px; }
</style></head><body>
<h1>The Dojo Sprint Prompt</h1>
<p>Generated ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
<pre>${promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>window.print()</script>
</body></html>`)
      win.document.close()
    }
  }

  const handleCardMove = async (cardId: string, _fromCol: string, toCol: string) => {
    try {
      await fetchValidated(`${API_BASE}/tracker/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: toCol }),
      })
      await loadItems()
    } catch { /* silent */ }
  }

  const autoCreateSprint = () => {
    // Find all unassigned items — use allItems (not filtered items)
    const unassigned = allItems.filter(i => !i.sprint_id && ['queue', 'not_touched'].includes(i.status))
    if (unassigned.length === 0) {
      showToast('No unassigned items to sprint — all items are already in sprints', 'warning')
      return
    }

    // Sort: bugs → enhancements → features → questions, clustered by component
    const typePriority: Record<string, number> = { broken: 0, improve: 1, idea: 2, question: 3 }
    const sorted = [...unassigned].sort((a, b) => {
      const pa = typePriority[a.type] ?? 4
      const pb = typePriority[b.type] ?? 4
      if (pa !== pb) return pa - pb
      return (a.component || '').localeCompare(b.component || '')
    })

    // Select all unassigned
    setSelectedIds(new Set(sorted.map(i => i.id)))

    // Smart name generation from content
    const bugs = sorted.filter(i => i.type === 'broken').length
    const enhancements = sorted.filter(i => i.type === 'improve').length
    const features = sorted.filter(i => i.type === 'idea').length
    const questions = sorted.filter(i => i.type === 'question').length

    // Find the highest existing sprint number
    const existingNums = sprints.map(sp => {
      const match = sp.name.match(/Sprint\s+(\d+)/i)
      return match ? parseInt(match[1], 10) : 0
    })
    const nextNum = Math.max(0, ...existingNums) + 1

    // Determine dominant portals
    const portalCounts: Record<string, number> = {}
    sorted.forEach(i => { portalCounts[i.portal] = (portalCounts[i.portal] || 0) + 1 })
    const topPortals = Object.entries(portalCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => p)

    // Determine dominant components
    const compCounts: Record<string, number> = {}
    sorted.forEach(i => { if (i.component) compCounts[i.component] = (compCounts[i.component] || 0) + 1 })
    const topComps = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c)

    // Build smart name
    let smartName = `Sprint ${nextNum}`
    if (bugs > enhancements + features && bugs > sorted.length * 0.6) {
      // Bug-heavy sprint
      smartName += ' — Bug Fixes'
      if (topPortals.length === 1 && topPortals[0] !== 'SHARED') smartName += ` (${topPortals[0]})`
      else if (topComps.length <= 2) smartName += ` (${topComps.join(' + ')})`
    } else if (features > bugs && features > sorted.length * 0.4) {
      // Feature-heavy sprint
      smartName += ' — New Features'
      if (topComps.length <= 2) smartName += ` (${topComps.join(' + ')})`
    } else if (topComps.length === 1) {
      // Single component focus
      smartName += ` — ${topComps[0]}`
    } else if (topPortals.length === 1 && topPortals[0] !== 'SHARED') {
      smartName += ` — ${topPortals[0]}`
    } else {
      // Mixed
      const mixParts: string[] = []
      if (bugs) mixParts.push(`${bugs} fixes`)
      if (enhancements + features) mixParts.push(`${enhancements + features} improvements`)
      smartName += ` — ${mixParts.join(', ')}`
    }

    const descParts: string[] = []
    if (bugs) descParts.push(`${bugs} bugs`)
    if (enhancements) descParts.push(`${enhancements} enhancements`)
    if (features) descParts.push(`${features} features`)
    if (questions) descParts.push(`${questions} questions`)

    setSprintForm({
      name: smartName,
      description: `${sorted.length} items: ${descParts.join(', ')}. Top: ${topComps.slice(0, 3).join(', ') || 'mixed'}`,
      discovery_url: '',
    })
    setShowCreateSprint(true)
  }

  const generatePhaseAudit = async (sprintId: string, auditType: 'discovery' | 'plan') => {
    try {
      const res = await fetchValidated<{ prompt: string }>(`${API_BASE}/sprints/${sprintId}/audit-${auditType}`)
      if (res.success) {
        setPromptText(res.data?.prompt || '')
        setPromptSprintId(sprintId)
        setShowPrompt(true)
        // Advance items: discovery audit (seeded → disc_audited), plan audit (planned → plan_audited)
        const targetStatus = auditType === 'discovery' ? 'disc_audited' : 'plan_audited'
        const fromStatuses = auditType === 'discovery' ? ['seeded'] : ['planned']
        const sprintItems = allItems.filter(i => i.sprint_id === sprintId && fromStatuses.includes(i.status))
        if (sprintItems.length > 0) {
          await fetchValidated(`${API_BASE}/tracker/bulk`, {
            method: 'PATCH',
            body: JSON.stringify({ ids: sprintItems.map(i => i.id), updates: { status: targetStatus } }),
          })
          await loadItems()
        }
      }
    } catch { /* silent */ }
  }

  const generateAuditPrompt = async (sprintId: string) => {
    try {
      const res = await fetchValidated<{ prompt: string }>(`${API_BASE}/sprints/${sprintId}/audit`)
      if (res.success) {
        setPromptText(res.data?.prompt || '')
        setPromptSprintId(sprintId)
        setShowPrompt(true)
        // Advance items: build audit (built → audited)
        const sprintItems = allItems.filter(i => i.sprint_id === sprintId && i.status === 'built')
        if (sprintItems.length > 0) {
          await fetchValidated(`${API_BASE}/tracker/bulk`, {
            method: 'PATCH',
            body: JSON.stringify({ ids: sprintItems.map(i => i.id), updates: { status: 'audited' } }),
          })
          await loadItems()
        }
      }
    } catch { /* silent */ }
  }

  const confirmAllInSprint = async (sprintId: string) => {
    const sprintItems = allItems.filter(i => i.sprint_id === sprintId && i.status !== 'confirmed' && i.status !== 'deferred' && i.status !== 'wont_fix' && i.status !== 'closed')
    if (sprintItems.length === 0) return
    try {
      await fetchValidated(`${API_BASE}/tracker/bulk`, {
        method: 'PATCH',
        body: JSON.stringify({ ids: sprintItems.map(i => i.id), updates: { status: 'confirmed' } }),
      })
      await loadItems()
    } catch { /* silent */ }
  }

  const closeSprint = async (sprintId: string) => {
    try {
      await fetchValidated(`${API_BASE}/sprints/${sprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'complete' }),
      })
      await loadSprints()
    } catch { /* silent */ }
  }

  const reopenSprint = async (sprintId: string) => {
    setReopeningSprintId(sprintId)
    try {
      const r = await fetchValidated(`${API_BASE}/sprints/${sprintId}/reopen`, { method: 'POST' })
      if (r.success) {
        showToast('Sprint reopened — items moved back to Audit', 'success')
        await loadItems()
        await loadSprints()
      } else {
        showToast(`Reopen failed: ${r.error || 'Unknown error'}`, 'error')
      }
    } catch (err) {
      showToast(`Reopen error: ${String(err)}`, 'error')
    } finally {
      setReopeningSprintId(null)
    }
  }

  const saveSprint = async (sprintId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetchValidated(`${API_BASE}/sprints/${sprintId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      if (res.success) {
        await loadSprints()
        showToast('Sprint updated', 'success')
      }
    } catch { /* silent */ }
  }

  const loadAuditRound = async (sprintId: string) => {
    try {
      const res = await fetchValidated<{ current_round: number; passed_count: number; failed_count: number; pending_count: number; total_items: number }>(`${API_BASE}/sprints/${sprintId}/audit-round`)
      if (res.success) {
        setAuditRound(res.data ?? null)
      } else {
        setAuditRound(null)
      }
    } catch { setAuditRound(null) }
  }

  const openSprintDetail = (sprintId: string) => {
    setSelectedSprintId(sprintId)
    setSprintEditField(null)
    setSprintEditValue('')
    setAuditRound(null)
    setView('sprint-detail')
    loadAuditRound(sprintId)
  }

  const startSprintEdit = (field: string, currentValue: string) => {
    setSprintEditField(field)
    setSprintEditValue(currentValue || '')
  }

  const cancelSprintEdit = () => {
    setSprintEditField(null)
    setSprintEditValue('')
  }

  const commitSprintEdit = async (sprintId: string, field: string) => {
    await saveSprint(sprintId, { [field]: sprintEditValue || null })
    setSprintEditField(null)
    setSprintEditValue('')
  }

  const unconfirmItem = async () => {
    if (!editItem) return
    try {
      await fetchValidated(`${API_BASE}/tracker/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'audited' }),
      })
      closeEdit()
      await loadItems()
    } catch { /* silent */ }
  }

  const loadDedup = useCallback(async () => {
    setDedupLoading(true)
    try {
      const res = await fetchValidated<{ groups: Array<{ winner: TrackerItem; duplicates: TrackerItem[]; reason: string }> }>(`${API_BASE}/tracker/dedup`)
      if (res.success) {
        setDedupGroups(res.data?.groups || [])
      }
    } catch { /* silent */ }
    setDedupLoading(false)
  }, [])

  const mergeDedup = async (groupIndex: number, winnerId: string, loserIds: string[], allItems: TrackerItem[]) => {
    // Build overrides from selected cells
    const selections = dedupSelections[groupIndex] || {}
    const overrides: Record<string, unknown> = {}
    const mergeableFields = ['title', 'description', 'type', 'portal', 'scope', 'component', 'section', 'notes', 'sprint_id']
    for (const field of mergeableFields) {
      const selectedIdx = selections[field]
      if (selectedIdx !== undefined && selectedIdx > 0 && allItems[selectedIdx]) {
        const val = (allItems[selectedIdx] as unknown as Record<string, unknown>)[field]
        if (val) overrides[field] = val
      }
    }

    try {
      // First merge (combines attachments, notes, deletes losers)
      const res = await fetchValidated(`${API_BASE}/tracker/dedup/merge`, {
        method: 'POST',
        body: JSON.stringify({ winner_id: winnerId, loser_ids: loserIds }),
      })
      // Then apply field overrides from selections
      if (res.success && Object.keys(overrides).length > 0) {
        await fetchValidated(`${API_BASE}/tracker/${winnerId}`, {
          method: 'PATCH',
          body: JSON.stringify(overrides),
        })
      }
      if (res.success) {
        setDedupSelections(prev => { const next = { ...prev }; delete next[groupIndex]; return next })
        await loadDedup()
        await loadItems()
      }
    } catch { /* silent */ }
  }

  const [sprintDragOver, setSprintDragOver] = useState<string | null>(null)

  // Map sprint phase columns to the ticket status that items should be set to
  const PHASE_TO_STATUS: Record<string, string> = {
    unseeded: 'in_sprint',
    seeded: 'seeded',
    in_sprint: 'in_sprint',
    disc_audited: 'disc_audited',
    planned: 'planned',
    plan_audited: 'plan_audited',
    built: 'built',
    audited: 'audited',
    deployed: 'deployed',
    ux_audited: 'ux_audited',
    confirmed: 'confirmed',
  }

  const handleSprintDrop = async (e: React.DragEvent, toPhase: string) => {
    e.preventDefault()
    setSprintDragOver(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (!data.sprintId || data.fromPhase === toPhase) return
      const targetStatus = PHASE_TO_STATUS[toPhase]
      if (!targetStatus) return
      // Update all items in this sprint to the target status (use allItems, not filtered items)
      const sprintItems = allItems.filter(i => i.sprint_id === data.sprintId && !['deferred', 'wont_fix', 'blocked', 'closed'].includes(i.status))
      // Always save phase to sprint doc (supports empty sprints)
      await fetchValidated(`${API_BASE}/sprints/${data.sprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ phase: toPhase }),
      })
      if (sprintItems.length > 0) {
        await fetchValidated(`${API_BASE}/tracker/bulk`, {
          method: 'PATCH',
          body: JSON.stringify({ ids: sprintItems.map(i => i.id), updates: { status: targetStatus } }),
        })
      }
      await loadItems()
      await loadSprints()
    } catch { /* invalid drag data */ }
  }

  const openRoadmap = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/roadmap`)
      if (res.ok) {
        const html = await res.text()
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close() }
        else showToast('Pop-up blocked — allow pop-ups for this site', 'warning')
      } else {
        showToast('Roadmap generation failed', 'error')
      }
    } catch (err) {
      showToast(`Roadmap error: ${String(err)}`, 'error')
    }
  }

  /* ─── Discovery Import Handlers ─── */
  const handleDiscoveryDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setDiscoveryContent(ev.target?.result as string || '')
      }
      reader.readAsText(file)
    }
  }, [])

  const previewDiscovery = useCallback(async () => {
    if (!discoveryContent.trim()) return
    setDiscoveryPreviewing(true)
    setDiscoveryPreview(null)
    try {
      const res = await fetchValidated(`${API_BASE}/sprints/import-discovery`, {
        method: 'POST',
        body: JSON.stringify({
          content: discoveryContent,
          discovery_url: sprintForm.discovery_url || undefined,
          dry_run: true,
        }),
      })
      if (res.success && res.data) {
        setDiscoveryPreview(res.data as Record<string, unknown>)
      }
    } catch { /* silent */ }
    setDiscoveryPreviewing(false)
  }, [discoveryContent, sprintForm.discovery_url])

  const importDiscovery = useCallback(async () => {
    if (!discoveryContent.trim()) return
    setDiscoveryImporting(true)
    try {
      const res = await fetchValidated(`${API_BASE}/sprints/import-discovery`, {
        method: 'POST',
        body: JSON.stringify({
          content: discoveryContent,
          discovery_url: sprintForm.discovery_url || undefined,
        }),
      })
      if (res.success) {
        setShowCreateSprint(false)
        setShowDiscoveryImport(false)
        setDiscoveryContent('')
        setDiscoveryPreview(null)
        loadSprints()
      }
    } catch { /* silent */ }
    setDiscoveryImporting(false)
  }, [discoveryContent, sprintForm.discovery_url, loadSprints])

  /* ─── Attachment Handlers ─── */
  const uploadAttachment = async (file: File) => {
    if (!editItem) return
    if (file.size > 5 * 1024 * 1024) return // 5MB max
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // strip data:... prefix
        }
        reader.readAsDataURL(file)
      })
      const res = await fetchValidated(`${API_BASE}/tracker/${editItem.id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ name: file.name, data: base64, content_type: file.type }),
      })
      if (res.success) {
        await loadItems()
        // Refresh the edit item with new attachments
        const itemResult = await fetchValidated<TrackerItem>(`${API_BASE}/tracker/${editItem.id}`)
        if (itemResult.success && itemResult.data) { setEditItem(itemResult.data); setEditForm(itemResult.data) }
      }
    } catch { /* silent */ }
    setUploading(false)
  }

  const deleteAttachment = async (attachName: string) => {
    if (!editItem) return
    try {
      const res = await fetchValidated(`${API_BASE}/tracker/${editItem.id}/attachments/${encodeURIComponent(attachName)}`, {
        method: 'DELETE',
      })
      if (res.success) {
        await loadItems()
        const itemResult = await fetchValidated<TrackerItem>(`${API_BASE}/tracker/${editItem.id}`)
        if (itemResult.success && itemResult.data) { setEditItem(itemResult.data); setEditForm(itemResult.data) }
      }
    } catch { /* silent */ }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => uploadAttachment(f))
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) {
      e.preventDefault()
      files.forEach(f => uploadAttachment(f))
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // Sub-components aliased from top-level (preserves focus on re-render)
  const Select = FSelect
  const FormInput = FInput
  const FormSelect = FFormSelect

  /* ─── Render ─── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: s.text, fontFamily: 'inherit' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* ─── TRK-14233: The Dojo Module Header + TRK-14235/14234: RONIN/RAIDEN Tabs ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        marginBottom: 16, borderBottom: `1px solid ${s.border}`, paddingBottom: 0,
      }}>
        {/* Module identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
          <span className="material-icons-outlined" style={{ fontSize: 22, color: '#e07c3e' }}>temple_buddhist</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: s.text, letterSpacing: '-0.01em' }}>The Dojo</span>
        </div>
        {/* Tab: RONIN */}
        <button
          onClick={() => switchDojoTab('ronin')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', border: 'none', cursor: 'pointer',
            background: 'transparent', color: dojoTab === 'ronin' ? s.text : s.textMuted,
            fontSize: 13, fontWeight: dojoTab === 'ronin' ? 600 : 400,
            borderBottom: dojoTab === 'ronin' ? `2px solid ${s.portal}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 16, color: dojoTab === 'ronin' ? s.portal : s.textMuted }}>precision_manufacturing</span>
          RONIN
        </button>
        {/* Tab: RAIDEN */}
        <button
          onClick={() => switchDojoTab('raiden')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', border: 'none', cursor: 'pointer',
            background: 'transparent', color: dojoTab === 'raiden' ? s.text : s.textMuted,
            fontSize: 13, fontWeight: dojoTab === 'raiden' ? 600 : 400,
            borderBottom: dojoTab === 'raiden' ? '2px solid rgb(239,68,68)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 16, color: dojoTab === 'raiden' ? 'rgb(239,68,68)' : s.textMuted }}>bolt</span>
          RAIDEN
        </button>
      </div>

      {/* ─── TRK-14234: RAIDEN tab content ─── */}
      {dojoTab === 'raiden' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {/* RAIDEN header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: s.textSecondary }}>
              Reactive fix queue — RAIDEN monitors, triages, and ships
            </span>
            <div style={{ flex: 1 }} />
            {/* TRK-14237: Auto-Triage button */}
            <button
              onClick={() => { setShowAutoTriage(true); runAutoTriage() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)', fontSize: 13, fontWeight: 600,
              }}
            >
              <Icon name="auto_fix_high" size={16} color="rgb(239,68,68)" />
              Auto-Triage
            </button>
            {/* TRK-14238: Quick Submit button */}
            <button
              onClick={openQuickSubmit}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'rgb(239,68,68)', color: '#fff', fontSize: 13, fontWeight: 600,
              }}
              title="Submit an issue (Ctrl+N)"
            >
              <Icon name="add" size={16} color="#fff" />
              Quick Submit
              <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>Ctrl+N</span>
            </button>
          </div>

          {/* RAIDEN Kanban: 6 columns */}
          {raidenLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.textMuted }}>
              <span className="material-icons-outlined" style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}>refresh</span>
              <span style={{ marginLeft: 8 }}>Loading RAIDEN queue...</span>
            </div>
          ) : (
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ display: 'flex', gap: 12, height: '100%', minWidth: 900 }}>
                {([
                  { status: 'new', label: 'NEW', color: 'rgb(239,68,68)' },
                  { status: 'triaging', label: 'TRIAGING', color: 'rgb(251,191,36)' },
                  { status: 'fixing', label: 'FIXING', color: 'rgb(245,158,11)' },
                  { status: 'verifying', label: 'VERIFYING', color: 'rgb(99,102,241)' },
                  { status: 'done', label: 'DONE', color: 'rgb(34,197,94)' },
                  { status: 'escalated', label: 'ESCALATED', color: 'rgb(239,68,68)' },
                ] as const).map(col => {
                  // Filter items for this column and sort by priority (P0 first)
                  const colItems = raidenItems
                    .filter(i => i.status === col.status)
                    .sort((a, b) => {
                      const pa = parseInt(((a as unknown as Record<string,unknown>).priority as string || 'P2').replace('P', ''), 10)
                      const pb = parseInt(((b as unknown as Record<string,unknown>).priority as string || 'P2').replace('P', ''), 10)
                      return pa - pb // P0 first
                    })
                  return (
                    <div
                      key={col.status}
                      style={{
                        flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column',
                        background: s.surface, borderRadius: 8, border: `1px solid ${s.border}`, overflow: 'hidden',
                      }}
                    >
                      {/* Column header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px',
                        borderBottom: `2px solid ${col.color}`, background: `${col.color}18`,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: col.color, letterSpacing: '0.06em' }}>{col.label}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '1px 7px',
                          borderRadius: 10, background: `${col.color}30`, color: col.color,
                        }}>{colItems.length}</span>
                      </div>
                      {/* Cards */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {colItems.length === 0 ? (
                          <div style={{ padding: '12px 8px', textAlign: 'center', color: s.textMuted, fontSize: 11 }}>—</div>
                        ) : colItems.map(item => {
                          const priority = ((item as unknown as Record<string,unknown>).priority as string) || 'P2'
                          const priorityColors: Record<string, string> = {
                            P0: 'rgb(239,68,68)', P1: 'rgb(245,158,11)', P2: 'rgb(99,102,241)', P3: 'rgb(148,163,184)'
                          }
                          const pColor = priorityColors[priority] || priorityColors.P2
                          return (
                            <div
                              key={item.id}
                              onClick={() => openEdit(item)}
                              style={{
                                background: s.bg, borderRadius: 6, border: `1px solid ${s.border}`,
                                padding: '8px 10px', cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.background = `${col.color}0a` }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = s.border; e.currentTarget.style.background = s.bg }}
                            >
                              {/* Priority + ID row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                                  background: `${pColor}20`, color: pColor, letterSpacing: '0.04em',
                                }}>{priority}</span>
                                <span style={{ fontSize: 10, color: s.textMuted, fontFamily: 'monospace' }}>{item.item_id}</span>
                              </div>
                              {/* Title */}
                              <div style={{ fontSize: 12, fontWeight: 500, color: s.text, lineHeight: 1.4 }}>
                                {item.title}
                              </div>
                              {/* Type badge */}
                              {item.type && TYPE_CONFIG[item.type] && (
                                <div style={{ marginTop: 4 }}>
                                  <span style={{
                                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                                    background: TYPE_CONFIG[item.type].bg, color: TYPE_CONFIG[item.type].color,
                                  }}>{TYPE_CONFIG[item.type].label}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── TRK-14238: Quick Submit Modal ─── */}
          {showQuickSubmit && (
            <>
              <div
                onClick={() => setShowQuickSubmit(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
              />
              <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 201, background: s.bg, borderRadius: 12, border: `1px solid ${s.border}`,
                width: 480, padding: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Icon name="bolt" size={20} color="rgb(239,68,68)" />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Quick Submit</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setShowQuickSubmit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Icon name="close" size={18} color={s.textMuted} />
                  </button>
                </div>
                {/* Title — required */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: s.textSecondary, marginBottom: 4 }}>
                    What broke? <span style={{ color: 'rgb(239,68,68)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="What broke?"
                    value={quickSubmitForm.title}
                    onChange={(e) => { setQuickSubmitForm(f => ({ ...f, title: e.target.value })); setQuickSubmitError('') }}
                    autoFocus
                    style={{
                      width: '100%', background: s.surface,
                      border: `1px solid ${quickSubmitError ? 'rgb(239,68,68)' : s.border}`,
                      borderRadius: 6, padding: '9px 12px', color: s.text, fontSize: 14, outline: 'none',
                    }}
                  />
                  {quickSubmitError && (
                    <span style={{ fontSize: 11, color: 'rgb(239,68,68)', marginTop: 4, display: 'block' }}>{quickSubmitError}</span>
                  )}
                </div>
                {/* Type + Priority */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: s.textSecondary, marginBottom: 4 }}>Type</label>
                    <select
                      value={quickSubmitForm.type}
                      onChange={(e) => setQuickSubmitForm(f => ({ ...f, type: e.target.value }))}
                      style={{ width: '100%', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13, outline: 'none' }}
                    >
                      <option value="bug">Bug</option>
                      <option value="broken">Broken</option>
                      <option value="improve">Enhancement</option>
                      <option value="idea">Feature</option>
                      <option value="question">Question</option>
                      <option value="test">Training</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: s.textSecondary, marginBottom: 4 }}>Priority</label>
                    <select
                      value={quickSubmitForm.priority}
                      onChange={(e) => setQuickSubmitForm(f => ({ ...f, priority: e.target.value }))}
                      style={{ width: '100%', background: s.surface, border: `1px solid ${s.border}`, borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13, outline: 'none' }}
                    >
                      <option value="P0">P0 — Critical</option>
                      <option value="P1">P1 — High</option>
                      <option value="P2">P2 — Normal (default)</option>
                      <option value="P3">P3 — Low</option>
                    </select>
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowQuickSubmit(false)}
                    style={{ padding: '8px 18px', borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitQuickForm}
                    disabled={quickSubmitting}
                    style={{
                      padding: '8px 18px', borderRadius: 6, border: 'none', cursor: quickSubmitting ? 'default' : 'pointer',
                      background: quickSubmitting ? 'rgba(239,68,68,0.5)' : 'rgb(239,68,68)', color: '#fff', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {quickSubmitting ? 'Submitting...' : 'Submit to RAIDEN'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ─── TRK-14237: Auto-Triage Modal ─── */}
          {showAutoTriage && (
            <>
              <div
                onClick={() => setShowAutoTriage(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
              />
              <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 201, background: s.bg, borderRadius: 12, border: `1px solid ${s.border}`,
                width: 520, padding: 24, maxHeight: '80vh', overflowY: 'auto',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Icon name="auto_fix_high" size={20} color="rgb(239,68,68)" />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Auto-Triage RAIDEN Queue</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => { setShowAutoTriage(false); setAutoTriageResult(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Icon name="close" size={18} color={s.textMuted} />
                  </button>
                </div>
                {autoTriageLoading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: s.textMuted }}>
                    <span className="material-icons-outlined" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>refresh</span>
                    <div style={{ marginTop: 8 }}>Grouping similar issues by component...</div>
                  </div>
                ) : autoTriageResult ? (
                  <>
                    <div style={{ fontSize: 13, color: s.textSecondary, marginBottom: 16 }}>
                      RAIDEN grouped {(autoTriageResult as Record<string,unknown>).item_count as number || 0} new items. Review and confirm to apply sort.
                    </div>
                    <div style={{ background: s.surface, borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 12, color: s.textSecondary }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {JSON.stringify(autoTriageResult, null, 2)}
                      </pre>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setShowAutoTriage(false); setAutoTriageResult(null) }}
                        style={{ padding: '8px 18px', borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmAutoTriage}
                        style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgb(239,68,68)', color: '#fff', fontSize: 13, fontWeight: 600 }}
                      >
                        Confirm Triage Sort
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: s.textMuted }}>No results</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TRK-14235: RONIN tab content (existing Forge content) ─── */}
      {dojoTab === 'ronin' && <>

      {/* Row 1: Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Icon name="search" size={18} color={s.textMuted} />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            style={{
              width: '100%', background: s.surface, border: `1px solid ${s.border}`,
              borderRadius: 6, padding: '8px 10px 8px 32px', color: s.text, fontSize: 13,
              outline: 'none', marginLeft: -26, paddingLeft: 32,
            }}
          />
        </div>
        {/* View Toggle */}
        <div style={{ display: 'flex', borderRadius: 6, border: `1px solid ${s.border}`, overflow: 'hidden' }}>
          <button
            onClick={() => setView('grid')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'grid' ? s.surface : 'transparent',
              color: view === 'grid' ? s.text : s.textMuted,
            }}
            title="Grid View"
          >
            <Icon name="view_list" size={18} />
          </button>
          <button
            onClick={() => setView('workflow')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'workflow' ? s.surface : 'transparent',
              color: view === 'workflow' ? s.text : s.textMuted,
            }}
            title="Workflow View"
          >
            <Icon name="view_kanban" size={18} />
          </button>
          <button
            onClick={() => setView('sprints')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'sprints' ? s.surface : 'transparent',
              color: view === 'sprints' ? s.text : s.textMuted,
            }}
            title="Sprint View"
          >
            <Icon name="bolt" size={18} />
          </button>
          <button
            onClick={() => { setView('dedup'); loadDedup() }}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'dedup' ? s.surface : 'transparent',
              color: view === 'dedup' ? s.text : s.textMuted,
            }}
            title="DeDup"
          >
            <Icon name="compare_arrows" size={18} />
          </button>
        </div>
        {/* Confirm Walkthrough link */}
        <a
          href="/modules/forge/confirm"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: 'rgba(224,124,62,0.15)', color: '#e07c3e', fontSize: 12,
            fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          <Icon name="verified" size={15} color="#e07c3e" />
          Confirm Walkthrough
        </a>
        <div style={{ flex: 1 }} />
        {selectedIds.size > 0 && (
          <>
            <Select
              value={bulkStatus}
              onChange={setBulkStatus}
              options={STATUSES.map(st => ({ value: st, label: STATUS_CONFIG[st]?.label || st }))}
              placeholder="Bulk status..."
            />
            {bulkStatus && (
              <button
                onClick={bulkUpdateStatus}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'rgb(245,158,11)', color: '#000', fontSize: 13, fontWeight: 600,
                }}
              >
                Apply ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setShowCreateSprint(true)}
              style={{
                padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: s.portal, color: '#fff', fontSize: 13, fontWeight: 600,
              }}
            >
              Create Sprint ({selectedIds.size})
            </button>
          </>
        )}
        <button
          onClick={autoCreateSprint}
          style={{
            padding: '8px 14px', borderRadius: 6, border: `1px solid ${s.border}`, cursor: 'pointer',
            background: 'transparent', color: s.textSecondary, fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = s.border; e.currentTarget.style.color = s.textSecondary }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.background = '#e07c3e'; e.currentTarget.style.borderColor = '#e07c3e'; e.currentTarget.style.color = '#fff' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
        >
          <Icon name="auto_fix_high" size={16} /> Auto Sprint
        </button>
        <button
          onClick={openRoadmap}
          style={{
            padding: '8px 14px', borderRadius: 6, border: `1px solid ${s.border}`, cursor: 'pointer',
            background: 'transparent', color: s.textSecondary, fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = s.border; e.currentTarget.style.color = s.textSecondary }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.background = '#e07c3e'; e.currentTarget.style.borderColor = '#e07c3e'; e.currentTarget.style.color = '#fff' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
        >
          <Icon name="map" size={16} /> Roadmap
        </button>
      </div>

      {/* Back to Sprints breadcrumb when sprint-filtered */}
      {filters.sprint_id && view !== 'sprints' && (
        <button
          onClick={() => { setFilters(f => ({ ...f, sprint_id: '' })); setView('sprints') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
            background: 'none', border: 'none', cursor: 'pointer', color: s.textSecondary,
            fontSize: 13, padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = s.text }}
          onMouseLeave={(e) => { e.currentTarget.style.color = s.textSecondary }}
        >
          <Icon name="arrow_back" size={16} /> Back to Sprints
        </button>
      )}

      {/* Row 2: Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Select
          value={filters.type}
          onChange={(v) => { setFilters(f => ({ ...f, type: v })); setPage(0) }}
          options={TYPES.map(t => ({ value: t, label: TYPE_CONFIG[t]?.label || t }))}
          placeholder="All Types"
        />
        <Select
          value={filters.status}
          onChange={(v) => { setFilters(f => ({ ...f, status: v })); setPage(0) }}
          options={STATUSES.map(st => ({ value: st, label: STATUS_CONFIG[st]?.label || st }))}
          placeholder="All Statuses"
        />
        <Select
          value={filters.portal}
          onChange={(v) => { setFilters(f => ({ ...f, portal: v })); setPage(0) }}
          options={PORTALS.map(p => ({ value: p, label: p }))}
          placeholder="All Portals"
        />
        <Select
          value={filters.scope}
          onChange={(v) => { setFilters(f => ({ ...f, scope: v })); setPage(0) }}
          options={SCOPES.map(sc => ({ value: sc, label: sc }))}
          placeholder="All Scopes"
        />
        <Select
          value={filters.component}
          onChange={(v) => { setFilters(f => ({ ...f, component: v })); setPage(0) }}
          options={components.map(c => ({ value: c, label: c }))}
          placeholder="All Components"
        />
        <Select
          value={filters.sprint_id}
          onChange={(v) => { setFilters(f => ({ ...f, sprint_id: v })); setPage(0) }}
          options={sprints.map(sp => ({ value: sp.id, label: sp.name }))}
          placeholder="All Sprints"
        />
        <Select
          value={filters.reporter}
          onChange={(v) => { setFilters(f => ({ ...f, reporter: v })); setPage(0) }}
          options={reporters.map(r => ({ value: r, label: r }))}
          placeholder="All Reporters"
        />
        {(filters.status || filters.portal || filters.scope || filters.component || filters.sprint_id || filters.type || filters.reporter || search) && (
          <button
            onClick={() => { setFilters({ status: '', portal: '', scope: '', component: '', sprint_id: '', type: '', reporter: '' }); setSearch(''); setPage(0) }}
            style={{
              padding: '6px 12px', borderRadius: 6, border: `1px solid ${s.border}`,
              background: 'transparent', color: s.textSecondary, fontSize: 12, cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>


      {/* ─── DeDup View ─── */}
      {view === 'dedup' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {dedupLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>Scanning for duplicates...</div>
          ) : dedupGroups.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
              <Icon name="check_circle" size={32} color="rgb(34,197,94)" />
              <div style={{ marginTop: 8 }}>No duplicates detected</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: s.textSecondary, marginBottom: 4 }}>
                {dedupGroups.length} potential duplicate group{dedupGroups.length !== 1 ? 's' : ''} found
              </div>
              {dedupGroups.map((group, gi) => {
                const reasonLabel = { exact_match: 'Exact Match', substring_match: 'Substring Match', jaccard_similarity: 'Similar Words' }[group.reason] || group.reason
                const reasonColor = { exact_match: 'rgb(239,68,68)', substring_match: 'rgb(245,158,11)', jaccard_similarity: 'rgb(59,130,246)' }[group.reason] || s.textMuted
                return (
                  <div key={gi} style={{ background: s.surface, borderRadius: 10, border: `1px solid ${s.border}`, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${s.border}` }}>
                      <Icon name="compare_arrows" size={16} color={reasonColor} />
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: `${reasonColor}20`, color: reasonColor }}>{reasonLabel}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => mergeDedup(gi, group.winner.id, group.duplicates.map(d => d.id), [group.winner, ...group.duplicates])}
                        style={{
                          padding: '4px 14px', borderRadius: 6, border: 'none',
                          background: 'rgb(34,197,94)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'all 0.15s',
                        }}
                        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        <Icon name="merge" size={14} color="#fff" /> Merge
                      </button>
                    </div>

                    {/* Field-by-field comparison table */}
                    {(() => {
                      const allItems = [group.winner, ...group.duplicates]
                      const fields: { key: string; label: string }[] = [
                        { key: 'item_id', label: 'ID' },
                        { key: 'title', label: 'Title' },
                        { key: 'description', label: 'Description' },
                        { key: 'type', label: 'Type' },
                        { key: 'status', label: 'Status' },
                        { key: 'portal', label: 'Portal' },
                        { key: 'scope', label: 'Scope' },
                        { key: 'component', label: 'Component' },
                        { key: 'section', label: 'Section' },
                        { key: 'sprint_id', label: 'Sprint' },
                        { key: 'notes', label: 'Notes' },
                        { key: 'created_by', label: 'Created By' },
                        { key: 'created_at', label: 'Created' },
                      ]
                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: s.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${s.border}`, width: 100 }}>Field</th>
                                {allItems.map((item, idx) => (
                                  <th key={idx} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${s.border}`, minWidth: 180 }}>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                                      background: idx === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                      color: idx === 0 ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
                                    }}>{idx === 0 ? 'WINNER' : 'DUPLICATE'}</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: s.textMuted, marginLeft: 8 }}>{item.item_id}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map(field => {
                                const values = allItems.map(item => {
                                  const val = (item as unknown as Record<string, unknown>)[field.key]
                                  if (field.key === 'status') return val as string
                                  if (field.key === 'type') {
                                    const tc = TYPE_CONFIG[val as string]
                                    return tc ? tc.label : (val as string) || '—'
                                  }
                                  if (field.key === 'sprint_id') {
                                    const sp = sprints.find(sp2 => sp2.id === val)
                                    return sp ? sp.name : (val ? String(val) : '—')
                                  }
                                  if (field.key === 'created_at') return formatDate(val as string)
                                  return val ? String(val) : '—'
                                })
                                const allSame = values.every(v => v === values[0])
                                return (
                                  <tr key={field.key} style={{ background: allSame ? 'transparent' : 'rgba(245,158,11,0.04)' }}>
                                    <td style={{ padding: '6px 12px', color: s.textMuted, fontSize: 11, fontWeight: 600, borderBottom: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{field.label}</td>
                                    {values.map((val, idx) => {
                                      const isSelectable = idx > 0 && !allSame && !['item_id', 'created_at', 'created_by'].includes(field.key)
                                      const selectedIdx = (dedupSelections[gi] || {})[field.key]
                                      const isSelected = selectedIdx === idx
                                      const isWinnerDefault = selectedIdx === undefined && idx === 0 && !allSame && !['item_id', 'created_at', 'created_by'].includes(field.key)
                                      return (
                                        <td
                                          key={idx}
                                          onClick={isSelectable ? () => {
                                            setDedupSelections(prev => ({
                                              ...prev,
                                              [gi]: { ...(prev[gi] || {}), [field.key]: idx },
                                            }))
                                          } : idx === 0 && !allSame && !['item_id', 'created_at', 'created_by'].includes(field.key) ? () => {
                                            setDedupSelections(prev => {
                                              const next = { ...prev, [gi]: { ...(prev[gi] || {}) } }
                                              delete next[gi][field.key]
                                              return next
                                            })
                                          } : undefined}
                                          style={{
                                            padding: '6px 12px', borderBottom: `1px solid ${s.border}`,
                                            color: idx === 0 ? s.text : s.textSecondary,
                                            maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                                            cursor: (!allSame && !['item_id', 'created_at', 'created_by'].includes(field.key)) ? 'pointer' : 'default',
                                            background: isSelected ? 'rgba(224,124,62,0.15)' : isWinnerDefault ? 'rgba(34,197,94,0.06)' : 'transparent',
                                            borderLeft: isSelected ? '3px solid #e07c3e' : isWinnerDefault ? '3px solid rgba(34,197,94,0.3)' : '3px solid transparent',
                                            transition: 'all 0.1s',
                                          }}
                                        >
                                          {field.key === 'status' ? <StatusBadge status={val} /> : val}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Sprint Detail View ─── */}
      {view === 'sprint-detail' && (() => {
        const sp = sprintCards.find(c => c.id === selectedSprintId)
        if (!sp) return <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>Sprint not found</div>

        const sprintItems = allItems.filter(i => i.sprint_id === sp.id)
        const activeItems = sprintItems.filter(i => !['deferred', 'wont_fix'].includes(i.status))
        const pct = sp.total > 0 ? Math.round((sp.confirmed / sp.total) * 100) : 0
        const phaseConfig = PHASE_CONFIG[sp.phase]

        const EditableField = ({ field, value, label, textarea, icon }: { field: string; value: string | null; label: string; textarea?: boolean; icon?: string }) => {
          const isEditing = sprintEditField === field
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: s.textMuted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {icon && <Icon name={icon} size={14} color={s.textMuted} />}
                {label}
              </div>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 6, alignItems: textarea ? 'flex-start' : 'center' }}>
                  {textarea ? (
                    <textarea
                      autoFocus
                      value={sprintEditValue}
                      onChange={(e) => setSprintEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelSprintEdit()
                      }}
                      rows={3}
                      style={{
                        flex: 1, background: s.surface, border: `1px solid ${s.portal}`,
                        borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13,
                        outline: 'none', resize: 'vertical',
                      }}
                    />
                  ) : (
                    <input
                      autoFocus
                      type="text"
                      value={sprintEditValue}
                      onChange={(e) => setSprintEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitSprintEdit(sp.id, field)
                        if (e.key === 'Escape') cancelSprintEdit()
                      }}
                      style={{
                        flex: 1, background: s.surface, border: `1px solid ${s.portal}`,
                        borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  )}
                  <button
                    onClick={() => commitSprintEdit(sp.id, field)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: s.portal, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >Save</button>
                  <button
                    onClick={cancelSprintEdit}
                    style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', color: s.textSecondary, fontSize: 12, cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              ) : (
                <div
                  onClick={() => startSprintEdit(field, value || '')}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid transparent`, minHeight: textarea ? 60 : 'auto',
                    color: value ? s.text : s.textMuted, fontSize: 13,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.border; e.currentTarget.style.background = s.surface }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
                >
                  {safeStr(value) || `Click to add ${label.toLowerCase()}...`}
                </div>
              )}
            </div>
          )
        }

        const LinkField = ({ field, value, label, icon }: { field: string; value: string | null; label: string; icon: string }) => {
          const isEditing = sprintEditField === field
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <Icon name={icon} size={18} color={s.textMuted} />
              <span style={{ fontSize: 12, color: s.textSecondary, minWidth: 90 }}>{label}:</span>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center' }}>
                  <input
                    autoFocus
                    type="url"
                    value={sprintEditValue}
                    onChange={(e) => setSprintEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitSprintEdit(sp.id, field)
                      if (e.key === 'Escape') cancelSprintEdit()
                    }}
                    placeholder="Paste URL..."
                    style={{
                      flex: 1, background: s.surface, border: `1px solid ${s.portal}`,
                      borderRadius: 6, padding: '6px 10px', color: s.text, fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <button onClick={() => commitSprintEdit(sp.id, field)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: s.portal, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button onClick={cancelSprintEdit} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', color: s.textSecondary, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : value ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: s.portal, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
                  >{value}</a>
                  <button
                    onClick={(e) => { e.stopPropagation(); startSprintEdit(field, value) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  ><Icon name="edit" size={14} color={s.textMuted} /></button>
                </div>
              ) : (
                <button
                  onClick={() => startSprintEdit(field, '')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: s.textMuted }}
                >+ Add link</button>
              )}
            </div>
          )
        }

        return (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${s.border}`, marginBottom: 16,
            }}>
              <button
                onClick={() => { setView('sprints'); setSelectedSprintId(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: s.textSecondary, fontSize: 13 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = s.text }}
                onMouseLeave={(e) => { e.currentTarget.style.color = s.textSecondary }}
              >
                <Icon name="arrow_back" size={18} /> Back to Sprints
              </button>
              <div style={{ flex: 1 }} />
              {phaseConfig && (
                <span style={{
                  padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: `${phaseConfig.color}20`, color: phaseConfig.color,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{phaseConfig.label}</span>
              )}
              {phaseConfig && (() => {
                const isLoading = actionLoadingSprintId === sp.id
                const isConfirmed = sp.phase === 'confirmed'
                const isReopening = isConfirmed && reopeningSprintId === sp.id
                const phaseIcon = isLoading ? 'sync' :
                  sp.phase === 'unseeded' ? 'fact_check' :
                  sp.phase === 'seeded' ? 'search' :
                  sp.phase === 'disc_audited' ? 'terminal' :
                  sp.phase === 'planned' ? 'fact_check' :
                  sp.phase === 'plan_audited' ? 'terminal' :
                  sp.phase === 'built' ? 'fact_check' :
                  sp.phase === 'audited' ? 'rocket_launch' :
                  sp.phase === 'deployed' ? 'verified' :
                  sp.phase === 'ux_audited' ? 'celebration' :
                  isConfirmed ? 'undo' : 'play_arrow'
                return (
                <button
                  disabled={isLoading || isReopening}
                  onClick={async () => {
                    if (isLoading) return
                    setActionLoadingSprintId(sp.id)
                    try {
                      if (sp.phase === 'unseeded') {
                        await generatePrompt(sp.id, 'seed')
                        showToast('Seeding discovery...', 'success')
                      } else if (sp.phase === 'seeded') {
                        await generatePhaseAudit(sp.id, 'discovery')
                        showToast('Auditing discovery...', 'success')
                      } else if (sp.phase === 'disc_audited') {
                        await generatePrompt(sp.id, 'discovery')
                        showToast('Generating plan...', 'success')
                      } else if (sp.phase === 'planned') {
                        await generatePhaseAudit(sp.id, 'plan')
                        showToast('Auditing plan...', 'success')
                      } else if (sp.phase === 'plan_audited') {
                        await generatePrompt(sp.id, 'building')
                        showToast('Generating build prompt...', 'success')
                      } else if (sp.phase === 'built') {
                        await generateAuditPrompt(sp.id)
                        showToast('Auditing build...', 'success')
                      } else if (sp.phase === 'audited') {
                        const r = await fetchValidated(`${API_BASE}/sprints/${sp.id}/sendit`, { method: 'POST' })
                        if (r.success) {
                          const auditedItems = allItems.filter(i => i.sprint_id === sp.id && i.status === 'audited')
                          if (auditedItems.length > 0) {
                            await fetchValidated(`${API_BASE}/tracker/bulk`, {
                              method: 'PATCH',
                              body: JSON.stringify({ ids: auditedItems.map(i => i.id), updates: { status: 'deployed' } }),
                            })
                          }
                          showToast('Sprint deployed — UX audit ready', 'success')
                          await loadItems(); await loadSprints()
                        } else {
                          showToast('Deploy failed — check logs', 'error')
                        }
                      } else if (sp.phase === 'deployed') {
                        window.location.href = `/modules/forge/audit?sprint=${sp.id}&type=ux`
                      } else if (sp.phase === 'ux_audited') {
                        // Advance all ux_audited items to confirmed
                        const uxItems = allItems.filter(i => i.sprint_id === sp.id && i.status === 'ux_audited')
                        if (uxItems.length > 0) {
                          await fetchValidated(`${API_BASE}/tracker/bulk`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ids: uxItems.map(i => i.id), updates: { status: 'confirmed' } }),
                          })
                        }
                        showToast('#LandedIt!!! — Sprint confirmed', 'success')
                        await loadItems(); await loadSprints()
                      } else if (isConfirmed) {
                        await reopenSprint(sp.id)
                      }
                    } catch (err) {
                      showToast(`Action failed: ${String(err)}`, 'error')
                    } finally {
                      setActionLoadingSprintId(null)
                    }
                  }}
                  style={{
                    padding: '6px 16px', borderRadius: 6,
                    border: isConfirmed ? '1px solid rgb(245,158,11)' : 'none',
                    background: isLoading ? 'rgba(255,255,255,0.08)' : (isConfirmed ? 'transparent' : phaseConfig.color),
                    color: isConfirmed ? 'rgb(245,158,11)' : '#fff',
                    fontSize: 12, fontWeight: 600,
                    cursor: isLoading ? 'wait' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon name={phaseIcon} size={14} color={isConfirmed ? 'rgb(245,158,11)' : '#fff'} />
                  {isLoading ? 'Working...' : phaseConfig.actionLabel}
                </button>
                )
              })()}
              <button
                onClick={() => { setFilters(f => ({ ...f, sprint_id: sp.id })); setView('grid') }}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon name="view_list" size={14} /> Grid View
              </button>
            </div>

            {/* Name (editable) */}
            <EditableField field="name" value={sp.name} label="Sprint Name" icon="bolt" />

            {/* Description (editable) */}
            <EditableField field="description" value={sp.description} label="Description" textarea icon="notes" />

            {/* Doc Links */}
            <div style={{ background: s.surface, borderRadius: 10, border: `1px solid ${s.border}`, padding: '8px 16px', marginBottom: 16 }}>
              <LinkField field="discovery_url" value={sp.discovery_url} label="Discovery Doc" icon="description" />
              <div style={{ borderTop: `1px solid ${s.border}` }} />
              <LinkField field="plan_link" value={sp.plan_link} label="Plan Doc" icon="assignment" />
            </div>

            {/* Metadata */}
            <div style={{ display: 'flex', gap: 24, padding: '8px 0', marginBottom: 16, fontSize: 12, color: s.textSecondary }}>
              <span><strong style={{ color: s.textMuted }}>Created by:</strong> {safeStr(sp.created_by) || '—'}</span>
              <span><strong style={{ color: s.textMuted }}>Created:</strong> {formatDate(sp.created_at)}</span>
              <span><strong style={{ color: s.textMuted }}>Status:</strong> {safeStr(sp.status)}</span>
            </div>

            {/* Phase Stepper — visual pipeline showing current position */}
            <div style={{
              background: s.surface, borderRadius: 10, border: `1px solid ${s.border}`,
              padding: '12px 16px', marginBottom: 16, overflowX: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content' }}>
                {SPRINT_PHASES.map((p, i) => {
                  const pc = PHASE_CONFIG[p]
                  if (!pc) return null
                  const phaseIdx = SPRINT_PHASES.indexOf(sp.phase as typeof SPRINT_PHASES[number])
                  const stepIdx = i
                  const isActive = p === sp.phase
                  const isPast = stepIdx < phaseIdx
                  const isFuture = stepIdx > phaseIdx
                  return (
                    <React.Fragment key={p}>
                      {i > 0 && (
                        <div style={{
                          width: 20, height: 2, flexShrink: 0,
                          background: isPast ? pc.color : 'rgba(255,255,255,0.08)',
                          transition: 'background 0.3s ease',
                        }} />
                      )}
                      <div
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          opacity: isFuture ? 0.35 : 1,
                          transition: 'opacity 0.3s ease',
                        }}
                        title={pc.label}
                      >
                        <div style={{
                          width: isActive ? 28 : 18, height: isActive ? 28 : 18, borderRadius: '50%',
                          background: isPast ? pc.color : (isActive ? pc.color : 'rgba(255,255,255,0.06)'),
                          border: isActive ? `3px solid ${pc.color}` : (isPast ? 'none' : '1px solid rgba(255,255,255,0.12)'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s ease',
                          boxShadow: isActive ? `0 0 12px ${pc.color}40` : 'none',
                        }}>
                          {isPast && <Icon name="check" size={12} color="#fff" />}
                          {isActive && <Icon name="radio_button_checked" size={14} color="#fff" />}
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: isActive ? 700 : 500,
                          color: isActive ? pc.color : (isPast ? s.textSecondary : s.textMuted),
                          whiteSpace: 'nowrap', letterSpacing: '0.02em',
                          transition: 'color 0.3s ease',
                        }}>
                          {pc.label}
                        </span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Unmapped status warning */}
            {(() => {
              const unmapped = sprintItems.filter(i => !(i.status in STATUS_CONFIG))
              if (unmapped.length === 0) return null
              const uniqueStatuses = [...new Set(unmapped.map(i => i.status))]
              return (
                <div style={{
                  background: 'rgba(251,191,36,0.08)', borderRadius: 10,
                  border: '1px solid rgba(251,191,36,0.3)', padding: 12, marginBottom: 16,
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <Icon name="warning" size={18} color="rgb(251,191,36)" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(251,191,36)', marginBottom: 4 }}>
                      {unmapped.length} item{unmapped.length > 1 ? 's' : ''} with unmapped status
                    </div>
                    <div style={{ fontSize: 11, color: s.textSecondary }}>
                      Status values not in The Dojo config: {uniqueStatuses.map(st => `"${st}"`).join(', ')}.
                      These items display with fallback styling and rank as mid-pipeline.
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Progress */}
            <div style={{
              background: s.surface, borderRadius: 10, border: `1px solid ${s.border}`,
              padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: 4,
                    background: pct === 100 ? 'rgb(34,197,94)' : (phaseConfig?.color || s.portal),
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: pct === 100 ? 'rgb(34,197,94)' : s.text }}>{sp.confirmed}/{sp.total}</span>
                <span style={{ fontSize: 11, color: s.textMuted }}>confirmed</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sp.bugs > 0 && <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)', fontWeight: 600 }}>{sp.bugs} bug{sp.bugs > 1 ? 's' : ''}</span>}
                {sp.enhancements > 0 && <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)', fontWeight: 600 }}>{sp.enhancements} enhancement{sp.enhancements > 1 ? 's' : ''}</span>}
                {sp.features > 0 && <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)', fontWeight: 600 }}>{sp.features} feature{sp.features > 1 ? 's' : ''}</span>}
                {sp.questions > 0 && <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: 'rgb(59,130,246)', fontWeight: 600 }}>{sp.questions} question{sp.questions > 1 ? 's' : ''}</span>}
              </div>
            </div>

            {/* Audit Round */}
            {auditRound && (
              <div style={{
                background: s.surface, borderRadius: 10, border: `1px solid ${s.border}`,
                padding: 16, marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.text, marginBottom: 8 }}>
                  Audit Round {auditRound.current_round}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)', fontWeight: 600 }}>{auditRound.passed_count} passed</span>
                  <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)', fontWeight: 600 }}>{auditRound.failed_count} failed</span>
                  <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)', fontWeight: 600 }}>{auditRound.pending_count} pending</span>
                </div>
              </div>
            )}

            {/* Items table */}
            <div style={{
              borderRadius: 10, border: `1px solid ${s.border}`, overflow: 'hidden', flex: 1,
            }}>
              <div style={{
                padding: '10px 16px', borderBottom: `1px solid ${s.border}`, background: s.surface,
                fontSize: 12, fontWeight: 700, color: s.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Items ({sprintItems.length})
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                {sprintItems.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: s.textMuted, fontSize: 13 }}>No items in this sprint</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: s.surface }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Component</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sprintItems.map(item => {
                        const tc = TYPE_CONFIG[item.type]
                        return (
                          <tr
                            key={item.id}
                            onClick={() => openEdit(item)}
                            style={{ cursor: 'pointer', borderBottom: `1px solid ${s.border}` }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = s.hover }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: s.textMuted }}>{item.item_id}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.title}</td>
                            <td style={{ padding: '8px 12px' }}><StatusBadge status={item.status} /></td>
                            <td style={{ padding: '8px 12px' }}>
                              {tc ? <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: tc.bg, color: tc.color }}>{tc.label}</span> : <span style={{ color: s.textMuted }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: s.textSecondary, fontSize: 12 }}>{item.component || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Sprint Kanban View ─── */}
      {view === 'sprints' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          {sprintCards.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
              <Icon name="bolt" size={32} color={s.textMuted} />
              <div style={{ marginTop: 8 }}>No sprints yet — select items and Create Sprint</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, height: '100%', paddingBottom: 8 }}>
              {SPRINT_PHASES.map(phase => {
                const phaseConfig = PHASE_CONFIG[phase]
                const phasesprints = sprintCards.filter(sp => sp.phase === phase)
                return (
                  <div
                    key={phase}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSprintDragOver(phase) }}
                    onDragLeave={() => setSprintDragOver(null)}
                    onDrop={(e) => handleSprintDrop(e, phase)}
                    style={{
                    width: 280, minWidth: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    borderRadius: 10, background: 'rgba(255,255,255,0.01)',
                    border: `1px solid ${sprintDragOver === phase ? (phaseConfig.color) : s.border}`,
                    transition: 'border-color 0.15s',
                  }}>
                    {/* Column header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderBottom: `1px solid ${s.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: phaseConfig.color }} />
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: s.textSecondary }}>
                          {phaseConfig.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: s.surface, color: s.textMuted, fontWeight: 600 }}>
                        {phasesprints.length}
                      </span>
                    </div>

                    {/* Sprint cards */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {phasesprints.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: s.textMuted }}>No sprints</div>
                      ) : phasesprints.map(sp => {
                        const pct = sp.total > 0 ? Math.round((sp.confirmed / sp.total) * 100) : 0
                        return (
                          <div
                            key={sp.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ sprintId: sp.id, fromPhase: phase }))
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            style={{
                              background: s.surface, borderRadius: 8, border: `1px solid ${s.border}`,
                              padding: 14, cursor: 'grab',
                            }}
                            onClick={() => openSprintDetail(sp.id)}
                          >
                            {/* Name + RONIN badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <Icon name="bolt" size={16} color="rgb(245,158,11)" />
                              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{sp.name}</span>
                              {/* TRK-14235: RONIN attribution badge */}
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                                background: 'rgba(74,122,181,0.12)', color: 'rgba(74,122,181,0.8)',
                                letterSpacing: '0.06em',
                              }}>
                                <span className="material-icons-outlined" style={{ fontSize: 10 }}>precision_manufacturing</span>
                                RONIN
                              </span>
                            </div>

                            {/* Description */}
                            {sp.description && (
                              <div style={{ fontSize: 11, color: s.textMuted, marginBottom: 8, lineHeight: 1.4 }}>{sp.description}</div>
                            )}

                            {/* Discovery URL */}
                            {sp.discovery_url && (
                              <a
                                href={sp.discovery_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 10, color: s.portal, marginBottom: 8, textDecoration: 'none',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget.style.textDecoration = 'underline') }}
                                onMouseLeave={(e) => { (e.currentTarget.style.textDecoration = 'none') }}
                              >
                                <Icon name="link" size={12} color={s.portal} />
                                Discovery
                              </a>
                            )}

                            {/* Progress */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                                <div style={{
                                  width: `${pct}%`, height: '100%', borderRadius: 2,
                                  background: pct === 100 ? 'rgb(34,197,94)' : phaseConfig.color,
                                  transition: 'width 0.3s',
                                }} />
                              </div>
                              <span style={{ fontSize: 10, color: s.textMuted }}>{sp.confirmed}/{sp.total}</span>
                            </div>

                            {/* Type pills */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                              {sp.bugs > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)', fontWeight: 600 }}>{sp.bugs} bug{sp.bugs > 1 ? 's' : ''}</span>}
                              {sp.enhancements > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)', fontWeight: 600 }}>{sp.enhancements} enh</span>}
                              {sp.features > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)', fontWeight: 600 }}>{sp.features} feat</span>}
                              {sp.questions > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', color: 'rgb(59,130,246)', fontWeight: 600 }}>{sp.questions} q</span>}
                            </div>

                            {/* Phase action button */}
                            {(() => {
                              const isLoading = actionLoadingSprintId === sp.id
                              const isConfirmed = phase === 'confirmed'
                              const isReopening = isConfirmed && reopeningSprintId === sp.id
                              const phaseIcon = isLoading ? 'sync' :
                                phase === 'unseeded' ? 'fact_check' :
                                phase === 'seeded' ? 'search' :
                                phase === 'disc_audited' ? 'terminal' :
                                phase === 'planned' ? 'fact_check' :
                                phase === 'plan_audited' ? 'terminal' :
                                phase === 'built' ? 'fact_check' :
                                phase === 'audited' ? 'rocket_launch' :
                                phase === 'deployed' ? 'verified' :
                                phase === 'ux_audited' ? 'celebration' :
                                isConfirmed ? 'undo' : 'play_arrow'
                              return (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (isLoading) return
                                  setActionLoadingSprintId(sp.id)
                                  try {
                                    if (phase === 'unseeded') {
                                      await generatePrompt(sp.id, 'seed')
                                      showToast(`${sp.name}: Seeding discovery...`, 'success')
                                    } else if (phase === 'seeded') {
                                      await generatePhaseAudit(sp.id, 'discovery')
                                      showToast(`${sp.name}: Auditing discovery...`, 'success')
                                    } else if (phase === 'disc_audited') {
                                      await generatePrompt(sp.id, 'discovery')
                                      showToast(`${sp.name}: Generating plan...`, 'success')
                                    } else if (phase === 'planned') {
                                      await generatePhaseAudit(sp.id, 'plan')
                                      showToast(`${sp.name}: Auditing plan...`, 'success')
                                    } else if (phase === 'plan_audited') {
                                      await generatePrompt(sp.id, 'building')
                                      showToast(`${sp.name}: Generating build prompt...`, 'success')
                                    } else if (phase === 'built') {
                                      await generateAuditPrompt(sp.id)
                                      showToast(`${sp.name}: Auditing build...`, 'success')
                                    } else if (phase === 'audited') {
                                      const r = await fetchValidated(`${API_BASE}/sprints/${sp.id}/sendit`, { method: 'POST' })
                                      if (r.success) {
                                        const auditedItems = allItems.filter(i => i.sprint_id === sp.id && i.status === 'audited')
                                        if (auditedItems.length > 0) {
                                          await fetchValidated(`${API_BASE}/tracker/bulk`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ ids: auditedItems.map(i => i.id), updates: { status: 'deployed' } }),
                                          })
                                        }
                                        showToast(`${sp.name}: Deployed — UX audit ready`, 'success')
                                        await loadItems(); await loadSprints()
                                      } else {
                                        showToast(`${sp.name}: Deploy failed — check logs`, 'error')
                                      }
                                    } else if (phase === 'deployed') {
                                      window.location.href = `/modules/forge/audit?sprint=${sp.id}&type=ux`
                                    } else if (phase === 'ux_audited') {
                                      const uxItems = allItems.filter(i => i.sprint_id === sp.id && i.status === 'ux_audited')
                                      if (uxItems.length > 0) {
                                        await fetchValidated(`${API_BASE}/tracker/bulk`, {
                                          method: 'PATCH',
                                          body: JSON.stringify({ ids: uxItems.map(i => i.id), updates: { status: 'confirmed' } }),
                                        })
                                      }
                                      showToast(`${sp.name}: #LandedIt!!! — Sprint confirmed`, 'success')
                                      await loadItems(); await loadSprints()
                                    } else if (isConfirmed) {
                                      await reopenSprint(sp.id)
                                    }
                                  } catch (err) {
                                    showToast(`${sp.name}: Action failed: ${String(err)}`, 'error')
                                  } finally {
                                    setActionLoadingSprintId(null)
                                  }
                                }}
                                disabled={isLoading || isReopening}
                                style={{
                                  width: '100%', padding: '6px 0', borderRadius: 6,
                                  border: isConfirmed ? '1px solid rgb(245,158,11)' : 'none',
                                  background: isLoading ? 'rgba(255,255,255,0.08)' : (isConfirmed
                                    ? (isReopening ? 'rgb(245,158,11)' : 'transparent')
                                    : phaseConfig.color),
                                  color: isConfirmed
                                    ? (isReopening ? '#fff' : 'rgb(245,158,11)')
                                    : '#fff',
                                  fontSize: 12, fontWeight: 600,
                                  cursor: (isLoading || isReopening) ? 'wait' : 'pointer',
                                  opacity: isLoading ? 0.7 : 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Icon name={phaseIcon} size={14} color={isConfirmed ? (isReopening ? '#fff' : 'rgb(245,158,11)') : '#fff'} />
                                {isLoading ? 'Working...' : (isReopening ? 'Reopening...' : phaseConfig.actionLabel)}
                              </button>
                              )
                            })()}

                            {/* Audit Walkthrough link for sprints ready for/in audit */}
                            {(phase === 'built' || phase === 'audited' || phase === 'deployed') && (
                              <a
                                href={`/modules/forge/audit?sprint=${sp.id}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%', padding: '5px 0', borderRadius: 6,
                                  border: `1px solid #e07c3e`, marginTop: 4,
                                  background: 'transparent', color: '#e07c3e', fontSize: 11, fontWeight: 600,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  textDecoration: 'none',
                                }}
                              >
                                <Icon name="fact_check" size={13} color="#e07c3e" />
                                Audit Walkthrough
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Workflow (Kanban) View ─── */}
      {view === 'workflow' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <KanbanBoard columns={kanbanColumns} emptyMessage="No items match your filters" onCardMove={handleCardMove} />
        </div>
      )}

      {/* ─── Grid View ─── */}
      {view === 'grid' && <>
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 8, border: `1px solid ${s.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: s.surface, position: 'sticky', top: 0, zIndex: 5 }}>
              <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={pagedItems.length > 0 && selectedIds.size === pagedItems.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {[
                { key: 'item_id', label: 'ID' },
                { key: 'type', label: 'Type' },
                { key: 'title', label: 'Title' },
                { key: 'component', label: 'Component' },
                { key: 'section', label: 'Section' },
                { key: 'portal', label: 'Portal' },
                { key: 'status', label: 'Status' },
                { key: 'sprint_id', label: 'Sprint' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => {
                    if (sortField === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    else { setSortField(col.key); setSortDir('asc') }
                    setPage(0)
                  }}
                  style={{
                    padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                    color: sortField === col.key ? s.text : s.textSecondary,
                    userSelect: 'none',
                  }}
                >
                  {col.label} {sortField === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>Loading...</td></tr>
            ) : pagedItems.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
                <Icon name="inventory_2" size={32} color={s.textMuted} />
                <div style={{ marginTop: 8 }}>No items found</div>
              </td></tr>
            ) : pagedItems.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status]
              const borderColor = statusCfg ? statusCfg.color : s.textMuted
              const selected = selectedIds.has(item.id)
              const sprintName = sprints.find(sp => sp.id === item.sprint_id)?.name || '—'
              return (
                <tr
                  key={item.id}
                  onClick={() => openEdit(item)}
                  style={{
                    cursor: 'pointer',
                    borderLeft: `3px solid ${borderColor}`,
                    background: selected ? 'rgba(74,122,181,0.08)' : 'transparent',
                    borderBottom: `1px solid ${s.border}`,
                  }}
                  onMouseEnter={(e) => { if (!selected) (e.currentTarget.style.background = s.hover) }}
                  onMouseLeave={(e) => { if (!selected) (e.currentTarget.style.background = 'transparent') }}
                >
                  <td style={{ padding: '8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', color: s.textMuted, fontFamily: 'monospace', fontSize: 11 }}>{item.item_id}</td>
                  <td style={{ padding: '8px 12px' }}>{(() => {
                    const tc = TYPE_CONFIG[item.type]
                    return tc ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.color, whiteSpace: 'nowrap' }}>{tc.label}</span> : <span style={{ color: s.textMuted, fontSize: 11 }}>—</span>
                  })()}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {item.title}
                      {item.discovery_url && (
                        <a href={item.discovery_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Discovery URL">
                          <Icon name="link" size={14} color={s.portal} />
                        </a>
                      )}
                      {item.plan_link && (
                        <a href={item.plan_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Plan Link">
                          <Icon name="description" size={14} color="rgb(245,158,11)" />
                        </a>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary }}>{safeStr(item.component) || '—'}</td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary }}>{safeStr(item.section) || '—'}</td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary, fontSize: 11 }}>{safeStr(item.portal) || '—'}</td>
                  <td style={{ padding: '8px 12px' }}><StatusBadge status={item.status} /></td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary, fontSize: 12 }}>{sprintName}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0', fontSize: 12, color: s.textSecondary,
      }}>
        <span>
          Showing {items.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, items.length)} of {items.length}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '4px 12px', borderRadius: 6, border: `1px solid ${s.border}`,
              background: 'transparent', color: page === 0 ? s.textMuted : s.textSecondary,
              cursor: page === 0 ? 'default' : 'pointer', fontSize: 12,
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: '4px 12px', borderRadius: 6, border: `1px solid ${s.border}`,
              background: 'transparent', color: page >= totalPages - 1 ? s.textMuted : s.textSecondary,
              cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 12,
            }}
          >
            Next
          </button>
        </div>
      </div>
      </>}

      {/* ─── Edit Slide-Out ─── */}
      {editItem && (
        <>
          <div
            onClick={closeEdit}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40,
            }}
          />
          <div
            onPaste={handlePaste}
            style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 50,
            background: s.bg, borderLeft: `1px solid ${s.border}`,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${s.border}`,
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: s.textMuted }}>{editForm.item_id}</span>
              <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.textMuted }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <FormInput label="Title" value={editForm.title || ''} onChange={(v) => setEditForm(f => ({ ...f, title: v }))} />
              <FormInput label="Description" value={editForm.description || ''} onChange={(v) => setEditForm(f => ({ ...f, description: v }))} textarea />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormSelect label="Portal" value={editForm.portal || ''} onChange={(v) => setEditForm(f => ({ ...f, portal: v }))}
                  options={PORTALS.map(p => ({ value: p, label: p }))} />
                <FormSelect label="Scope" value={editForm.scope || ''} onChange={(v) => setEditForm(f => ({ ...f, scope: v }))}
                  options={SCOPES.map(sc => ({ value: sc, label: sc }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormSelect label="Type" value={editForm.type || ''} onChange={(v) => setEditForm(f => ({ ...f, type: v }))}
                  options={TYPES.map(t => ({ value: t, label: TYPE_CONFIG[t]?.label || t }))} />
                <FormSelect label="Status" value={editForm.status || ''} onChange={(v) => setEditForm(f => ({ ...f, status: v }))}
                  options={STATUSES.map(st => ({ value: st, label: STATUS_CONFIG[st]?.label || st }))} />
              </div>
              <FormInput label="Component" value={editForm.component || ''} onChange={(v) => setEditForm(f => ({ ...f, component: v }))} />
              <FormInput label="Section" value={editForm.section || ''} onChange={(v) => setEditForm(f => ({ ...f, section: v }))} />
              <FormSelect label="Sprint" value={editForm.sprint_id || ''} onChange={(v) => setEditForm(f => ({ ...f, sprint_id: v || null }))}
                options={sprints.map(sp => ({ value: sp.id, label: sp.name }))} />
              {/* Discovery URL */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Discovery URL</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span className="material-icons-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted, #64748b)' }}>link</span>
                    <input
                      type="url"
                      placeholder="Where was this found? (URL)"
                      value={editForm.discovery_url || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, discovery_url: e.target.value || null }))}
                      style={{
                        width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
                        borderRadius: 6, padding: '8px 10px 8px 30px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                  {editForm.discovery_url && (
                    <a href={editForm.discovery_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      title="Open Discovery URL"
                    >
                      <Icon name="open_in_new" size={16} color={s.portal} />
                    </a>
                  )}
                </div>
              </div>
              {/* Plan Link */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Plan Link</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span className="material-icons-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted, #64748b)' }}>description</span>
                    <input
                      type="url"
                      placeholder="Link to plan document (URL)"
                      value={editForm.plan_link || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, plan_link: e.target.value || null }))}
                      style={{
                        width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
                        borderRadius: 6, padding: '8px 10px 8px 30px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                  {editForm.plan_link && (
                    <a href={editForm.plan_link} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      title="Open Plan Link"
                    >
                      <Icon name="open_in_new" size={16} color={s.portal} />
                    </a>
                  )}
                </div>
              </div>
              <FormInput label="Notes" value={editForm.notes || ''} onChange={(v) => setEditForm(f => ({ ...f, notes: v }))} textarea />

              {/* Attachments */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: s.textSecondary, marginBottom: 6 }}>
                  Attachments {uploading && <span style={{ color: 'rgb(245,158,11)' }}> — uploading...</span>}
                </label>

                {/* Existing thumbnails */}
                {(editItem?.attachments || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {(editItem?.attachments || []).map((att) => {
                      const isImage = att.content_type?.startsWith('image/')
                      return (
                        <div key={att.name} style={{
                          position: 'relative', width: 96, borderRadius: 6,
                          border: `1px solid ${s.border}`, overflow: 'hidden', background: s.surface,
                        }}>
                          {isImage ? (
                            <a href={att.url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={att.url}
                                alt={att.original_name}
                                style={{ width: 96, height: 72, objectFit: 'cover', display: 'block' }}
                              />
                            </a>
                          ) : (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 96, height: 72, textDecoration: 'none',
                            }}>
                              <Icon name="attach_file" size={24} color={s.textMuted} />
                            </a>
                          )}
                          <div style={{ padding: '4px 6px', fontSize: 9, color: s.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.original_name} ({formatSize(att.size)})
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAttachment(att.name) }}
                            style={{
                              position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                              borderRadius: '50%', border: 'none', cursor: 'pointer',
                              background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*,.pdf,.txt,.json'
                    input.multiple = true
                    input.onchange = () => {
                      if (input.files) Array.from(input.files).forEach(f => uploadAttachment(f))
                    }
                    input.click()
                  }}
                  style={{
                    border: `2px dashed ${dragOver ? '#e07c3e' : s.border}`,
                    borderRadius: 8, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'rgba(224,124,62,0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon name="cloud_upload" size={22} color={dragOver ? '#e07c3e' : s.textMuted} />
                  <div style={{ fontSize: 12, color: s.textMuted, marginTop: 4 }}>
                    Drop files, paste screenshots (Cmd+V), or click to browse
                  </div>
                  <div style={{ fontSize: 10, color: s.textMuted, marginTop: 2 }}>Max 5MB per file, 10 per item</div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${s.border}` }}>
                <div style={{ fontSize: 11, color: s.textMuted, marginBottom: 4 }}>Created: {formatDate(editItem.created_at)} by {safeStr(editItem.created_by) || '—'}</div>
                <div style={{ fontSize: 11, color: s.textMuted }}>Updated: {formatDate(editItem.updated_at)}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
              borderTop: `1px solid ${s.border}`,
            }}>
              <button
                onClick={deleteItem}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: '1px solid rgb(239,68,68)',
                  background: 'transparent', color: 'rgb(239,68,68)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Delete
              </button>
              {editItem?.status !== 'confirmed' ? (
                <button
                  onClick={confirmItem}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: 'rgb(34,197,94)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="check_circle" size={16} color="#fff" /> Confirm
                </button>
              ) : (
                <button
                  onClick={unconfirmItem}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: '1px solid rgb(245,158,11)',
                    background: 'transparent', color: 'rgb(245,158,11)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="undo" size={16} color="rgb(245,158,11)" /> Unconfirm
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={closeEdit}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: s.portal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Create Sprint Modal ─── */}
      {showCreateSprint && (
        <>
          <div
            onClick={() => setShowCreateSprint(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 440, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
            padding: 24, zIndex: 60,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Create Sprint</span>
              <button onClick={() => setShowCreateSprint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: s.textSecondary, marginBottom: 16 }}>
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} will be assigned to this sprint.
            </p>
            <FormInput label="Sprint Name" value={sprintForm.name} onChange={(v) => setSprintForm(f => ({ ...f, name: v }))} />
            <FormInput label="Description" value={sprintForm.description} onChange={(v) => setSprintForm(f => ({ ...f, description: v }))} textarea />
            {/* Discovery URL */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Discovery URL</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span className="material-icons-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted, #64748b)' }}>link</span>
                  <input
                    type="url"
                    placeholder="Where was this found? (URL)"
                    value={sprintForm.discovery_url}
                    onChange={(e) => setSprintForm(f => ({ ...f, discovery_url: e.target.value }))}
                    style={{
                      width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
                      borderRadius: 6, padding: '8px 10px 8px 30px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                {sprintForm.discovery_url && (
                  <a href={sprintForm.discovery_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                    title="Open Discovery URL"
                  >
                    <Icon name="open_in_new" size={16} color={s.portal} />
                  </a>
                )}
              </div>
            </div>
            {/* ─── Discovery Import Section ─── */}
            <div style={{ marginTop: 16, borderTop: `1px solid ${s.border}`, paddingTop: 16 }}>
              <button
                onClick={() => setShowDiscoveryImport(!showDiscoveryImport)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: s.textSecondary, fontSize: 13,
                }}
              >
                <Icon name={showDiscoveryImport ? 'expand_less' : 'expand_more'} size={18} color={s.textSecondary} />
                <Icon name="description" size={16} color={s.portal} />
                Or Import from Discovery Document
              </button>

              {showDiscoveryImport && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    placeholder="Paste discovery markdown here, or drop a .md/.txt file..."
                    value={discoveryContent}
                    onChange={(e) => setDiscoveryContent(e.target.value)}
                    onDrop={handleDiscoveryDrop}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      width: '100%', minHeight: 120, background: s.surface,
                      border: `1px solid ${s.border}`, borderRadius: 8, padding: 12,
                      color: s.text, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5,
                      resize: 'vertical', outline: 'none',
                    }}
                  />

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={previewDiscovery}
                      disabled={!discoveryContent.trim() || discoveryPreviewing}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: `1px solid ${s.border}`,
                        background: 'transparent', color: !discoveryContent.trim() ? s.textMuted : s.textSecondary,
                        fontSize: 12, cursor: !discoveryContent.trim() ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {discoveryPreviewing ? 'Previewing...' : 'Preview'}
                    </button>
                    {discoveryPreview && (
                      <button
                        onClick={importDiscovery}
                        disabled={discoveryImporting}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: s.portal, color: '#fff',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {discoveryImporting ? 'Importing...' : `Import ${discoveryPreview.items_created} Items`}
                      </button>
                    )}
                  </div>

                  {discoveryPreview && (
                    <div style={{
                      marginTop: 12, padding: 12, borderRadius: 8,
                      background: s.surface, border: `1px solid ${s.border}`,
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: s.text }}>
                        {String(discoveryPreview.sprint_name || '')}
                      </p>
                      <p style={{ fontSize: 11, color: s.textMuted, marginTop: 4 }}>
                        {String(discoveryPreview.items_created || 0)} items found
                      </p>
                      <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                        {(discoveryPreview.items as Array<Record<string, unknown>> | undefined)?.slice(0, 10).map((item: Record<string, unknown>, i: number) => (
                          <li key={i} style={{ fontSize: 11, color: s.textSecondary, marginTop: 2 }}>
                            {String(item.title || item.item_id || `Item ${i + 1}`)}
                          </li>
                        ))}
                        {((discoveryPreview.items as Array<Record<string, unknown>> | undefined)?.length || 0) > 10 && (
                          <li style={{ fontSize: 11, color: s.textMuted, marginTop: 2 }}>
                            ...and {(discoveryPreview.items as Array<Record<string, unknown>>).length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setShowCreateSprint(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={createSprint}
                disabled={!sprintForm.name.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: !sprintForm.name.trim() ? s.textMuted : s.portal,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: !sprintForm.name.trim() ? 'default' : 'pointer',
                }}
              >
                Create Sprint
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Prompt Generator Modal ─── */}
      {showPrompt && (
        <>
          <div
            onClick={() => setShowPrompt(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 640, maxHeight: '80vh', background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12, padding: 24, zIndex: 60, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Sprint Prompt</span>
              <button onClick={() => setShowPrompt(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>
            <textarea
              readOnly
              value={promptText}
              style={{
                flex: 1, minHeight: 320, width: '100%', background: s.surface,
                border: `1px solid ${s.border}`, borderRadius: 8, padding: 16,
                color: s.text, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setShowPrompt(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={printPrompt}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon name="print" size={14} color={s.textSecondary} /> Print / PDF
              </button>
              <button
                onClick={copyPrompt}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: '#e07c3e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon name="content_copy" size={14} color="#fff" /> Copy to Clipboard
              </button>
            </div>
          </div>
        </>
      )}
      {/* End RONIN tab */}
      </>}
    </div>
  )
}

export function Forge(props: ForgeProps) {
  return <ForgeErrorBoundary><ForgeInner {...props} /></ForgeErrorBoundary>
}
