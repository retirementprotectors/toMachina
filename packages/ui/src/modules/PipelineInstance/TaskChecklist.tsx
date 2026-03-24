'use client'

import { useState, useMemo, useCallback } from 'react'
import type { FlowTaskInstanceData, CheckResult } from '@tomachina/core'

// ============================================================================
// TaskChecklist — grouped task list with completion, skip, system check badges
// Supports DEX-specific check_types: DEX_KIT_GENERATE, DEX_DOCUSIGN
// ============================================================================

export interface TaskChecklistProps {
  tasks: FlowTaskInstanceData[]
  onCompleteTask: (taskId: string) => void
  onSkipTask: (taskId: string, reason: string) => void
}

/* ─── Helpers ─── */

const CHECK_RESULT_STYLES: Record<CheckResult, { bg: string; text: string; label: string }> = {
  PASS: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Pass' },
  FAIL: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Fail' },
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Pending' },
  SKIPPED: { bg: 'bg-neutral-500/10', text: 'text-neutral-400', label: 'Skipped' },
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-muted)]' },
  in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  skipped: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
  blocked: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

function formatTimestamp(ts?: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface StepGroup {
  stepId: string
  tasks: FlowTaskInstanceData[]
  completed: number
  total: number
}

/* ─── Task Row ─── */

/* ─── DEX Action Button ─── */

function DexActionButton({
  task,
  onComplete,
}: {
  task: FlowTaskInstanceData
  onComplete: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isDexKit = task.check_type === 'DEX_KIT_GENERATE'
  const isDexDocuSign = task.check_type === 'DEX_DOCUSIGN'

  // Parse check_config for package/kit context
  const config = useMemo(() => {
    if (!task.check_config) return {}
    try { return typeof task.check_config === 'string' ? JSON.parse(task.check_config) : task.check_config }
    catch { return {} }
  }, [task.check_config])

  const handleDexAction = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDexKit) {
        // Trigger kit build or just complete the task (the kit is built via DEX UI)
        // Complete the flow task to mark it done
        onComplete()
        setSuccess(true)
      } else if (isDexDocuSign) {
        // If we have a package_id in config, trigger DocuSign send
        const packageId = (config as Record<string, unknown>).package_id
        if (packageId) {
          const res = await fetch(`/api/dex-pipeline/packages/${String(packageId)}/send-docusign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          const data = await res.json()
          if (!data.success) {
            setError(data.error || 'DocuSign send failed')
            setLoading(false)
            return
          }
        }
        // Complete the flow task
        onComplete()
        setSuccess(true)
      }
    } catch {
      setError('Action failed — try again')
    } finally {
      setLoading(false)
    }
  }, [isDexKit, isDexDocuSign, config, onComplete])

  if (success) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <span className="material-icons-outlined" style={{ fontSize: '12px' }}>check_circle</span>
        Done
      </span>
    )
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleDexAction}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: 'var(--portal)' }}
      >
        {loading ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
            {isDexKit ? 'inventory_2' : 'send'}
          </span>
        )}
        {isDexKit ? 'Build Kit' : 'Send for Signature'}
      </button>
      {error && <span className="text-[9px] text-red-400">{error}</span>}
    </div>
  )
}

function TaskRow({
  task,
  onComplete,
  onSkip,
}: {
  task: FlowTaskInstanceData
  onComplete: () => void
  onSkip: (reason: string) => void
}) {
  const [showNotes, setShowNotes] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const [skipReason, setSkipReason] = useState('')

  const isCompleted = task.status === 'completed'
  const isSkipped = task.status === 'skipped'
  const isBlocked = task.status === 'blocked'
  const isDone = isCompleted || isSkipped

  const isDexAction = task.check_type === 'DEX_KIT_GENERATE' || task.check_type === 'DEX_DOCUSIGN'

  const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES.pending

  const handleSkip = () => {
    if (skipReason.trim()) {
      onSkip(skipReason.trim())
      setShowSkip(false)
      setSkipReason('')
    }
  }

  return (
    <div className="rounded-lg bg-[var(--bg-card)] px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* Checkbox — hidden for DEX action tasks (they use action buttons instead) */}
        {!isDexAction ? (
          <button
            onClick={onComplete}
            disabled={isDone || isBlocked}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
              isCompleted
                ? 'border-transparent'
                : 'border-[var(--border-subtle)] hover:border-[var(--portal)]'
            } ${isDone || isBlocked ? 'cursor-default' : 'cursor-pointer'}`}
            style={isCompleted ? { backgroundColor: 'var(--success)' } : undefined}
          >
            {isCompleted && (
              <span className="material-icons-outlined text-white" style={{ fontSize: '14px' }}>
                check
              </span>
            )}
            {isSkipped && (
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                remove
              </span>
            )}
          </button>
        ) : (
          /* DEX icon placeholder for alignment */
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            {isCompleted ? (
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--success)' }}>check_circle</span>
            ) : (
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>
                {task.check_type === 'DEX_KIT_GENERATE' ? 'inventory_2' : 'send'}
              </span>
            )}
          </div>
        )}

        {/* Task name */}
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span
            className={`text-sm ${
              isDone
                ? 'text-[var(--text-muted)] line-through'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {task.task_name}
          </span>

          {/* Required indicator */}
          {task.is_required && (
            <span className="text-red-400" title="Required">*</span>
          )}

          {/* System check badge */}
          {task.is_system_check && task.check_result && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                CHECK_RESULT_STYLES[task.check_result].bg
              } ${CHECK_RESULT_STYLES[task.check_result].text}`}
            >
              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                {task.check_result === 'PASS'
                  ? 'check_circle'
                  : task.check_result === 'FAIL'
                    ? 'cancel'
                    : 'schedule'}
              </span>
              {CHECK_RESULT_STYLES[task.check_result].label}
            </span>
          )}
        </div>

        {/* DEX action button — replaces checkbox for DEX tasks */}
        {isDexAction && !isDone && !isBlocked && (
          <DexActionButton task={task} onComplete={onComplete} />
        )}

        {/* Status pill */}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          {task.status}
        </span>

        {/* Skip button (non-required only, not done, not DEX actions) */}
        {!task.is_required && !isDone && !isBlocked && !isDexAction && (
          <button
            onClick={() => setShowSkip((v) => !v)}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title="Skip task"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
              skip_next
            </span>
          </button>
        )}

        {/* Notes toggle */}
        <button
          onClick={() => setShowNotes((v) => !v)}
          className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          title="Notes"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            {task.notes ? 'sticky_note_2' : 'note_add'}
          </span>
        </button>
      </div>

      {/* Completed by info */}
      {isCompleted && task.completed_by && (
        <div className="mt-1.5 ml-8 text-[10px] text-[var(--text-muted)]">
          Completed by {task.completed_by} {task.completed_at ? `on ${formatTimestamp(task.completed_at)}` : ''}
        </div>
      )}

      {/* Skip reason input */}
      {showSkip && (
        <div className="mt-2 ml-8 flex items-center gap-2">
          <input
            type="text"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Reason for skipping..."
            className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSkip()
            }}
          />
          <button
            onClick={handleSkip}
            disabled={!skipReason.trim()}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--portal)' }}
          >
            Skip
          </button>
        </div>
      )}

      {/* Notes */}
      {showNotes && task.notes && (
        <div className="mt-2 ml-8 rounded-md bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          {task.notes}
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export function TaskChecklist({ tasks, onCompleteTask, onSkipTask }: TaskChecklistProps) {
  // Group tasks by step_id
  const stepGroups = useMemo<StepGroup[]>(() => {
    const groupMap = new Map<string, FlowTaskInstanceData[]>()
    for (const t of tasks) {
      const key = t.step_id || '__ungrouped'
      const group = groupMap.get(key)
      if (group) {
        group.push(t)
      } else {
        groupMap.set(key, [t])
      }
    }

    return Array.from(groupMap.entries()).map(([stepId, stepTasks]) => {
      const sorted = [...stepTasks].sort((a, b) => a.task_order - b.task_order)
      const completed = sorted.filter(
        (t) => t.status === 'completed' || t.status === 'skipped'
      ).length
      return { stepId, tasks: sorted, completed, total: sorted.length }
    })
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-8 text-center">
        <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">
          checklist
        </span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">No tasks for this stage.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stepGroups.map((group) => (
        <div key={group.stepId}>
          {/* Step header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>
              format_list_numbered
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {group.stepId === '__ungrouped' ? 'Tasks' : group.stepId}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {group.completed}/{group.total} tasks
            </span>
            {/* Mini progress bar */}
            <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: group.total > 0 ? `${(group.completed / group.total) * 100}%` : '0%',
                  backgroundColor: 'var(--portal)',
                }}
              />
            </div>
          </div>

          {/* Task rows */}
          <div className="space-y-1">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.task_instance_id}
                task={task}
                onComplete={() => onCompleteTask(task.task_instance_id)}
                onSkip={(reason) => onSkipTask(task.task_instance_id, reason)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
