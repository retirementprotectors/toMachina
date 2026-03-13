'use client'

import { useState, useMemo } from 'react'
import type { FlowActivityData, ActivityAction } from '@tomachina/core'

// ============================================================================
// ActivityTimeline — vertical timeline of instance activity
// ============================================================================

export interface ActivityTimelineProps {
  activities: FlowActivityData[]
  maxItems?: number
}

/* ─── Action config ─── */

interface ActionConfig {
  icon: string
  color: string
  label: string
}

const ACTION_CONFIG: Record<ActivityAction, ActionConfig> = {
  CREATE: { icon: 'add_circle', color: 'var(--portal)', label: 'Created' },
  ADVANCE_STAGE: { icon: 'arrow_forward', color: 'var(--portal)', label: 'Advanced stage' },
  ADVANCE_STEP: { icon: 'subdirectory_arrow_right', color: 'var(--info)', label: 'Advanced step' },
  COMPLETE_TASK: { icon: 'check_circle', color: 'var(--success)', label: 'Completed task' },
  SKIP_TASK: { icon: 'skip_next', color: 'var(--text-muted)', label: 'Skipped task' },
  GATE_PASS: { icon: 'lock_open', color: 'var(--success)', label: 'Gate passed' },
  GATE_FAIL: { icon: 'lock', color: 'var(--error)', label: 'Gate blocked' },
  ASSIGN: { icon: 'person_add', color: 'var(--info)', label: 'Reassigned' },
  PRIORITY_CHANGE: { icon: 'flag', color: 'var(--warning)', label: 'Priority changed' },
  SYSTEM_CHECK: { icon: 'smart_toy', color: 'var(--info)', label: 'System check' },
}

/* ─── Helpers ─── */

function buildDescription(activity: FlowActivityData): string {
  const config = ACTION_CONFIG[activity.action]
  if (!config) return activity.action

  if (activity.from_value && activity.to_value) {
    // Stage/step transitions
    if (activity.action === 'ADVANCE_STAGE' || activity.action === 'ADVANCE_STEP') {
      return `${config.label} from ${activity.from_value} to ${activity.to_value}`
    }
    // Priority change
    if (activity.action === 'PRIORITY_CHANGE') {
      return `Priority changed from ${activity.from_value} to ${activity.to_value}`
    }
    // Reassignment
    if (activity.action === 'ASSIGN') {
      return `Reassigned from ${activity.from_value} to ${activity.to_value}`
    }
    return `${config.label}: ${activity.from_value} \u2192 ${activity.to_value}`
  }

  if (activity.to_value) {
    return `${config.label}: ${activity.to_value}`
  }

  return config.label
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/* ─── Main Component ─── */

export function ActivityTimeline({ activities, maxItems = 20 }: ActivityTimelineProps) {
  const [expanded, setExpanded] = useState(false)

  // Sort newest first
  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
      ),
    [activities]
  )

  const visible = expanded ? sorted : sorted.slice(0, maxItems)
  const hasMore = sorted.length > maxItems

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-6 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">
          history
        </span>
        <p className="mt-1 text-sm text-[var(--text-muted)]">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline connector line */}
      <div
        className="absolute bottom-0 left-[15px] top-0 w-px bg-[var(--border-subtle)]"
        style={{ zIndex: 0 }}
      />

      <div className="space-y-0.5">
        {visible.map((activity) => {
          const config = ACTION_CONFIG[activity.action] || ACTION_CONFIG.CREATE

          return (
            <div key={activity.activity_id} className="relative flex gap-3 py-2">
              {/* Icon dot */}
              <div
                className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)]"
              >
                <span
                  className="material-icons-outlined"
                  style={{ fontSize: '16px', color: config.color }}
                >
                  {config.icon}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <p className="text-sm text-[var(--text-primary)]">
                  {buildDescription(activity)}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  {activity.performed_by && (
                    <span>{activity.performed_by}</span>
                  )}
                  <span>{formatTimestamp(activity.performed_at)}</span>
                </div>
                {activity.notes && (
                  <p className="mt-1 rounded-md bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                    {activity.notes}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more */}
      {hasMore && !expanded && (
        <div className="relative z-10 mt-2 pl-[42px]">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
              expand_more
            </span>
            Show {sorted.length - maxItems} more
          </button>
        </div>
      )}

      {expanded && hasMore && (
        <div className="relative z-10 mt-2 pl-[42px]">
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
              expand_less
            </span>
            Show less
          </button>
        </div>
      )}
    </div>
  )
}
