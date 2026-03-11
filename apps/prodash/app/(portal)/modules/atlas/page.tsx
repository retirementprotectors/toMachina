'use client'

import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const registryQuery: Query<DocumentData> = query(collections.sourceRegistry())

interface SourceRecord {
  _id: string
  source_name?: string
  name?: string
  type?: string
  category?: string
  status?: string
  frequency?: string
  owner?: string
  description?: string
}

const statusStyle = (status?: string) => {
  const s = (status || '').toLowerCase()
  if (s === 'active') return { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }
  if (s === 'pending' || s === 'planned') return { background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }
  if (s === 'inactive' || s === 'retired') return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

export default function AtlasPage() {
  const { data: sources, loading } = useCollection<SourceRecord>(registryQuery, 'atlas-sources')

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Source of Truth Registry</p>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Source of Truth Registry — data lineage and integration tracking</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Sources</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{sources.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Active</p>
          <p className="mt-1 text-2xl font-bold text-[var(--success)]">
            {sources.filter((s) => (s.status || '').toLowerCase() === 'active').length}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Pending</p>
          <p className="mt-1 text-2xl font-bold text-[var(--warning)]">
            {sources.filter((s) => ['pending', 'planned'].includes((s.status || '').toLowerCase())).length}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-muted)]">
            {sources.filter((s) => ['inactive', 'retired'].includes((s.status || '').toLowerCase())).length}
          </p>
        </div>
      </div>

      {/* Source Table */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Source Registry</h2>
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">hub</span>
            <p className="mt-3 text-sm text-[var(--text-muted)]">No sources registered yet.</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Run ATLAS seed in GAS to populate the source_registry collection.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Source Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {sources.map((s) => (
                  <tr key={s._id} className="bg-[var(--bg-card)] transition-colors hover:bg-[var(--bg-card-hover)]">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {s.source_name || s.name || s._id}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{s.type || '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{s.category || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={statusStyle(s.status)}
                      >
                        {s.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{s.frequency || '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{s.owner || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
