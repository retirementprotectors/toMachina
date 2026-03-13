'use client'

import type { FlowInstanceData } from '@tomachina/core'

/* ─── Types ─── */

export interface KanbanCardProps {
  instance: FlowInstanceData
  onClick: () => void
}

/* ─── Priority Config ─── */

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: 'bg-red-500/15', text: 'text-red-400' },
  MEDIUM: { bg: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-muted)]' },
  LOW: { bg: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-muted)] opacity-60' },
}

/* ─── Component ─── */

export function KanbanCard({ instance, onClick }: KanbanCardProps) {
  const priority = (instance.priority || 'MEDIUM').toUpperCase()
  const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.MEDIUM

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
      {/* Entity name */}
      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
        {instance.entity_name || 'Unnamed'}
      </p>

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
