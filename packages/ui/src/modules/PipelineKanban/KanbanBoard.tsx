'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import { useAuth } from '@tomachina/auth'
import type { FlowInstanceData, FlowStageDef, GateResult } from '@tomachina/core'
import { buildKanbanBoard } from '@tomachina/core'
import { KanbanColumn } from './KanbanColumn'
import { KanbanFilters, type PipelineFilters } from './KanbanFilters'
import { BoardViewToggle, type BoardView } from './BoardViewToggle'

/* ─── Types ─── */

export interface PipelineKanbanProps {
  pipelineKey: string
  portal: 'prodashx' | 'riimo' | 'sentinel'
  apiBase?: string
  onInstanceClick?: (instanceId: string) => void
  className?: string
}

interface StageWithGate extends FlowStageDef {
  gate_enforced: boolean
}

/* ─── API Helpers ─── */

async function fetchStages(apiBase: string, pipelineKey: string): Promise<StageWithGate[]> {
  const res = await fetchWithAuth(`${apiBase}/flow/pipelines/${pipelineKey}/stages`)
  if (!res.ok) throw new Error(`Failed to fetch stages: ${res.status}`)
  const json = await res.json() as { data?: StageWithGate[] }
  return json.data || []
}

async function fetchInstances(apiBase: string, pipelineKey: string): Promise<FlowInstanceData[]> {
  const res = await fetchWithAuth(`${apiBase}/flow/instances?pipeline_key=${pipelineKey}`)
  if (!res.ok) throw new Error(`Failed to fetch instances: ${res.status}`)
  const json = await res.json() as { data?: FlowInstanceData[] }
  return json.data || []
}

