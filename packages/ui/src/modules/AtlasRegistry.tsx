'use client'

import { useState, useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceRecord {
  _id: string
  source_id?: string
  name?: string
  source_name?: string
  carrier_name?: string
  product_line?: string
  product_category?: string
  data_domain?: string
  type?: string
  source_type?: string
  current_source?: string
  current_method?: string
  current_frequency?: string
  current_owner_email?: string
  target_source?: string
  target_method?: string
  target_frequency?: string
  gap_status?: string
  automation_pct?: number
  status?: string
  priority?: string
  portal?: string
  frequency?: string
  automation_level?: string
  description?: string
  notes?: string
  last_pull?: string
  last_pull_at?: string
  next_pull_due?: string
  last_updated?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

// Pipeline stages from ATLAS_Pipeline.gs
const PIPELINE_STAGES = [
  { key: 'SOURCE', label: 'Source', icon: 'cloud', color: '#a855f7' },
  { key: 'INTAKE', label: 'Intake', icon: 'upload_file', color: '#fbbf24' },
  { key: 'EXTRACTION', label: 'Extraction', icon: 'document_scanner', color: '#7c5cff' },
  { key: 'APPROVAL', label: 'Approval', icon: 'fact_check', color: '#60a5fa' },
  { key: 'MATRIX', label: 'Matrix', icon: 'grid_on', color: '#34d399' },
  { key: 'FRONTEND', label: 'Frontend', icon: 'monitor', color: '#f472b6' },
] as const

// Constants from ATLAS backend
const GAP_STATUSES = ['All', 'GREEN', 'YELLOW', 'RED', 'GRAY'] as const
const SOURCE_METHODS = ['All', 'API_FEED', 'MANUAL_CSV', 'WEBHOOK', 'SFTP', 'MANUAL_ENTRY', 'NOT_AVAILABLE'] as const
const PRIORITIES = ['All', 'HIGH', 'MEDIUM', 'LOW'] as const
const DATA_DOMAINS = ['All', 'ACCOUNTS', 'COMMISSIONS', 'DEMOGRAPHICS', 'CLAIMS', 'ENROLLMENT', 'LICENSING', 'VALIDATION'] as const

type Tab = 'sources' | 'tools' | 'pipeline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gapColor(gap?: string): { bg: string; text: string; label: string } {
  const g = (gap || '').toUpperCase()
  if (g === 'GREEN') return { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Automated' }
  if (g === 'YELLOW') return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'Semi-Auto' }
  if (g === 'RED') return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Manual/Missing' }
  if (g === 'GRAY') return { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'Planned' }
  return { bg: 'var(--bg-surface)', text: 'var(--text-muted)', label: gap || 'Unknown' }
}

function statusStyle(status?: string): { background: string; color: string } {
  const s = (status || '').toLowerCase()
  if (s === 'active' || s === 'operational') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (s === 'planned' || s === 'pending') return { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
  if (s === 'degraded') return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
  if (s === 'deprecated') return { background: 'rgba(107,114,128,0.15)', color: '#6b7280' }
  return { background: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
}

function formatDate(d?: string): string {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return d
  }
}

// ---------------------------------------------------------------------------
// AtlasRegistry Component
// ---------------------------------------------------------------------------

export function AtlasRegistry({ portal }: { portal: string }) {
  const sourceQuery = useMemo<Query<DocumentData>>(() => query(collections.sourceRegistry()), [])
  const { data: sources, loading, error } = useCollection<SourceRecord>(sourceQuery, `atlas-sources-${portal}`)

  const [activeTab, setActiveTab] = useState<Tab>('sources')
  const [gapFilter, setGapFilter] = useState('All')
  const [methodFilter, setMethodFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [domainFilter, setDomainFilter] = useState('All')
  const [sourceSearch, setSourceSearch] = useState('')
  const [selectedSource, setSelectedSource] = useState<SourceRecord | null>(null)

  // --- Derived Data ---
  const stats = useMemo(() => {
    let active = 0
    let totalAutomation = 0
    let automationCount = 0
    const gapCounts: Record<string, number> = {}
    const typeCounts: Record<string, number> = {}
    const carrierCounts: Record<string, number> = {}
    const domainCounts: Record<string, number> = {}

    sources.forEach((s) => {
      const status = (s.status || '').toLowerCase()
      if (status === 'active' || status === 'operational') active++

      const gap = (s.gap_status || '').toUpperCase()
      if (gap) gapCounts[gap] = (gapCounts[gap] || 0) + 1

      const type = s.type || s.source_type || s.current_method || 'Unknown'
      typeCounts[type] = (typeCounts[type] || 0) + 1

      const carrier = s.carrier_name || 'Unknown'
      carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1

      const domain = s.data_domain || 'Unknown'
      domainCounts[domain] = (domainCounts[domain] || 0) + 1

      if (s.automation_pct !== undefined && s.automation_pct !== null) {
        totalAutomation += s.automation_pct
        automationCount++
      }
    })

    const avgAutomation = automationCount > 0 ? Math.round(totalAutomation / automationCount) : 0

    return {
      total: sources.length,
      active,
      avgAutomation,
      gapCounts,
      typeCounts,
      carrierCounts,
      domainCounts,
    }
  }, [sources])

  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      if (gapFilter !== 'All') {
        const g = (s.gap_status || '').toUpperCase()
        if (g !== gapFilter) return false
      }
      if (methodFilter !== 'All') {
        const m = (s.current_method || s.type || s.source_type || '').toUpperCase()
        if (m !== methodFilter) return false
      }
      if (priorityFilter !== 'All') {
        const p = (s.priority || '').toUpperCase()
        if (p !== priorityFilter) return false
      }
      if (domainFilter !== 'All') {
        const d = (s.data_domain || '').toUpperCase()
        if (d !== domainFilter) return false
      }
      if (sourceSearch) {
        const q = sourceSearch.toLowerCase()
        const name = (s.name || s.source_name || '').toLowerCase()
        const carrier = (s.carrier_name || '').toLowerCase()
        const desc = (s.description || '').toLowerCase()
        if (!name.includes(q) && !carrier.includes(q) && !desc.includes(q)) return false
      }
      return true
    })
  }, [sources, gapFilter, methodFilter, priorityFilter, domainFilter, sourceSearch])

  // --- Tabs ---
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'sources', label: 'Sources', icon: 'hub' },
    { key: 'tools', label: 'Tools', icon: 'build' },
    { key: 'pipeline', label: 'Pipeline Flow', icon: 'route' },
  ]

  // --- Loading ---
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system</p>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  // --- Empty State ---
  if (sources.length === 0 && !error) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system</p>

        <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
          <span className="material-icons-outlined text-5xl" style={{ color: 'var(--portal)' }}>hub</span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Source Registry Ready</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            ATLAS tracks every data source, carrier integration, and pipeline across the platform.
            Seed ATLAS to populate the registry.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ArchCard icon="cloud_sync" label="Automated Feeds" description="Carrier data, DTCC, commission files" />
          <ArchCard icon="upload_file" label="Manual Sources" description="Book imports, spreadsheets, forms" />
          <ArchCard icon="api" label="API Integrations" description="CSG, NPI, CMS, BigQuery" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system &mdash; {stats.total} data sources tracked</p>

      {/* Health Dashboard */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon="hub" label="Total Sources" value={stats.total} />
        <StatCard icon="check_circle" label="Active" value={stats.active} accent />
        <StatCard icon="speed" label="Avg Automation" value={`${stats.avgAutomation}%`} />
        <StatCard icon="warning" label="Gaps (RED)" value={stats.gapCounts['RED'] || 0} warning />
        <StatCard icon="category" label="Domains" value={Object.keys(stats.domainCounts).length} />
      </div>

      {/* Gap Status Overview */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(stats.gapCounts)
          .sort(([a], [b]) => {
            const order: Record<string, number> = { GREEN: 0, YELLOW: 1, RED: 2, GRAY: 3 }
            return (order[a] ?? 4) - (order[b] ?? 4)
          })
          .map(([gap, count]) => {
            const g = gapColor(gap)
            return (
              <button
                key={gap}
                onClick={() => { setActiveTab('sources'); setGapFilter(gap) }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: g.bg, color: g.text }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: g.text }} />
                {g.label}: {count}
              </button>
            )
          })}
      </div>

      {/* Tab Navigation */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: activeTab === tab.key ? 'var(--portal)' : 'transparent',
              color: activeTab === tab.key ? 'var(--portal)' : 'var(--text-muted)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'sources' && (
          <SourcesTab
            sources={filteredSources}
            totalCount={sources.length}
            gapFilter={gapFilter}
            methodFilter={methodFilter}
            priorityFilter={priorityFilter}
            domainFilter={domainFilter}
            search={sourceSearch}
            onGapFilter={setGapFilter}
            onMethodFilter={setMethodFilter}
            onPriorityFilter={setPriorityFilter}
            onDomainFilter={setDomainFilter}
            onSearch={setSourceSearch}
            selected={selectedSource}
            onSelect={setSelectedSource}
            carrierCounts={stats.carrierCounts}
            domainCounts={stats.domainCounts}
          />
        )}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'pipeline' && <PipelineTab />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value, accent, warning }: {
  icon: string; label: string; value: number | string; accent?: boolean; warning?: boolean
}) {
  const color = warning ? '#ef4444' : accent ? 'var(--portal)' : 'var(--text-primary)'
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function ArchCard({ icon, label, description }: { icon: string; label: string; description: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-center">
      <span className="material-icons-outlined text-2xl" style={{ color: 'var(--portal)' }}>{icon}</span>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sources Tab
// ---------------------------------------------------------------------------

function SourcesTab({
  sources, totalCount, gapFilter, methodFilter, priorityFilter, domainFilter, search,
  onGapFilter, onMethodFilter, onPriorityFilter, onDomainFilter, onSearch,
  selected, onSelect, carrierCounts, domainCounts,
}: {
  sources: SourceRecord[]
  totalCount: number
  gapFilter: string
  methodFilter: string
  priorityFilter: string
  domainFilter: string
  search: string
  onGapFilter: (v: string) => void
  onMethodFilter: (v: string) => void
  onPriorityFilter: (v: string) => void
  onDomainFilter: (v: string) => void
  onSearch: (v: string) => void
  selected: SourceRecord | null
  onSelect: (s: SourceRecord | null) => void
  carrierCounts: Record<string, number>
  domainCounts: Record<string, number>
}) {
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
        />
        <select
          value={gapFilter}
          onChange={(e) => onGapFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {GAP_STATUSES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => onMethodFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {SOURCE_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select
          value={domainFilter}
          onChange={(e) => onDomainFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {DATA_DOMAINS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">{sources.length} of {totalCount}</span>
      </div>

      {/* Side-by-Side: Carriers + Domains */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">By Carrier</h3>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {Object.entries(carrierCounts).sort(([, a], [, b]) => b - a).slice(0, 15).map(([carrier, count]) => (
              <div key={carrier} className="flex items-center justify-between text-sm">
                <span className="truncate text-[var(--text-secondary)]">{carrier}</span>
                <span className="font-medium text-[var(--text-primary)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">By Domain</h3>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {Object.entries(domainCounts).sort(([, a], [, b]) => b - a).map(([domain, count]) => (
              <div key={domain} className="flex items-center justify-between text-sm">
                <span className="truncate text-[var(--text-secondary)]">{domain}</span>
                <span className="font-medium text-[var(--text-primary)]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Table */}
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 pr-3">Carrier</th>
                <th className="pb-2 pr-3">Domain</th>
                <th className="pb-2 pr-3">Method</th>
                <th className="pb-2 pr-3">Gap</th>
                <th className="pb-2 pr-3">Auto %</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                    No sources match your filters.
                  </td>
                </tr>
              ) : (
                sources.map((s) => {
                  const gap = gapColor(s.gap_status)
                  return (
                    <tr
                      key={s._id}
                      onClick={() => onSelect(selected?._id === s._id ? null : s)}
                      className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]"
                      style={selected?._id === s._id ? { background: 'var(--bg-surface)' } : undefined}
                    >
                      <td className="py-2.5 pr-3">
                        <p className="truncate font-medium text-[var(--text-primary)]" style={{ maxWidth: '180px' }}>
                          {s.name || s.source_name || s._id}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{s.carrier_name || '-'}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{s.data_domain || '-'}</td>
                      <td className="py-2.5 pr-3">
                        <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                          {s.current_method || s.type || s.source_type || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: gap.text }} />
                          <span className="text-xs" style={{ color: gap.text }}>{s.gap_status || '-'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {s.automation_pct !== undefined && s.automation_pct !== null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(s.automation_pct, 100)}%`,
                                  background: s.automation_pct >= 75 ? '#22c55e' : s.automation_pct >= 50 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">{s.automation_pct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">{s.automation_level || '-'}</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(s.status)}>
                          {s.status || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Detail Panel */}
      {selected && (
        <div className="mt-4 rounded-xl border border-[var(--portal)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {selected.name || selected.source_name || selected._id}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                {selected.carrier_name} &middot; {selected.product_line || '-'} &middot; {selected.data_domain || '-'}
              </p>
            </div>
            <button onClick={() => onSelect(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Current Method</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.current_method || selected.type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Target Method</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.target_method || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Current Frequency</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.current_frequency || selected.frequency || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Target Frequency</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.target_frequency || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Gap Status</p>
              <span
                className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: gapColor(selected.gap_status).bg, color: gapColor(selected.gap_status).text }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: gapColor(selected.gap_status).text }} />
                {selected.gap_status || '-'}
              </span>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Automation</p>
              <p className="font-medium text-[var(--text-primary)]">
                {selected.automation_pct !== undefined ? `${selected.automation_pct}%` : selected.automation_level || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Priority</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.priority || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Portal</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.portal || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Owner</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.current_owner_email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Last Pull</p>
              <p className="font-medium text-[var(--text-primary)]">{formatDate(selected.last_pull_at || selected.last_pull)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Next Due</p>
              <p className="font-medium text-[var(--text-primary)]">{formatDate(selected.next_pull_due)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Product Category</p>
              <p className="font-medium text-[var(--text-primary)]">{selected.product_category || '-'}</p>
            </div>
          </div>

          {selected.description && (
            <div className="mt-4">
              <p className="text-xs text-[var(--text-muted)]">Description</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{selected.description}</p>
            </div>
          )}
          {selected.notes && (
            <div className="mt-3">
              <p className="text-xs text-[var(--text-muted)]">Notes</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{selected.notes}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Created: {formatDate(selected.created_at)} &middot; Updated: {formatDate(selected.updated_at || selected.last_updated)}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tools Tab
// ---------------------------------------------------------------------------

function ToolsTab() {
  // tool_registry collection may be empty — graceful empty state
  const TOOL_CATEGORIES = [
    { key: 'INTAKE_QUEUING', label: 'Intake & Queuing', icon: 'inbox', desc: 'Scanning, filing, queueing' },
    { key: 'EXTRACTION_APPROVAL', label: 'Extraction & Approval', icon: 'document_scanner', desc: 'OCR, classification, approval' },
    { key: 'NORMALIZATION_VALIDATION', label: 'Normalization & Validation', icon: 'verified', desc: 'Normalize, validate, clean' },
    { key: 'MATCHING_DEDUP', label: 'Matching & Dedup', icon: 'compare_arrows', desc: 'Client matching, deduplication' },
    { key: 'EXTERNAL_ENRICHMENT', label: 'External Enrichment', icon: 'cloud_download', desc: 'WhitePages, NeverBounce, USPS' },
    { key: 'BULK_OPERATIONS', label: 'Bulk Operations', icon: 'dynamic_feed', desc: 'Batch processing, aggregation' },
  ]

  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
        <span className="material-icons-outlined text-5xl" style={{ color: 'var(--portal)' }}>build</span>
        <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Tool Registry</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Seed ATLAS to populate the tool registry. 150+ tools across 6 pipeline categories will appear here.
        </p>
      </div>

      {/* Category Preview */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOL_CATEGORIES.map((cat) => (
          <div key={cat.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--portal-glow)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>{cat.icon}</span>
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{cat.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{cat.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline Flow Tab
// ---------------------------------------------------------------------------

function PipelineTab() {
  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Data Pipeline Flow</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          How data flows from external sources through The Machine to the portal frontends
        </p>

        {/* Pipeline Visualization */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center" style={{ minWidth: '120px' }}>
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: `${stage.color}20` }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '24px', color: stage.color }}>
                    {stage.icon}
                  </span>
                </span>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{stage.label}</p>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <span className="mx-1 text-[var(--text-muted)]">
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Stage Details */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: stage.color }} />
                <p className="text-sm font-medium text-[var(--text-primary)]">{stage.label}</p>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {stage.key === 'SOURCE' && 'External carrier data, APIs, manual uploads, SFTP feeds'}
                {stage.key === 'INTAKE' && 'Document watcher scans, queues items: NEW → SCANNING → QUEUED'}
                {stage.key === 'EXTRACTION' && 'OCR extraction, AI classification: EXTRACTING → CLASSIFYING'}
                {stage.key === 'APPROVAL' && 'Team review, validation: PENDING_REVIEW → REVIEW → APPROVED'}
                {stage.key === 'MATRIX' && 'Data written to Firestore + Sheets: IMPORTING → WRITING → COMPLETE'}
                {stage.key === 'FRONTEND' && 'Data visible in ProDashX, RIIMO, SENTINEL portals'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Wire Diagrams Note */}
      <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">schema</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Individual wire diagrams (per carrier/product/domain) will render here when wire definitions are seeded from ATLAS backend.
        </p>
      </div>
    </div>
  )
}
