'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const sourceQuery: Query<DocumentData> = query(collections.sourceRegistry())

interface SourceRecord {
  _id: string
  source_id?: string
  name?: string
  source_name?: string
  type?: string
  source_type?: string
  status?: string
  automation_level?: string
  description?: string
}

export default function AtlasPage() {
  const { data: sources, loading, error } = useCollection<SourceRecord>(sourceQuery, 'sentinel-atlas-sources')

  const stats = useMemo(() => {
    if (loading) return { total: 0, active: 0, types: {} as Record<string, number> }
    let active = 0
    const types: Record<string, number> = {}
    sources.forEach((s) => {
      const status = (s.status || '').toLowerCase()
      if (status === 'active' || status === 'operational') active++
      const type = s.type || s.source_type || 'Unknown'
      types[type] = (types[type] || 0) + 1
    })
    return { total: sources.length, active, types }
  }, [sources, loading])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (sources.length === 0 && !error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system</p>

        <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
          <span className="material-icons-outlined text-5xl" style={{ color: 'var(--portal)' }}>hub</span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Source Registry Ready</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            ATLAS tracks every data source, carrier integration, and pipeline across the platform.
            The source registry collection will be populated during the data migration phase.
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
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system — {stats.total} data sources tracked</p>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Sources</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Active</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: '#22c55e' }}>{stats.active}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Source Types</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{Object.keys(stats.types).length}</p>
        </div>
      </div>

      {/* Source List */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">All Sources</h2>
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Automation</th>
              </tr>
            </thead>
            <tbody>
              {sources.slice(0, 50).map((s) => (
                <tr key={s._id} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 pr-4 text-[var(--text-primary)]">{s.name || s.source_name || s._id}</td>
                  <td className="py-2 pr-4 text-[var(--text-secondary)]">{s.type || s.source_type || '-'}</td>
                  <td className="py-2 pr-4"><StatusBadge status={s.status || 'unknown'} /></td>
                  <td className="py-2 text-[var(--text-secondary)]">{s.automation_level || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sources.length > 50 && (
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Showing 50 of {sources.length} sources</p>
          )}
        </div>
      </div>
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

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase()
  const isActive = lower === 'active' || lower === 'operational'
  const isPlanned = lower === 'planned' || lower === 'pending'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: isActive ? 'rgba(34,197,94,0.1)' : isPlanned ? 'rgba(234,179,8,0.1)' : 'rgba(156,163,175,0.1)',
        color: isActive ? '#22c55e' : isPlanned ? '#eab308' : '#9ca3af',
      }}
    >
      {status}
    </span>
  )
}
