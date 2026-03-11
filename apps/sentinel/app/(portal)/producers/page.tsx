'use client'

import { useState, useMemo } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const agentsQuery: Query<DocumentData> = query(collections.agents(), orderBy('last_name'))

interface AgentRecord {
  _id: string
  agent_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  email?: string
  phone?: string
  npn?: string
  status?: string
  agent_status?: string
  state?: string
  city?: string
  carrier_appointments?: string[]
  book_of_business?: string
  imo_name?: string
  agent_type?: string
}

function StatusBadge({ status }: { status: string | undefined }) {
  const s = (status || 'unknown').toLowerCase()
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(16,185,129,0.15)', text: 'var(--success)' },
    inactive: { bg: 'rgba(239,68,68,0.15)', text: 'var(--error)' },
    pending: { bg: 'rgba(245,158,11,0.15)', text: 'var(--warning)' },
  }
  const c = colors[s] || { bg: 'var(--bg-surface)', text: 'var(--text-muted)' }

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {status || 'unknown'}
    </span>
  )
}

export default function ProducersPage() {
  const { data: agents, loading, error } = useCollection<AgentRecord>(agentsQuery, 'sentinel-producers')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const statuses = useMemo(() => {
    const set = new Set<string>()
    agents.forEach((a) => {
      const s = a.status || a.agent_status
      if (s) set.add(s)
    })
    return ['All', ...Array.from(set).sort()]
  }, [agents])

  const filtered = useMemo(() => {
    let result = agents
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((a) =>
        (a.full_name || `${a.first_name || ''} ${a.last_name || ''}`).toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.npn || '').includes(q) ||
        (a.state || '').toLowerCase().includes(q) ||
        (a.imo_name || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'All') {
      result = result.filter((a) => (a.status || a.agent_status) === statusFilter)
    }
    return result
  }, [agents, search, statusFilter])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Producers</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Producers</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load producers: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Producers</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{filtered.length} producer{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, NPN, state..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Producer Grid */}
      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">people</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            {agents.length === 0 ? 'No producers in the system.' : 'No producers match your search.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <div
              key={agent._id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)] truncate">
                    {agent.full_name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Unknown'}
                  </p>
                  {agent.agent_type && (
                    <p className="text-xs text-[var(--text-muted)]">{agent.agent_type}</p>
                  )}
                </div>
                <StatusBadge status={agent.status || agent.agent_status} />
              </div>

              {/* Details */}
              <div className="mt-3 space-y-1.5">
                {agent.npn && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--portal)' }}>badge</span>
                    NPN: {agent.npn}
                  </div>
                )}
                {agent.email && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--portal)' }}>email</span>
                    {agent.email}
                  </div>
                )}
                {(agent.city || agent.state) && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--portal)' }}>location_on</span>
                    {[agent.city, agent.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {agent.imo_name && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--portal)' }}>business</span>
                    {agent.imo_name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
