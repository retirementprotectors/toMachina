'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { query, orderBy, where, collection as firestoreCollection, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb, collections } from '@tomachina/db/src/firestore'
import { KanbanBoard, Modal, useToast, type KanbanColumn, type KanbanCard } from '@tomachina/ui'

/* ─── Types ─── */
interface PipelineConfig {
  _id: string
  pipeline_key: string
  pipeline_name: string
  domain: string
  portal: string
  is_active: boolean
}

interface PipelineStage {
  _id: string
  pipeline_key: string
  stage_key: string
  stage_name: string
  stage_order: number
  color?: string
}

interface FlowInstance {
  _id: string
  instance_id: string
  pipeline_key: string
  current_stage: string
  entity_type: string
  entity_id: string
  entity_name: string
  entity_data?: {
    client_id?: string
    client_name?: string
    value?: number
    opportunity_type?: string
    due_date?: string
    notes?: string
  }
  assigned_to?: string
  status: string
  priority?: string
  created_at?: string
  updated_at?: string
}

/* ─── Queries ─── */
const pipelinesQuery: Query<DocumentData> = query(
  collections.pipelines(),
  where('portal', '==', 'PRODASHX'),
  where('is_active', '==', true),
  orderBy('pipeline_name')
)

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch { return dateStr }
}

function formatCurrency(val?: number): string {
  if (val == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--portal)',
  complete: '#22c55e',
  won: '#22c55e',
  blocked: '#ef4444',
  stale: '#f59e0b',
  open: 'var(--portal)',
}

const PRIORITY_BADGES: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'High', color: '#ef4444' },
  MEDIUM: { label: 'Medium', color: '#f59e0b' },
  LOW: { label: 'Low', color: '#6b7280' },
}

