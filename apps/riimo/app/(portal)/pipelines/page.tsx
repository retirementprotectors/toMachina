'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { KanbanBoard, type KanbanColumn, type KanbanCard, Modal } from '@tomachina/ui'

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
  stages?: Array<{ name: string; status: string; completed_at?: string }>
  notes?: string
  gate_requirements?: string[]
}

/* Pipeline type definitions for the selector */
const PIPELINE_TYPES = [
  { key: 'all', label: 'All Pipelines', icon: 'route', description: 'View all pipeline instances' },
  { key: 'onboarding', label: 'Onboarding', icon: 'person_add', description: 'New employee and agent setup' },
  { key: 'offboarding', label: 'Offboarding', icon: 'person_remove', description: 'Employee departure workflow' },
  { key: 'compliance', label: 'Compliance', icon: 'verified_user', description: 'Regulatory compliance checks' },
  { key: 'client_setup', label: 'Client Setup', icon: 'how_to_reg', description: 'New client onboarding' },
  { key: 'data_maintenance', label: 'Data Maintenance', icon: 'storage', description: 'Data quality pipelines' },
  { key: 'tech_maintenance', label: 'Tech Maintenance', icon: 'build', description: 'System maintenance workflows' },
]

/* Kanban stage definitions */
const KANBAN_STAGES = [
  { id: 'pending', title: 'Pending', color: 'var(--text-muted)' },
  { id: 'in_progress', title: 'In Progress', color: 'var(--info)' },
  { id: 'review', title: 'Review', color: 'var(--warning)' },
  { id: 'approved', title: 'Approved', color: '#a78bfa' },
  { id: 'completed', title: 'Completed', color: 'var(--success)' },
]

function normalizeStageForKanban(stage: string | undefined, status: string | undefined): string {
  const raw = (stage || status || '').toLowerCase().replace(/[\s-]+/g, '_')
  if (raw.includes('complete') || raw.includes('done') || raw.includes('finished')) return 'completed'
  if (raw.includes('review') || raw.includes('approval') || raw.includes('waiting')) return 'review'
  if (raw.includes('approved') || raw.includes('verified')) return 'approved'
  if (raw.includes('progress') || raw.includes('active') || raw.includes('running')) return 'in_progress'
  if (raw.includes('pause') || raw.includes('cancel')) return 'pending'
  return raw === 'completed' ? 'completed' : raw === 'active' ? 'in_progress' : 'pending'
}

type ViewMode = 'kanban' | 'list'