async function moveInstance(
  apiBase: string,
  instanceId: string,
  targetStage: string,
  performedBy: string
): Promise<{ success: boolean; gate_result?: GateResult }> {
  const res = await fetchWithAuth(`${apiBase}/flow/instances/${instanceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'move',
      target_stage: targetStage,
      performed_by: performedBy,
    }),
  })
  const json = await res.json() as { success: boolean; gate_result?: GateResult; error?: string }
  return json
}

/* ─── Filter Logic ─── */

function applyFilters(instances: FlowInstanceData[], filters: PipelineFilters): FlowInstanceData[] {
  let result = instances

  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (i) => (i.entity_name || '').toLowerCase().includes(q)
    )
  }

  if (filters.assigned_to) {
    result = result.filter((i) => i.assigned_to === filters.assigned_to)
  }

  if (filters.priority) {
    result = result.filter(
      (i) => (i.priority || 'MEDIUM').toUpperCase() === filters.priority?.toUpperCase()
    )
  }

  return result
}

/* ─── List View (placeholder with grouped instances) ─── */

function ListView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">view_list</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

/* ─── Table View (placeholder) ─── */

function TableView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">table_chart</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

/* ─── Main Component ─── */

export default function PipelineKanban({
  pipelineKey,
  portal,
  apiBase = '/api',
  onInstanceClick,
  className,
}: PipelineKanbanProps) {
  /* Auth */
  const { user } = useAuth()

  /* State */
  const [stages, setStages] = useState<StageWithGate[]>([])
  const [instances, setInstances] = useState<FlowInstanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<BoardView>('kanban')
  const [filters, setFilters] = useState<PipelineFilters>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  /* Load data */
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [stageData, instanceData] = await Promise.all([
        fetchStages(apiBase, pipelineKey),
        fetchInstances(apiBase, pipelineKey),
      ])
      setStages(stageData)
      setInstances(instanceData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load pipeline data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [apiBase, pipelineKey])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* Build gate lookup */
  const gateMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const s of stages) {
      map.set(s.stage_id, s.gate_enforced)
    }
    return map
  }, [stages])

  /* Unique assignees for filter dropdown */
  const assignees = useMemo(() => {
    const set = new Set<string>()
    for (const inst of instances) {
      if (inst.assigned_to) set.add(inst.assigned_to)
    }
    return Array.from(set).sort()
  }, [instances])

  /* Filtered instances */
  const filteredInstances = useMemo(
    () => applyFilters(instances, filters),
    [instances, filters]
  )

  /* Build kanban columns */
  const columns = useMemo(
    () => buildKanbanBoard(stages, filteredInstances),
    [stages, filteredInstances]
  )

  /* Toast auto-dismiss */
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  /* Drag & Drop handler */
  const handleDrop = useCallback(
    async (instanceId: string, targetStageId: string) => {
      // Find current instance
      const inst = instances.find((i) => i.instance_id === instanceId)
      if (!inst) return
      // No-op if same stage
      if (inst.current_stage === targetStageId) return

      // Optimistic update
      const prevInstances = [...instances]
      setInstances((prev) =>
        prev.map((i) =>
          i.instance_id === instanceId ? { ...i, current_stage: targetStageId } : i
        )
      )

      try {
        const result = await moveInstance(apiBase, instanceId, targetStageId, user?.email || 'unknown')

        if (!result.success) {
          // Gate failure or other error — revert
          setInstances(prevInstances)

          if (result.gate_result && !result.gate_result.pass) {
            const blockerList = result.gate_result.blockers
              .map((b) => b.reason || b.task_name)
              .join(', ')
            setToastMessage(`Gate blocked: ${blockerList}`)
          } else {
            setToastMessage('Move failed. Instance reverted.')
          }
          return
        }

        // Refresh data after successful move
        await loadData()
      } catch {
        // Network error — revert
        setInstances(prevInstances)
        setToastMessage('Network error. Instance reverted.')
      }
    },
    [instances, apiBase, loadData, user]
  )

  /* Instance click */
  const handleInstanceClick = useCallback(
    (instanceId: string) => {
      onInstanceClick?.(instanceId)
    },
    [onInstanceClick]
  )

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className={`space-y-4 ${className || ''}`}>
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-[var(--bg-surface)]" />
          <div className="h-8 w-32 animate-pulse rounded bg-[var(--bg-surface)]" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="w-72 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="h-4 w-20 animate-pulse rounded bg-[var(--bg-surface)]" />
              <div className="mt-4 space-y-3">
                <div className="h-16 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
                <div className="h-16 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ─── Error State ─── */
  if (error) {
    return (
      <div className={className || ''}>
        <div className="rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6">
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-[var(--error)]" style={{ fontSize: '24px' }}>
              error_outline
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load pipeline</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{error}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="mt-4 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors"
            style={{ background: 'var(--portal)' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  /* ─── Main Render ─── */
  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Toolbar: Filters + View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <KanbanFilters onFilterChange={setFilters} assignees={assignees} />
        <BoardViewToggle view={view} onViewChange={setView} />
      </div>

      {/* Board / List / Table */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
              <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">view_kanban</span>
              <p className="mt-4 text-sm text-[var(--text-muted)]">No stages configured for this pipeline.</p>
            </div>
          ) : (
            columns.map((col) => (
              <KanbanColumn
                key={col.stage_id}
                stageId={col.stage_id}
                stageName={col.stage_name}
                stageColor={col.stage_color}
                stageOrder={col.stage_order}
                gateEnforced={gateMap.get(col.stage_id) || false}
                instances={col.instances}
                count={col.count}
                onDrop={handleDrop}
                onInstanceClick={handleInstanceClick}
              />
            ))
          )}
        </div>
      )}

      {view === 'list' && <ListView message="List view coming soon" />}
      {view === 'table' && <TableView message="Table view coming soon" />}

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 shadow-lg">
          <span className="material-icons-outlined text-[var(--warning)]" style={{ fontSize: '18px' }}>
            warning
          </span>
          <span className="text-sm text-[var(--text-primary)]">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}
    </div>
  )
}
