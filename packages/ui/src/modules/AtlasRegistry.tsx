'use client'

import { useState, useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import {
  WIRE_DEFINITIONS, getWireStats, computeAutomationHealth, getAutomationSummary,
  type WireDefinition, type AutomationEntry, type AutomationHealth, type AtlasSource, type AtlasTool,
} from '@tomachina/core'
import { WireDiagram } from '../components/WireDiagram'

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

type Tab = 'sources' | 'tools' | 'pipeline' | 'health' | 'audit'

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

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'sources', label: 'Sources', icon: 'hub' },
  { key: 'tools', label: 'Tools', icon: 'build' },
  { key: 'pipeline', label: 'Pipeline', icon: 'route' },
  { key: 'health', label: 'Health', icon: 'monitor_heart' },
  { key: 'audit', label: 'Audit', icon: 'history' },
]

const CAT_COLORS: Record<string, string> = {
  INTAKE_QUEUING: 'rgb(245,158,11)', EXTRACTION_APPROVAL: 'rgb(124,92,255)',
  NORMALIZATION_VALIDATION: 'rgb(16,185,129)', MATCHING_DEDUP: 'rgb(59,130,246)',
  EXTERNAL_ENRICHMENT: 'rgb(168,85,247)', BULK_OPERATIONS: 'rgb(249,115,22)',
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

// ---------------------------------------------------------------------------
// AtlasRegistry
// ---------------------------------------------------------------------------

export function AtlasRegistry({ portal }: { portal?: string }) {
  const srcQ = useMemo<Query<DocumentData>>(() => query(collections.sourceRegistry()), [])
  const { data: sources, loading, error } = useCollection<SourceRecord>(srcQ, `atlas-src-${portal || 'all'}`)
  const [activeTab, setActiveTab] = useState<Tab>('sources')

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
      {/* Pill Tab Bar */}
      <div className="mt-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all"
            style={{ background: activeTab === t.key ? 'var(--portal)' : 'var(--bg-surface)', color: activeTab === t.key ? '#fff' : 'var(--text-muted)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {activeTab === 'sources' && <SourcesTab sources={sources} />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'pipeline' && <PipelineTab />}
        {activeTab === 'health' && <HealthTab sources={sources} />}
        {activeTab === 'audit' && <AuditTab />}
      </div>
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