export default function PipelinesPage() {
  const { data: pipelines, loading, error } = useCollection<PipelineRecord>(pipelinesQuery, 'riimo-pipelines')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineRecord | null>(null)

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
    if (selectedType !== 'all') {
      result = result.filter((p) => {
        const key = (p.pipeline_key || p.pipeline_name || p.name || '').toLowerCase()
        return key.includes(selectedType)
      })
    }
    return result
  }, [pipelines, search, selectedType])

  const columns: KanbanColumn[] = useMemo(() => {
    return KANBAN_STAGES.map((stage) => {
      const stageItems = filtered.filter(
        (p) => normalizeStageForKanban(p.current_stage || p.stage, p.status) === stage.id
      )
      const cards: KanbanCard[] = stageItems.map((p) => {
        const badges: KanbanCard['badges'] = []
        if (p.pipeline_key) badges.push({ label: p.pipeline_key })
        if (p.status && p.status !== stage.id) badges.push({ label: p.status, color: 'var(--info)' })

        const meta: KanbanCard['meta'] = []
        if (p.client_name) meta.push({ icon: 'person', text: p.client_name })
        if (p.assigned_to) meta.push({ icon: 'assignment_ind', text: p.assigned_to })
        if (p.updated_at) meta.push({ icon: 'schedule', text: new Date(p.updated_at).toLocaleDateString() })

        return {
          id: p._id,
          title: p.pipeline_name || p.name || p.pipeline_key || p._id,
          subtitle: p.current_stage || p.stage,
          badges,
          meta,
          onClick: () => setSelectedPipeline(p),
        }
      })
      return { id: stage.id, title: stage.title, color: stage.color, cards }
    })
  }, [filtered])

  const handleCloseModal = useCallback(() => setSelectedPipeline(null), [])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load pipelines: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {filtered.length} instance{filtered.length !== 1 ? 's' : ''} across {KANBAN_STAGES.length} stages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className="rounded-lg p-2 transition-colors"
            style={{ background: viewMode === 'kanban' ? 'var(--portal-glow)' : 'transparent', color: viewMode === 'kanban' ? 'var(--portal)' : 'var(--text-muted)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>view_kanban</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="rounded-lg p-2 transition-colors"
            style={{ background: viewMode === 'list' ? 'var(--portal-glow)' : 'transparent', color: viewMode === 'list' ? 'var(--portal)' : 'var(--text-muted)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>view_list</span>
          </button>
        </div>
      </div>

      {/* Pipeline Type Selector */}
      <div className="mt-4 flex flex-wrap gap-2">
        {PIPELINE_TYPES.map((pt) => (
          <button
            key={pt.key}
            onClick={() => setSelectedType(pt.key)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: selectedType === pt.key ? 'var(--portal)' : 'var(--bg-surface)',
              color: selectedType === pt.key ? 'white' : 'var(--text-muted)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{pt.icon}</span>
            {pt.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-4">
        <div className="relative max-w-sm">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pipelines..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
          />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">route</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            {pipelines.length === 0 ? 'No pipeline instances found.' : 'No pipelines match your filters.'}
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="mt-4">
          <KanbanBoard columns={columns} emptyMessage="No pipelines in this view." />
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
                <tr
                  key={p._id}
                  onClick={() => setSelectedPipeline(p)}
                  className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {p.pipeline_name || p.name || p.pipeline_key || p._id}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={p.status || 'active'} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{p.current_stage || p.stage || '\u2014'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{p.client_name || '\u2014'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{p.assigned_to || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pipeline Detail Modal */}
      {selectedPipeline && (
        <Modal open={!!selectedPipeline} onClose={handleCloseModal} title={selectedPipeline.pipeline_name || selectedPipeline.name || 'Pipeline Detail'} size="lg">
          <div className="space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Status" value={selectedPipeline.status || 'active'} />
              <InfoField label="Current Stage" value={selectedPipeline.current_stage || selectedPipeline.stage || '-'} />
              <InfoField label="Client" value={selectedPipeline.client_name || '-'} />
              <InfoField label="Assigned To" value={selectedPipeline.assigned_to || '-'} />
              <InfoField label="Pipeline Type" value={selectedPipeline.pipeline_key || '-'} />
              <InfoField label="Created" value={selectedPipeline.created_at ? new Date(selectedPipeline.created_at).toLocaleDateString() : '-'} />
            </div>

            {/* Stage History */}
            {selectedPipeline.stages && selectedPipeline.stages.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Stage History</h3>
                <div className="space-y-2">
                  {selectedPipeline.stages.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: s.status === 'completed' ? 'var(--success)' : s.status === 'active' ? 'var(--info)' : 'var(--text-muted)' }}
                      />
                      <span className="flex-1 text-sm text-[var(--text-primary)]">{s.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gate Requirements */}
            {selectedPipeline.gate_requirements && selectedPipeline.gate_requirements.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Gate Requirements</h3>
                <ul className="space-y-1">
                  {selectedPipeline.gate_requirements.map((req, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--warning)' }}>check_box_outline_blank</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {selectedPipeline.notes && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Notes</h3>
                <p className="text-sm text-[var(--text-secondary)]">{selectedPipeline.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'var(--success)',
    completed: 'var(--info)',
    paused: 'var(--warning)',
    cancelled: 'var(--error)',
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: colors[status] || 'var(--text-muted)' }} />
      <span className="text-[var(--text-secondary)]">{status}</span>
    </div>
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