export default function PipelinesPage() {
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const { data: pipelines, loading: pipelinesLoading } = useCollection<PipelineConfig>(pipelinesQuery, 'prodash-pipelines')

  const [selectedPipeline, setSelectedPipeline] = useState<string>('')
  const [detailInstance, setDetailInstance] = useState<FlowInstance | null>(null)
  const [stageChangeTarget, setStageChangeTarget] = useState<string>('')

  // Auto-select first pipeline or match query param
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipeline) {
      const stageParam = searchParams.get('stage')
      if (stageParam) {
        // Try to find pipeline that matches the stage name
        const matched = pipelines.find(p =>
          p.pipeline_name.toLowerCase().includes(stageParam.replace(/-/g, ' '))
        )
        if (matched) {
          setSelectedPipeline(matched.pipeline_key || matched._id)
          return
        }
      }
      setSelectedPipeline(pipelines[0].pipeline_key || pipelines[0]._id)
    }
  }, [pipelines, selectedPipeline, searchParams])

  // Stages query (depends on selected pipeline)
  const stagesQuery = useMemo(() => {
    if (!selectedPipeline) return null
    return query(
      firestoreCollection(getDb(), 'flow', 'config', 'stages'),
      where('pipeline_key', '==', selectedPipeline),
      orderBy('stage_order')
    ) as Query<DocumentData>
  }, [selectedPipeline])

  // Instances query (depends on selected pipeline)
  const instancesQuery = useMemo(() => {
    if (!selectedPipeline) return null
    return query(
      firestoreCollection(getDb(), 'flow', 'config', 'instances'),
      where('pipeline_key', '==', selectedPipeline),
      where('status', 'in', ['active', 'open', 'blocked'])
    ) as Query<DocumentData>
  }, [selectedPipeline])

  const { data: stages } = useCollection<PipelineStage>(stagesQuery, `stages-${selectedPipeline}`)
  const { data: instances } = useCollection<FlowInstance>(instancesQuery, `instances-${selectedPipeline}`)

  // Build Kanban columns from stages + instances
  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    if (stages.length === 0) {
      // Fallback: default ProDashX pipeline stages
      const defaults = [
        { id: 'discovery', title: 'Discovery', color: '#3d8a8f' },
        { id: 'data-foundation', title: 'Data Foundation', color: '#2563eb' },
        { id: 'case-building', title: 'Case Building', color: '#f59e0b' },
        { id: 'close', title: 'Close', color: '#22c55e' },
      ]
      return defaults.map(s => ({
        ...s,
        cards: instances
          .filter(inst => inst.current_stage === s.id)
          .map(inst => instanceToCard(inst)),
      }))
    }

    return stages
      .sort((a, b) => a.stage_order - b.stage_order)
      .map(stage => ({
        id: stage.stage_key || stage._id,
        title: stage.stage_name,
        color: stage.color || 'var(--portal)',
        cards: instances
          .filter(inst => inst.current_stage === (stage.stage_key || stage._id))
          .map(inst => instanceToCard(inst)),
      }))
  }, [stages, instances]) // eslint-disable-line react-hooks/exhaustive-deps

  const instanceToCard = useCallback((inst: FlowInstance): KanbanCard => {
    const status = inst.status || 'active'
    const priority = inst.priority || 'MEDIUM'
    const badges: KanbanCard['badges'] = []
    const meta: KanbanCard['meta'] = []

    badges.push({ label: status.charAt(0).toUpperCase() + status.slice(1), color: STATUS_COLORS[status] })
    if (PRIORITY_BADGES[priority]) {
      badges.push({ label: PRIORITY_BADGES[priority].label, color: PRIORITY_BADGES[priority].color })
    }

    if (inst.assigned_to) meta.push({ icon: 'person', text: inst.assigned_to })
    if (inst.entity_data?.value) meta.push({ icon: 'payments', text: formatCurrency(inst.entity_data.value) })
    if (inst.entity_data?.due_date) meta.push({ icon: 'event', text: formatDate(inst.entity_data.due_date) })

    return {
      id: inst._id || inst.instance_id,
      title: inst.entity_name || 'Unnamed',
      subtitle: inst.entity_data?.opportunity_type || inst.entity_type,
      badges,
      meta,
      onClick: () => setDetailInstance(inst),
    }
  }, [])

  // Stage change handler
  const handleStageChange = useCallback(async () => {
    if (!detailInstance || !stageChangeTarget) return

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'
      const res = await fetch(`${API_BASE}/pipelines/${detailInstance._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_stage: stageChangeTarget }),
      })
      const result = await res.json()
      if (result.success) {
        showToast('Stage updated', 'success')
        setDetailInstance(null)
        setStageChangeTarget('')
      } else {
        showToast(result.error || 'Failed to update stage', 'error')
      }
    } catch {
      showToast('Failed to connect to API', 'error')
    }
  }, [detailInstance, stageChangeTarget, showToast])

  // Loading
  if (pipelinesLoading) {
    return (
      <div className="mx-auto max-w-full">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
        <div className="mt-6 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            <p className="text-sm text-[var(--text-muted)]">Loading pipelines...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {instances.length} active item{instances.length !== 1 ? 's' : ''} in pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pipeline Selector */}
          {pipelines.length > 1 && (
            <select
              value={selectedPipeline}
              onChange={e => setSelectedPipeline(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              {pipelines.map(p => (
                <option key={p.pipeline_key || p._id} value={p.pipeline_key || p._id}>
                  {p.pipeline_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ─── Kanban Board ─── */}
      <div className="mt-6">
        <KanbanBoard
          columns={kanbanColumns}
          emptyMessage="No active pipeline items. New instances will appear here when created."
        />
      </div>

      {/* ─── Detail Modal ─── */}
      <Modal
        open={!!detailInstance}
        onClose={() => { setDetailInstance(null); setStageChangeTarget('') }}
        title={detailInstance?.entity_name || 'Pipeline Item'}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setDetailInstance(null); setStageChangeTarget('') }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Close
            </button>
            {stageChangeTarget && stageChangeTarget !== detailInstance?.current_stage && (
              <button
                onClick={handleStageChange}
                className="rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Move to Stage
              </button>
            )}
          </div>
        }
      >
        {detailInstance && (
          <div className="space-y-4">
            {/* Status bar */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-medium" style={{
                background: `${STATUS_COLORS[detailInstance.status] || 'var(--bg-surface)'}20`,
                color: STATUS_COLORS[detailInstance.status] || 'var(--text-muted)',
              }}>
                {detailInstance.status}
              </span>
              {detailInstance.priority && PRIORITY_BADGES[detailInstance.priority] && (
                <span className="rounded-full px-3 py-1 text-xs font-medium" style={{
                  background: `${PRIORITY_BADGES[detailInstance.priority].color}20`,
                  color: PRIORITY_BADGES[detailInstance.priority].color,
                }}>
                  {PRIORITY_BADGES[detailInstance.priority].label} Priority
                </span>
              )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-[var(--text-muted)]">Client / Entity</span>
                <p className="font-medium text-[var(--text-primary)]">{detailInstance.entity_name}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)]">Type</span>
                <p className="text-[var(--text-secondary)]">{detailInstance.entity_data?.opportunity_type || detailInstance.entity_type}</p>
              </div>
              {detailInstance.assigned_to && (
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Assigned To</span>
                  <p className="text-[var(--text-secondary)]">{detailInstance.assigned_to}</p>
                </div>
              )}
              {detailInstance.entity_data?.value != null && (
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Value</span>
                  <p className="font-medium text-[var(--text-primary)]">{formatCurrency(detailInstance.entity_data.value)}</p>
                </div>
              )}
              {detailInstance.entity_data?.due_date && (
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Due Date</span>
                  <p className="text-[var(--text-secondary)]">{formatDate(detailInstance.entity_data.due_date)}</p>
                </div>
              )}
              {detailInstance.created_at && (
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Created</span>
                  <p className="text-[var(--text-secondary)]">{formatDate(detailInstance.created_at)}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            {detailInstance.entity_data?.notes && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">Notes</span>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{detailInstance.entity_data.notes}</p>
              </div>
            )}

            {/* Stage Change */}
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <label className="mb-2 block text-xs font-medium text-[var(--text-muted)]">Move to Stage</label>
              <div className="flex flex-wrap gap-2">
                {kanbanColumns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => setStageChangeTarget(col.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      col.id === detailInstance.current_stage
                        ? 'border-[var(--portal)] bg-[var(--portal-glow)] text-[var(--portal)]'
                        : stageChangeTarget === col.id
                          ? 'border-[var(--portal)] bg-[var(--portal)] text-white'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--portal)]'
                    }`}
                  >
                    {col.id === detailInstance.current_stage && (
                      <span className="mr-1">Current:</span>
                    )}
                    {col.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
