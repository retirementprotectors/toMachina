'use client'

import { useState, useMemo } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const pipelinesQuery: Query<DocumentData> = query(collections.pipelines(), orderBy('created_at', 'desc'))

interface PipelineRecord {
  _id: string
  pipeline_id?: string
  pipeline_key?: string
  pipeline_name?: string
  name?: string
  status?: string
  current_stage?: string
  stage?: string
  client_id?: string
  client_name?: string
  assigned_to?: string
  created_at?: string
  updated_at?: string
  entity_type?: string
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'var(--success)',
    completed: 'var(--info)',
    paused: 'var(--warning)',
    cancelled: 'var(--error)',
  }
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: colors[status] || 'var(--text-muted)' }}
    />
  )
}

export default function PipelinesPage() {
  const { data: pipelines, loading, error } = useCollection<PipelineRecord>(pipelinesQuery, 'riimo-pipelines')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const statuses = useMemo(() => {
    const set = new Set<string>()
    pipelines.forEach((p) => { if (p.status) set.add(p.status) })
    return ['All', ...Array.from(set).sort()]
  }, [pipelines])

  const filtered = useMemo(() => {
    let result = pipelines
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) =>
        (p.pipeline_name || p.name || '').toLowerCase().includes(q) ||
        (p.client_name || '').toLowerCase().includes(q) ||
        (p.assigned_to || '').toLowerCase().includes(q) ||
        (p.pipeline_key || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'All') {
      result = result.filter((p) => p.status === statusFilter)
    }
    return result
  }, [pipelines, search, statusFilter])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load pipelines: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{filtered.length} pipeline instance{filtered.length !== 1 ? 's' : ''}</p>
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
            placeholder="Search pipelines..."
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

      {/* Pipeline List */}
      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">route</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            {pipelines.length === 0 ? 'No pipeline instances found.' : 'No pipelines match your filters.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Pipeline</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id} className="border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]">
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--text-primary)]">
                      {p.pipeline_name || p.name || p.pipeline_key || p._id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusDot status={p.status || 'active'} />
                      <span className="text-[var(--text-secondary)]">{p.status || 'active'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {p.current_stage || p.stage || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {p.client_name || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {p.assigned_to || '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
