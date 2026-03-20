'use client'

import { useState, useMemo } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueSource {
  que_source_id: string
  source_name: string
  product_lines: string[]
  adapter_type: string
  adapter_config: Record<string, unknown>
  input_schema: Record<string, string>
  output_schema: Record<string, string>
  automation_level: string
  current_method: string
  target_method: string
  automation_pct: number
  gap_status: string
  status: string
}

interface QueSession {
  session_id: string
  profile_id: string
  product_line: string
  status: string
  created_at: string
}

type Section = 'import' | 'registry' | 'ops'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'import', label: 'Import', icon: 'download' },
  { key: 'registry', label: 'Registry', icon: 'hub' },
  { key: 'ops', label: 'OPS', icon: 'monitoring' },
]

const PRODUCT_LINE_FILTERS = ['All', 'LIFE', 'ANNUITY', 'MEDICARE', 'INVESTMENT'] as const
const GAP_FILTERS = ['All', 'GREEN', 'YELLOW', 'RED'] as const
const API_BASE = '/api'

const SUPER_TOOL_STEPS = [
  { id: 'QUE_GATHER', label: 'Gather', icon: 'folder_open', desc: 'Pull household data + ACF docs + extract contract terms' },
  { id: 'QUE_QUOTE', label: 'Quote', icon: 'request_quote', desc: 'Execute quotes against registered sources' },
  { id: 'QUE_COMPARE', label: 'Compare', icon: 'compare_arrows', desc: 'Score, rank, and tax-adjust quotes' },
  { id: 'QUE_RECOMMEND', label: 'Recommend', icon: 'thumb_up', desc: 'Build recommendation + generate casework output' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gapColor(gap?: string) {
  const g = (gap || '').toUpperCase()
  if (g === 'GREEN') return { bg: 'rgba(16,185,129,0.15)', text: 'rgb(16,185,129)', label: 'Automated' }
  if (g === 'YELLOW') return { bg: 'rgba(245,158,11,0.15)', text: 'rgb(245,158,11)', label: 'Semi-Auto' }
  if (g === 'RED') return { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)', label: 'Manual' }
  return { bg: 'var(--bg-surface)', text: 'var(--text-muted)', label: gap || 'Unknown' }
}

function srcStats(sources: QueSource[]) {
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
// Sub-Components
// ---------------------------------------------------------------------------

function Hdr({ sub }: { sub: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">QUE Engine</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s quoting engine &mdash; {sub}</p>
    </div>
  )
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

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: bg, color: fg }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: fg }} />{text}
    </span>
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
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{value || '-'}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Tab — QUE Data Flow Diagram
// ---------------------------------------------------------------------------

function ImportTab() {
  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-start gap-3">
          <span className="material-icons-outlined mt-0.5" style={{ fontSize: '24px', color: 'var(--portal)' }}>schema</span>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">QUE Data Flow</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              QUE reads from Firestore (households, accounts) and Google Drive (ACF documents).
              Blue Stage (ATLAS) imports the data. QUE consumes it.
            </p>
          </div>
        </div>
      </div>

      {/* Super Tool Pipeline */}
      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>route</span>
          QUE_GATHER Super Tool Pipeline
        </h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">The Casework Wire chains these 4 super tools in sequence.</p>

        <div className="mt-4 flex items-start gap-2">
          {SUPER_TOOL_STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-start gap-2">
              <div className="flex w-40 flex-col items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: 'rgba(var(--portal-rgb, 74, 122, 181), 0.12)' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>{step.icon}</span>
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--text-primary)]">{step.label}</p>
                <p className="mt-1 text-[10px] leading-tight text-[var(--text-muted)]">{step.desc}</p>
              </div>
              {idx < SUPER_TOOL_STEPS.length - 1 && (
                <div className="flex h-12 items-center">
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '20px' }}>arrow_forward</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Wire Descriptions */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'rgb(245,158,11)' }}>cable</span>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Casework Wire</h4>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Complete Yellow Stage Phase 1: Gather household data, execute quotes against all registered sources,
            score and rank results, then build the recommendation package.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {['QUE_GATHER', 'QUE_QUOTE', 'QUE_COMPARE', 'QUE_RECOMMEND'].map((t) => (
              <span key={t} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{t}</span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'rgb(168,85,247)' }}>cable</span>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Assemble B4 Wire</h4>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Generate 5 Yellow Stage outputs (AI3, reports, illustrations, casework summary, factfinder)
            and file everything to the household ACF B4 Recommendations folder.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {['generate-ai3', 'collect-reports', 'generate-casework', 'generate-factfinder', 'html-to-pdf', 'file-to-acf'].map((t) => (
              <span key={t} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registry Tab — QUE Sources Table
// ---------------------------------------------------------------------------

function RegistryTab() {
  const [sources, setSources] = useState<QueSource[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prodF, setProdF] = useState('All')
  const [gapF, setGapF] = useState('All')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<QueSource | null>(null)
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null)

  // Fetch sources on first render
  const loadSources = async () => {
    if (loaded) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`${API_BASE}/que/admin/sources`)
      const json = await res.json() as { success: boolean; data?: QueSource[]; error?: string }
      if (json.success && json.data) {
        setSources(Array.isArray(json.data) ? json.data : [])
      } else {
        setError(json.error || 'Failed to load sources')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  // Load on mount
  if (!loaded && !loading) {
    loadSources()
  }

  const filtered = useMemo(() => sources.filter((s) => {
    if (prodF !== 'All' && !s.product_lines.includes(prodF)) return false
    if (gapF !== 'All' && (s.gap_status || '').toUpperCase() !== gapF) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.source_name.toLowerCase().includes(q) && !s.que_source_id.toLowerCase().includes(q)) return false
    }
    return true
  }), [sources, prodF, gapF, search])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <span className="material-icons-outlined text-3xl" style={{ color: 'rgb(239,68,68)' }}>error</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p>
        <button onClick={() => { setLoaded(false); setError(null) }}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all"
          style={{ background: 'var(--portal)' }}>
          Retry
        </button>
      </div>
    )
  }

  if (sources.length === 0) {
    return <Empty icon="hub" title="QUE Source Registry" desc="Run the seed-que script to populate. Quoting sources (CSG, WinFlex, ARW, carriers) will appear here." />
  }

  const stats = srcStats(sources)

  return (
    <div>
      {/* Stats Row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon="hub" label="Total Sources" val={stats.total} />
        <Stat icon="speed" label="Avg Automation" val={`${stats.avgAuto}%`} accent />
        <Stat icon="check_circle" label="GREEN" val={stats.gaps['GREEN'] || 0} color="rgb(16,185,129)" />
        <Stat icon="warning" label="YELLOW" val={stats.gaps['YELLOW'] || 0} color="rgb(245,158,11)" />
        <Stat icon="error" label="RED" val={stats.gaps['RED'] || 0} color="rgb(239,68,68)" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Search value={search} onChange={setSearch} placeholder="Search source..." />
        <div className="flex flex-wrap gap-1">
          {PRODUCT_LINE_FILTERS.map((p) => <Pill key={p} label={p === 'All' ? 'All Products' : p} active={prodF === p} onClick={() => setProdF(p)} />)}
        </div>
        <div className="flex flex-wrap gap-1">
          {GAP_FILTERS.map((g) => <Pill key={g} label={g === 'All' ? 'All Status' : g} active={gapF === g} onClick={() => setGapF(g)} />)}
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{filtered.length} of {sources.length} sources</p>

      {/* Table + Detail Panel */}
      <div className="mt-3 flex gap-4">
        <div className={sel ? 'flex-1 min-w-0' : 'w-full'}>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
                  <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-3">Source Name</th>
                    <th className="px-3 py-3">Product Lines</th>
                    <th className="px-3 py-3">Adapter</th>
                    <th className="px-3 py-3">Automation</th>
                    <th className="px-3 py-3">Gap</th>
                    <th className="px-3 py-3">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-sm text-[var(--text-muted)]">No sources match filters.</td></tr>
                  ) : filtered.map((s) => {
                    const gc = gapColor(s.gap_status)
                    const isExpanded = expandedConfig === s.que_source_id
                    return (
                      <tr key={s.que_source_id}
                        onClick={() => setSel(sel?.que_source_id === s.que_source_id ? null : s)}
                        className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]"
                        style={sel?.que_source_id === s.que_source_id ? { background: 'var(--bg-surface)' } : undefined}>
                        <td className="px-4 py-2.5">
                          <p className="truncate font-medium text-[var(--text-primary)]" style={{ maxWidth: '220px' }}>{s.source_name}</p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]" style={{ maxWidth: '220px' }}>{s.que_source_id}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {s.product_lines.map((pl) => (
                              <span key={pl} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{pl}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{s.adapter_type}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(s.automation_pct, 100)}%`,
                                background: s.automation_pct >= 75 ? 'rgb(16,185,129)' : s.automation_pct >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)',
                              }} />
                            </div>
                            <span className="text-[11px] text-[var(--text-muted)]">{s.automation_pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><Badge text={s.gap_status || '-'} bg={gc.bg} fg={gc.text} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                            <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5">{s.current_method}</span>
                            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>arrow_forward</span>
                            <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5">{s.target_method}</span>
                          </div>
                        </td>
                      </tr>
                    )
                    // Note: isExpanded is available for future inline expand feature
                    void isExpanded
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {sel && (
          <div className="w-80 shrink-0 rounded-xl border border-[var(--portal)] bg-[var(--bg-card)] p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{sel.source_name}</h3>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{sel.que_source_id}</p>
              </div>
              <button onClick={() => setSel(null)} className="ml-2 shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <DField label="Product Lines" value={sel.product_lines.join(', ')} />
              <DField label="Adapter Type" value={sel.adapter_type} />
              <DField label="Automation Level" value={sel.automation_level} />
              <DField label="Automation %" value={`${sel.automation_pct}%`} />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Gap Status</p>
                <Badge text={gapColor(sel.gap_status).label} bg={gapColor(sel.gap_status).bg} fg={gapColor(sel.gap_status).text} />
              </div>
              <DField label="Current Method" value={sel.current_method} />
              <DField label="Target Method" value={sel.target_method} />
              <DField label="Status" value={sel.status} />

              {/* Adapter Config */}
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedConfig(expandedConfig === sel.que_source_id ? null : sel.que_source_id)
                  }}
                  className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                    {expandedConfig === sel.que_source_id ? 'expand_less' : 'expand_more'}
                  </span>
                  Adapter Config
                </button>
                {expandedConfig === sel.que_source_id && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-[var(--bg-surface)] p-2 text-[10px] text-[var(--text-secondary)]">
                    {JSON.stringify(sel.adapter_config, null, 2)}
                  </pre>
                )}
              </div>

              {/* Input Schema */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Input Fields</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.keys(sel.input_schema).map((k) => (
                    <span key={k} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{k}</span>
                  ))}
                </div>
              </div>

              {/* Output Schema */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Output Fields</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.keys(sel.output_schema).map((k) => (
                    <span key={k} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OPS Tab — Session counts + automation progress
// ---------------------------------------------------------------------------

function OpsTab() {
  const [sessions, setSessions] = useState<QueSession[]>([])
  const [sources, setSources] = useState<QueSource[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (loaded) return
    setLoading(true)
    setError(null)
    try {
      const [sessRes, srcRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/que/sessions`),
        fetchWithAuth(`${API_BASE}/que/admin/sources`),
      ])
      const sessJson = await sessRes.json() as { success: boolean; data?: QueSession[]; error?: string }
      const srcJson = await srcRes.json() as { success: boolean; data?: QueSource[]; error?: string }
      if (sessJson.success && sessJson.data) setSessions(sessJson.data)
      if (srcJson.success && srcJson.data) setSources(srcJson.data)
      if (!sessJson.success && !srcJson.success) setError('Failed to load data')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  if (!loaded && !loading) {
    loadData()
  }

  // Session counts by product_line
  const sessionsByProduct = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sessions) {
      const pl = s.product_line || 'UNKNOWN'
      counts[pl] = (counts[pl] || 0) + 1
    }
    return counts
  }, [sessions])

  // Session counts by status
  const sessionsByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sessions) {
      const st = s.status || 'unknown'
      counts[st] = (counts[st] || 0) + 1
    }
    return counts
  }, [sessions])

  // Automation progress: GREEN sources / total
  const automationProgress = useMemo(() => {
    if (sources.length === 0) return 0
    const greenCount = sources.filter((s) => (s.gap_status || '').toUpperCase() === 'GREEN').length
    return Math.round((greenCount / sources.length) * 100)
  }, [sources])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  if (error && sessions.length === 0 && sources.length === 0) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <span className="material-icons-outlined text-3xl" style={{ color: 'rgb(239,68,68)' }}>error</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p>
        <button onClick={() => { setLoaded(false); setError(null) }}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all"
          style={{ background: 'var(--portal)' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="receipt_long" label="Total Sessions" val={sessions.length} accent />
        <Stat icon="hub" label="Sources Tracked" val={sources.length} />
        <Stat icon="auto_mode" label="Automation" val={`${automationProgress}%`} color={automationProgress >= 50 ? 'rgb(16,185,129)' : 'rgb(239,68,68)'} />
        <Stat icon="check_circle" label="GREEN Sources" val={sources.filter((s) => (s.gap_status || '').toUpperCase() === 'GREEN').length} color="rgb(16,185,129)" />
      </div>

      {/* Automation Progress Bar */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>auto_mode</span>
            Source Automation Progress
          </h3>
          <span className="text-sm font-bold" style={{ color: automationProgress >= 50 ? 'rgb(16,185,129)' : 'rgb(239,68,68)' }}>
            {automationProgress}%
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${automationProgress}%`,
              background: automationProgress >= 75 ? 'rgb(16,185,129)' : automationProgress >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)',
            }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {sources.filter((s) => (s.gap_status || '').toUpperCase() === 'GREEN').length} of {sources.length} sources fully automated (GREEN)
        </p>
      </div>

      {/* Sessions by Product Line */}
      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>receipt_long</span>
          Sessions by Product Line
        </h3>
        {sessions.length === 0 ? (
          <div className="mt-3">
            <Empty icon="receipt_long" title="No Sessions Yet" desc="QUE sessions will appear here as quoting jobs run against registered sources." />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(sessionsByProduct).map(([pl, count]) => (
              <div key={pl} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{pl}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{count}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions by Status */}
      {sessions.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>flag</span>
            Sessions by Status
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(sessionsByStatus).map(([st, count]) => (
              <div key={st} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{st}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source Gap Breakdown */}
      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>analytics</span>
          Source Gap Breakdown
        </h3>
        {sources.length === 0 ? (
          <div className="mt-3">
            <Empty icon="analytics" title="No Sources" desc="Seed QUE sources to see gap analysis." />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {sources.map((s) => {
              const gc = gapColor(s.gap_status)
              return (
                <div key={s.que_source_id} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{s.source_name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      {s.product_lines.join(', ')}
                      <span>&middot;</span>
                      <span>{s.current_method} &rarr; {s.target_method}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(s.automation_pct, 100)}%`,
                          background: s.automation_pct >= 75 ? 'rgb(16,185,129)' : s.automation_pct >= 50 ? 'rgb(245,158,11)' : 'rgb(239,68,68)',
                        }} />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">{s.automation_pct}%</span>
                    </div>
                    <Badge text={s.gap_status} bg={gc.bg} fg={gc.text} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QueRegistry — Main Component
// ---------------------------------------------------------------------------

export function QueRegistry({ portal }: { portal?: string }) {
  const [activeSection, setActiveSection] = useState<Section>('import')

  void portal // portal prop available for future portal-specific logic

  return (
    <div className="mx-auto max-w-7xl">
      <Hdr sub="quoting sources + automation progress" />

      {/* Section Pills */}
      <div className="mt-6 flex gap-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeSection === s.key ? 'var(--portal)' : 'var(--bg-surface)',
              color: activeSection === s.key ? '#fff' : 'var(--text-muted)',
            }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeSection === 'import' && <ImportTab />}
        {activeSection === 'registry' && <RegistryTab />}
        {activeSection === 'ops' && <OpsTab />}
      </div>
    </div>
  )
}

export default QueRegistry
