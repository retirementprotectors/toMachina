'use client'

import { useMemo, useState, useCallback } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { Modal } from '@tomachina/ui'

const agentsQuery: Query<DocumentData> = query(collections.agents())
const carriersQuery: Query<DocumentData> = query(collections.carriers())
const producersQuery: Query<DocumentData> = query(collections.producers())
const revenueQuery: Query<DocumentData> = query(collections.revenue())

interface AgentRecord {
  _id: string
  first_name?: string
  last_name?: string
  agent_name?: string
  status?: string
  state?: string
  npn?: string
  email?: string
  phone?: string
  carrier_appointments?: string[]
}

interface CarrierRecord {
  _id: string
  name?: string
  carrier_name?: string
  status?: string
  product_lines?: string[]
  type?: string
  state?: string
}

interface ProducerRecord {
  _id: string
  first_name?: string
  last_name?: string
  producer_name?: string
  state?: string
  status?: string
  npn?: string
}

interface RevenueRecord {
  _id: string
  agent_name?: string
  carrier_name?: string
  total_premium?: number
  premium?: number
  amount?: number
}

type DetailType = { type: 'agent'; record: AgentRecord } | { type: 'carrier'; record: CarrierRecord } | null

export default function MarketIntelPage() {
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'mi-agents')
  const { data: carriers, loading: carriersLoading } = useCollection<CarrierRecord>(carriersQuery, 'mi-carriers')
  const { data: producers, loading: producersLoading } = useCollection<ProducerRecord>(producersQuery, 'mi-producers')
  const { data: revenue } = useCollection<RevenueRecord>(revenueQuery, 'mi-revenue')
  const [tab, setTab] = useState<'agents' | 'carriers' | 'producers'>('agents')
  const [search, setSearch] = useState('')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [detail, setDetail] = useState<DetailType>(null)

  const anyLoading = agentsLoading || carriersLoading || producersLoading

  /* Agent stats by state */
  const stateDistribution = useMemo(() => {
    const states: Record<string, number> = {}
    agents.forEach((a) => {
      const st = a.state || 'Unknown'
      states[st] = (states[st] || 0) + 1
    })
    return Object.entries(states).sort(([, a], [, b]) => b - a).slice(0, 20)
  }, [agents])

  /* Carrier stats */
  const carrierStats = useMemo(() => {
    const active = carriers.filter((c) => (c.status || '').toLowerCase() === 'active').length
    return { total: carriers.length, active }
  }, [carriers])

  /* Revenue by agent */
  const agentRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    revenue.forEach((r) => {
      if (r.agent_name) {
        const amt = Number(r.total_premium || r.premium || r.amount || 0)
        if (!isNaN(amt)) map[r.agent_name] = (map[r.agent_name] || 0) + amt
      }
    })
    return map
  }, [revenue])

  /* Revenue by carrier */
  const carrierRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    revenue.forEach((r) => {
      if (r.carrier_name) {
        const amt = Number(r.total_premium || r.premium || r.amount || 0)
        if (!isNaN(amt)) map[r.carrier_name] = (map[r.carrier_name] || 0) + amt
      }
    })
    return map
  }, [revenue])

  /* Unique carrier names for cross-reference filter */
  const carrierNames = useMemo(() => {
    return carriers.map((c) => c.name || c.carrier_name || '').filter(Boolean).sort()
  }, [carriers])

  /* Filtered list based on tab */
  const filteredItems = useMemo(() => {
    const lower = search.toLowerCase()
    if (tab === 'agents') {
      let result = agents.filter((a) => {
        if (!search) return true
        const name = `${a.first_name || ''} ${a.last_name || ''} ${a.agent_name || ''} ${a.email || ''} ${a.npn || ''}`.toLowerCase()
        return name.includes(lower)
      })
      // Cross-reference: filter by carrier if set
      if (carrierFilter) {
        result = result.filter((a) => {
          return a.carrier_appointments?.some((c) => c.toLowerCase().includes(carrierFilter.toLowerCase()))
        })
      }
      return result.slice(0, 100)
    }
    if (tab === 'carriers') {
      return carriers.filter((c) => {
        if (!search) return true
        const name = `${c.name || ''} ${c.carrier_name || ''}`.toLowerCase()
        return name.includes(lower)
      }).slice(0, 100)
    }
    return producers.filter((p) => {
      if (!search) return true
      const name = `${p.first_name || ''} ${p.last_name || ''} ${p.producer_name || ''} ${p.npn || ''}`.toLowerCase()
      return name.includes(lower)
    }).slice(0, 100)
  }, [tab, search, agents, carriers, producers, carrierFilter])

  const handleCloseDetail = useCallback(() => setDetail(null), [])

  function formatCurrency(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Market Intelligence</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Agent search, carrier intel, and competitive analysis</p>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Agents" loading={agentsLoading} value={agents.length} sub={`${stateDistribution.length} states`} />
        <SummaryCard label="Carriers" loading={carriersLoading} value={carrierStats.total} sub={`${carrierStats.active} active`} />
        <SummaryCard label="Producers" loading={producersLoading} value={producers.length} />
      </div>

      {/* Geographic View — State Heat List */}
      {stateDistribution.length > 0 && (
        <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Geographic Distribution</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Agents by state — top 20</p>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
            {stateDistribution.map(([state, count], i) => {
              const maxCount = stateDistribution[0]?.[1] || 1
              const intensity = Math.max(0.15, count / maxCount)
              return (
                <div
                  key={state}
                  className="rounded-lg px-3 py-2 text-center"
                  style={{ background: `rgba(60, 179, 113, ${intensity})` }}
                >
                  <p className="text-sm font-bold text-[var(--text-primary)]">{state}</p>
                  <p className="text-xs text-[var(--text-muted)]">{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Data Browser */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        {/* Tab Switcher + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-[var(--bg-surface)] p-0.5">
            {(['agents', 'carriers', 'producers'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(''); setCarrierFilter('') }}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: tab === t ? 'var(--bg-card)' : 'transparent',
                  color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* Cross-reference filter for agents */}
            {tab === 'agents' && carrierNames.length > 0 && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by carrier..."
                  value={carrierFilter}
                  onChange={(e) => setCarrierFilter(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-3 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
                  style={{ width: '150px' }}
                />
              </div>
            )}
            <div className="relative">
              <span className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>search</span>
              <input
                type="text"
                placeholder={`Search ${tab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="mt-4 max-h-[500px] overflow-y-auto">
          {anyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : tab === 'agents' ? (
            <AgentTable items={filteredItems as AgentRecord[]} total={agents.length} agentRevenue={agentRevenue} onSelect={(a) => setDetail({ type: 'agent', record: a })} formatCurrency={formatCurrency} />
          ) : tab === 'carriers' ? (
            <CarrierTable items={filteredItems as CarrierRecord[]} total={carriers.length} carrierRevenue={carrierRevenue} onSelect={(c) => setDetail({ type: 'carrier', record: c })} formatCurrency={formatCurrency} />
          ) : (
            <ProducerTable items={filteredItems as ProducerRecord[]} total={producers.length} />
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detail?.type === 'agent' && (
        <Modal open onClose={handleCloseDetail} title={`${detail.record.first_name || ''} ${detail.record.last_name || detail.record.agent_name || 'Agent'}`.trim()} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="NPN" value={detail.record.npn || '-'} />
              <InfoField label="State" value={detail.record.state || '-'} />
              <InfoField label="Email" value={detail.record.email || '-'} />
              <InfoField label="Phone" value={detail.record.phone || '-'} />
              <InfoField label="Status" value={detail.record.status || 'active'} />
              <InfoField label="Total Revenue" value={agentRevenue[detail.record.agent_name || ''] ? formatCurrency(agentRevenue[detail.record.agent_name || '']) : '-'} />
            </div>
            {detail.record.carrier_appointments && detail.record.carrier_appointments.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Carrier Appointments</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.record.carrier_appointments.map((c) => (
                    <span key={c} className="rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {detail?.type === 'carrier' && (
        <Modal open onClose={handleCloseDetail} title={detail.record.name || detail.record.carrier_name || 'Carrier'} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Status" value={detail.record.status || 'active'} />
              <InfoField label="Type" value={detail.record.type || '-'} />
              <InfoField label="Total Revenue" value={carrierRevenue[detail.record.name || detail.record.carrier_name || ''] ? formatCurrency(carrierRevenue[detail.record.name || detail.record.carrier_name || '']) : '-'} />
            </div>
            {detail.record.product_lines && detail.record.product_lines.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Product Lines</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.record.product_lines.map((p) => (
                    <span key={p} className="rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Agent count for this carrier */}
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Agents with Appointments</p>
              <p className="text-sm text-[var(--text-primary)]">
                {agents.filter((a) => a.carrier_appointments?.some((c) => c.toLowerCase().includes((detail.record.name || detail.record.carrier_name || '').toLowerCase()))).length} agents
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */

function SummaryCard({ label, loading, value, sub }: { label: string; loading: boolean; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      {loading ? (
        <div className="mt-1 h-8 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      )}
      {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  )
}

function AgentTable({ items, total, agentRevenue, onSelect, formatCurrency }: {
  items: AgentRecord[]; total: number; agentRevenue: Record<string, number>; onSelect: (a: AgentRecord) => void; formatCurrency: (v: number) => string
}) {
  if (items.length === 0) return <EmptyState entity="agents" />
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">NPN</th>
            <th className="pb-2 pr-4">State</th>
            <th className="pb-2 pr-4 text-right">Revenue</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a._id} onClick={() => onSelect(a)} className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-hover)]">
              <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">
                {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.agent_name || a._id}
              </td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{a.npn || '-'}</td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{a.state || '-'}</td>
              <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">
                {agentRevenue[a.agent_name || ''] ? formatCurrency(agentRevenue[a.agent_name || '']) : '-'}
              </td>
              <td className="py-2"><StatusBadge status={a.status || 'active'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length >= 100 && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 100 of {total}</p>}
    </>
  )
}

function CarrierTable({ items, total, carrierRevenue, onSelect, formatCurrency }: {
  items: CarrierRecord[]; total: number; carrierRevenue: Record<string, number>; onSelect: (c: CarrierRecord) => void; formatCurrency: (v: number) => string
}) {
  if (items.length === 0) return <EmptyState entity="carriers" />
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4 text-right">Revenue</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const name = c.name || c.carrier_name || c._id
            return (
              <tr key={c._id} onClick={() => onSelect(c)} className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-hover)]">
                <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">{name}</td>
                <td className="py-2 pr-4 text-[var(--text-secondary)]">{c.type || '-'}</td>
                <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">
                  {carrierRevenue[name] ? formatCurrency(carrierRevenue[name]) : '-'}
                </td>
                <td className="py-2"><StatusBadge status={c.status || 'active'} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {items.length >= 100 && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 100 of {total}</p>}
    </>
  )
}

function ProducerTable({ items, total }: { items: ProducerRecord[]; total: number }) {
  if (items.length === 0) return <EmptyState entity="producers" />
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">NPN</th>
            <th className="pb-2 pr-4">State</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p._id} className="border-b border-[var(--border-subtle)]">
              <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">
                {p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.producer_name || p._id}
              </td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{p.npn || '-'}</td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{p.state || '-'}</td>
              <td className="py-2"><StatusBadge status={p.status || 'active'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length >= 100 && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 100 of {total}</p>}
    </>
  )
}

function EmptyState({ entity }: { entity: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">search_off</span>
      <p className="mt-2 text-sm text-[var(--text-muted)]">No {entity} found</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === 'active'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.1)',
        color: isActive ? '#22c55e' : '#9ca3af',
      }}
    >
      {status}
    </span>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
