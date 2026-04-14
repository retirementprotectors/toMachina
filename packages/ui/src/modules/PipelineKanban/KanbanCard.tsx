'use client'

import { useMemo } from 'react'
import type { FlowInstanceData } from '@tomachina/core'

/* ─── Types ─── */

export interface KanbanCardProps {
  instance: FlowInstanceData
  onClick: () => void
  /** RDN-005: current pipeline key — drives policy_number vs plan_id label. */
  pipelineKey?: string
  /**
   * RDN-005: custom_fields from the linked opportunity (if any). Supplies
   * carrier + policy_number / plan_id for the card identity row.
   */
  opportunityFields?: Record<string, unknown>
}

/** Pipelines whose canonical case identifier is `plan_id`, not `policy_number`. */
const MEDICARE_PIPELINE_KEYS = new Set([
  'NBX_MEDICARE_MAPD',    // MAPD + PDP share this schema
  'NBX_MEDICARE_MEDSUP',  // Medicare Supplement / Ancillary
  'REACTIVE_MEDICARE',    // Reactive Service — Medicare
])

/* ─── Priority Config ─── */

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: 'bg-red-500/15', text: 'text-red-400' },
  MEDIUM: { bg: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-muted)]' },
  LOW: { bg: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-muted)] opacity-60' },
}

/* ─── Helpers ─── */

function parseEntityData(raw: string | Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

/* ─── Component ─── */

export function KanbanCard({ instance, onClick, pipelineKey, opportunityFields }: KanbanCardProps) {
  const priority = (instance.priority || 'MEDIUM').toUpperCase()
  const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.MEDIUM
  const isHousehold = (instance.entity_type || '').toUpperCase() === 'HOUSEHOLD'

  // RDN-005: carrier + case identifier row. Medicare pipelines show plan_id,
  // everything else shows policy_number. Carrier is universal.
  const carrier = opportunityFields
    ? (typeof opportunityFields.carrier === 'string' ? opportunityFields.carrier : '')
    : ''
  const usePlanId = pipelineKey ? MEDICARE_PIPELINE_KEYS.has(pipelineKey) : false
  const caseIdKey = usePlanId ? 'plan_id' : 'policy_number'
  const caseIdLabel = usePlanId ? 'Plan ID' : 'Policy'
  const caseIdValue = opportunityFields && typeof opportunityFields[caseIdKey] === 'string'
    ? (opportunityFields[caseIdKey] as string)
    : ''
  const showIdentityRow = Boolean(carrier || caseIdValue)

  // Parse entity_data for household member info
  const entityData = useMemo(() => parseEntityData(instance.entity_data as string | Record<string, unknown>), [instance.entity_data])
  const memberNames = useMemo(() => {
    if (!isHousehold || !entityData) return []
    const members = entityData.members as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(members)) return []
    return members.slice(0, 4).map(m => String(m.client_name || m.name || '').split(' ')[0]).filter(Boolean)
  }, [isHousehold, entityData])

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', instance.instance_id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)] active:scale-[0.98]"
    >
      {/* Entity name with household badge */}
      <div className="flex items-center gap-1.5">
        {isHousehold && (
          <span className="material-icons-outlined text-[14px] text-[var(--portal)]" title="Household">
            home
          </span>
        )}
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {instance.entity_name || 'Unnamed'}
        </p>
      </div>

      {/* Household member names */}
      {isHousehold && memberNames.length > 0 && (
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)] truncate">
          {memberNames.join(', ')}
        </p>
      )}

      {/* RDN-005: Carrier + policy_number / plan_id */}
      {showIdentityRow && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate">
          {carrier && (
            <span className="truncate font-medium">{carrier}</span>
          )}
          {carrier && caseIdValue && (
            <span className="text-[var(--text-muted)]">·</span>
          )}
          {caseIdValue && (
            <span className="truncate font-mono text-[10px]" title={`${caseIdLabel}: ${caseIdValue}`}>
              {caseIdValue}
            </span>
          )}
        </div>
      )}

      {/* Assigned advisor */}
      {instance.assigned_to && (
        <div className="mt-1 flex items-center gap-1">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '12px' }}>
            person
          </span>
          <span className="text-xs text-[var(--text-muted)] truncate">
            {instance.assigned_to}
          </span>
        </div>
      )}

      {/* Bottom row: priority badge + step indicator */}
      <div className="mt-2 flex items-center justify-between">
        {/* Priority badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityStyle.bg} ${priorityStyle.text}`}
        >
          {priority}
        </span>

        {/* Current step indicator */}
        {instance.current_step && (
          <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>
              radio_button_checked
            </span>
            <span className="truncate max-w-[80px]">{instance.current_step}</span>
          </span>
        )}
      </div>
    </div>
  )
}
