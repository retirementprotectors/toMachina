'use client'

import { useMemo, useState } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const agentsQuery: Query<DocumentData> = query(collections.agents())
const carriersQuery: Query<DocumentData> = query(collections.carriers())
const producersQuery: Query<DocumentData> = query(collections.producers())

interface AgentRecord {
  _id: string
  first_name?: string
  last_name?: string
  agent_name?: string
  status?: string
  state?: string
  npn?: string
  email?: string
}

interface CarrierRecord {
  _id: string
  name?: string
  carrier_name?: string
  status?: string
  product_lines?: string[]
  type?: string
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

export default function MarketIntelPage() {
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'mi-agents')
  const { data: carriers, loading: carriersLoading } = useCollection<CarrierRecord>(carriersQuery, 'mi-carriers')
  const { data: producers, loading: producersLoading } = useCollection<ProducerRecord>(producersQuery, 'mi-producers')
  const [tab, setTab] = useState<'agents' | 'carriers' | 'producers'>('agents')
  const [search, setSearch] = useState('')

  const anyLoading = agentsLoading || carriersLoading || producersLoading

  /* Agent stats by state */
  const stateDistribution = useMemo(() => {
    const states: Record<string, number> = {}
    agents.forEach((a) => {
      const st = a.state || 'Unknown'
      states[st] = (states[st] || 0) + 1
    })
    return Object.entries(states).sort(([, a], [, b]) => b - a).slice(0, 15)
  }, [agents])

  /* Carrier stats */
  const carrierStats = useMemo(() => {
    const active = carriers.filter((c) => (c.status || '').toLowerCase() === 'active').length
    return { total: carriers.length, active }
  }, [carriers])

  /* Filtered list based on tab */
  const filteredItems = useMemo(() => {
    const lower = search.toLowerCase()
    if (tab === 'agents') {
      return agents.filter((a) => {
        if (!search) return true
        const name = `${a.first_name || ''} ${a.last_name || ''} ${a.agent_name || ''} ${a.email || ''} ${a.npn || ''}`.toLowerCase()
        return name.includes(lower)
      }).slice(0, 50)
    }
    if (tab === 'carriers') {
      return carriers.filter((c) => {
        if (!search) return true
        const name = `${c.name || ''} ${c.carrier_name || ''}`.toLowerCase()
        return name.includes(lower)
      }).slice(0, 50)
    }
    return producers.filter((p) => {
      if (!search) return true
      const name = `${p.first_name || ''} ${p.last_name || ''} ${p.producer_name || ''} ${p.npn || ''}`.toLowerCase()
      return name.includes(lower)
    }).slice(0, 50)
  }, [tab, search, agents, carriers, producers])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Market Intelligence</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Agent search, carrier intel, and competitive analysis</p>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Agents</p>
          {agentsLoading ? (
            <div className="mt-1 h-8 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{agents.length.toLocaleString()}</p>
          )}
          <p className="text-xs text-[var(--text-muted)]">{stateDistribution.length} states</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Carriers</p>
          {carriersLoading ? (
            <div className="mt-1 h-8 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{carrierStats.total}</p>
          )}
          <p className="text-xs text-[var(--text-muted)]">{carrierStats.active} active</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Producers</p>
          {producersLoading ? (
            <div className="mt-1 h-8 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{producers.length.toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* State Distribution */}
      {stateDistribution.length > 0 && (
        <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Agents by State</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {stateDistribution.map(([state, count]) => (
              <div key={state} className="rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-center">
                <p className="text-sm font-bold text-[var(--text-primary)]">{state}</p>
                <p className="text-xs text-[var(--text-muted)]">{count}</p>
              </div>
            ))}
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
                onClick={() => { setTab(t); setSearch('') }}
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
          <div className="relative">
            <span
              className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ fontSize: '16px', color: 'var(--text-muted)' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder={`Search ${tab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="mt-4 max-h-[500px] overflow-y-auto">
          {anyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : tab === 'agents' ? (
            <AgentTable items={filteredItems as AgentRecord[]} total={agents.length} />
          ) : tab === 'carriers' ? (
            <CarrierTable items={filteredItems as CarrierRecord[]} total={carriers.length} />
          ) : (
            <ProducerTable items={filteredItems as ProducerRecord[]} total={producers.length} />
          )}
        </div>
      </div>
    </div>
  )
}

function AgentTable({ items, total }: { items: AgentRecord[]; total: number }) {
  if (items.length === 0) return <EmptyState entity="agents" />
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
          {items.map((a) => (
            <tr key={a._id} className="border-b border-[var(--border-subtle)]">
              <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">
                {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.agent_name || a._id}
              </td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{a.npn || '-'}</td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{a.state || '-'}</td>
              <td className="py-2"><StatusBadge status={a.status || 'active'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length >= 50 && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 50 of {total}</p>}
    </>
  )
}

function CarrierTable({ items, total }: { items: CarrierRecord[]; total: number }) {
  if (items.length === 0) return <EmptyState entity="carriers" />
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c._id} className="border-b border-[var(--border-subtle)]">
              <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">{c.name || c.carrier_name || c._id}</td>
              <td className="py-2 pr-4 text-[var(--text-secondary)]">{c.type || '-'}</td>
              <td className="py-2"><StatusBadge status={c.status || 'active'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length >= 50 && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 50 of {total}</p>}
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
      {items.length >= 50 && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 50 of {total}</p>}
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
