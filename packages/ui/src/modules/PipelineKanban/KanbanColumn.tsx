'use client'

import { useState, useCallback } from 'react'
import type { FlowInstanceData } from '@tomachina/core'
import { KanbanCard } from './KanbanCard'

/* ─── Types ─── */

export interface KanbanColumnProps {
  stageId: string
  stageName: string
  stageColor?: string
  stageOrder: number
  gateEnforced: boolean
  instances: FlowInstanceData[]
  count: number
  onDrop: (instanceId: string, stageId: string) => void
  onInstanceClick: (instanceId: string) => void
  /** RDN-005: identifies which pipeline for policy_number vs plan_id choice. */
  pipelineKey?: string
  /** RDN-005: opportunity_id → custom_fields map for carrier/policy/plan lookup. */
  opportunityMap?: Map<string, Record<string, unknown>>
}

/* ─── Component ─── */

export function KanbanColumn({
  stageId,
  stageName,
  stageColor,
  gateEnforced,
  instances,
  count,
  onDrop,
  onInstanceClick,
  pipelineKey,
  opportunityMap,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const instanceId = e.dataTransfer.getData('text/plain')
      if (instanceId) {
        onDrop(instanceId, stageId)
      }
    },
    [onDrop, stageId]
  )

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-[var(--bg-secondary)] transition-colors ${
        dragOver
          ? 'border-[var(--portal)] bg-[var(--portal)]/5'
          : 'border-[var(--border-subtle)]'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Color accent bar */}
      <div
        className="h-1 w-full rounded-t-xl"
        style={{ background: stageColor || 'var(--portal)' }}
      />

      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {stageName}
          </span>
          {gateEnforced && (
            <span
              className="material-icons-outlined text-[var(--warning)]"
              style={{ fontSize: '14px' }}
              title="Gate enforced — requirements must be met to enter this stage"
            >
              lock
            </span>
          )}
        </div>
        <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {instances.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-[var(--text-muted)]">
            No items
          </div>
        ) : (
          instances.map((inst) => (
            <KanbanCard
              key={inst.instance_id}
              instance={inst}
              onClick={() => onInstanceClick(inst.instance_id)}
              pipelineKey={pipelineKey}
              opportunityFields={
                inst.opportunity_id && opportunityMap
                  ? opportunityMap.get(String(inst.opportunity_id))
                  : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  )
}
