'use client'

import { fetchWithAuth } from '../fetchWithAuth'
import { useState, useEffect, useCallback } from 'react'
import type {
  FlowInstanceData,
  FlowTaskInstanceData,
  FlowActivityData,
  FlowStageDef,
  GateResult,
} from '@tomachina/core'
import { StageProgressBar } from './StageProgressBar'
import { TaskChecklist } from './TaskChecklist'
import { ActivityTimeline } from './ActivityTimeline'
import { GateStatus } from './GateStatus'

// ============================================================================
// InstanceDetail — main container for viewing a single pipeline instance
// ============================================================================

export interface InstanceDetailProps {
  instanceId: string
  portal: 'prodashx' | 'riimo' | 'sentinel'
  apiBase?: string
  onBack?: () => void
  className?: string
}

/* ─── API response shapes ─── */

interface InstanceDetailResponse {
  success: boolean
  data?: {
    instance: FlowInstanceData
    tasks: FlowTaskInstanceData[]
    activity: FlowActivityData[]
    stages: FlowStageDef[]
    gateResult?: GateResult | null
  }
  error?: string
}

interface ActionResponse {
  success: boolean
  data?: unknown
  error?: string
}

/* ─── Priority config ─── */

const PRIORITY_CONFIG: Record<string, { icon: string; color: string }> = {
  HIGH: { icon: 'priority_high', color: 'var(--error)' },
  MEDIUM: { icon: 'drag_handle', color: 'var(--warning)' },
  LOW: { icon: 'arrow_downward', color: 'var(--info)' },
  URGENT: { icon: 'local_fire_department', color: 'var(--error)' },
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

/* ─── Main Component ─── */

export default function InstanceDetail({
  instanceId,
  portal,
  apiBase = '/api',
  onBack,
  className = '',
}: InstanceDetailProps) {
  const [instance, setInstance] = useState<FlowInstanceData | null>(null)
  const [tasks, setTasks] = useState<FlowTaskInstanceData[]>([])
  const [activity, setActivity] = useState<FlowActivityData[]>([])
  const [stages, setStages] = useState<FlowStageDef[]>([])
  const [gateResult, setGateResult] = useState<GateResult | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [reassignTo, setReassignTo] = useState('')
  const [showPriority, setShowPriority] = useState(false)

  /* ─── Fetch instance detail ─── */

  const fetchInstance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchWithAuth(`${apiBase}/flow/instances/${instanceId}`)
      const json: InstanceDetailResponse = await res.json()

      if (!json.success || !json.data) {
        setError(json.error || 'Failed to load instance')
        return
      }

      setInstance(json.data.instance)
      setTasks(json.data.tasks)
      setActivity(json.data.activity)
      setStages(json.data.stages || [])
      setGateResult(json.data.gateResult ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [apiBase, instanceId])

  useEffect(() => {
    fetchInstance()
  }, [fetchInstance])

  /* ─── Actions ─── */

  const performAction = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      try {
        setActionLoading(true)
        const res = await fetchWithAuth(`${apiBase}/flow/instances/${instanceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...body }),
        })
        const json: ActionResponse = await res.json()
        if (!json.success) {
          setError(json.error || `Action "${action}" failed`)
          return
        }
        // Refresh data
        await fetchInstance()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        setActionLoading(false)
      }
    },
    [apiBase, instanceId, fetchInstance]
  )

  const handleAdvance = () => performAction('advance')

  const handleCompleteTask = (taskId: string) =>
    performAction('complete_task', { task_instance_id: taskId })

  const handleSkipTask = (taskId: string, reason: string) =>
    performAction('skip_task', { task_instance_id: taskId, reason })

  const handleReassign = () => {
    if (reassignTo.trim()) {
      performAction('reassign', { assigned_to: reassignTo.trim() })
      setShowReassign(false)
      setReassignTo('')
    }
  }

  const handlePriorityChange = (priority: string) => {
    performAction('change_priority', { priority })
    setShowPriority(false)
  }

  /* ─── Derived state ─── */

  const currentStageDef = stages.find((s) => s.stage_id === instance?.current_stage)
  const currentStageName = currentStageDef?.stage_name || instance?.current_stage || 'Unknown'
  const canAdvance = gateResult === null || gateResult.pass
  const priorityConfig = PRIORITY_CONFIG[instance?.priority || 'MEDIUM'] || PRIORITY_CONFIG.MEDIUM

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div className={`mx-auto max-w-4xl ${className}`}>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* ─── Error state ─── */
  if (error && !instance) {
    return (
      <div className={`mx-auto max-w-4xl ${className}`}>
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Back
          </button>
        )}
        <div className="rounded-xl border border-[var(--error)] bg-red-500/5 p-6 text-sm text-[var(--text-secondary)]">
          {error}
        </div>
      </div>
    )
  }

  if (!instance) return null

  /* ─── Main render ─── */

  return (
    <div className={`mx-auto max-w-4xl space-y-6 ${className}`}>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back to Board
        </button>
      )}

      {/* Header */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {instance.entity_name}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {instance.pipeline_key}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Priority badge */}
            <button
              onClick={() => setShowPriority((v) => !v)}
              className="relative flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${priorityConfig.color}15`, color: priorityConfig.color }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                {priorityConfig.icon}
              </span>
              {instance.priority || 'MEDIUM'}
            </button>

            {/* Assigned to */}
            <button
              onClick={() => setShowReassign((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person</span>
              {instance.assigned_to || 'Unassigned'}
            </button>
          </div>
        </div>

        {/* Priority dropdown */}
        {showPriority && (
          <div className="mt-3 flex flex-wrap gap-2">
            {PRIORITIES.map((p) => {
              const pc = PRIORITY_CONFIG[p] || PRIORITY_CONFIG.MEDIUM
              return (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  disabled={actionLoading}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: `${pc.color}15`, color: pc.color }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>
                    {pc.icon}
                  </span>
                  {p}
                </button>
              )
            })}
          </div>
        )}

        {/* Reassign input */}
        {showReassign && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="email"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              placeholder="Reassign to (email)..."
              className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReassign()
              }}
            />
            <button
              onClick={handleReassign}
              disabled={!reassignTo.trim() || actionLoading}
              className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--portal)' }}
            >
              Reassign
            </button>
          </div>
        )}
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <span className="material-icons-outlined text-red-400" style={{ fontSize: '16px' }}>
            warning
          </span>
          <p className="flex-1 text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {/* Stage Progress Bar */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Stage Progress
        </h3>
        <StageProgressBar
          stages={stages.map((s) => ({
            stage_id: s.stage_id,
            stage_name: s.stage_name,
            stage_color: s.stage_color,
            stage_order: s.stage_order,
          }))}
          currentStageId={instance.current_stage}
        />
      </div>

      {/* Gate Status */}
      {currentStageDef?.gate_enforced && (
        <GateStatus gateResult={gateResult} stageName={currentStageName} />
      )}

      {/* Task Checklist */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
            checklist
          </span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Tasks: {currentStageName}
          </h3>
        </div>
        <TaskChecklist
          tasks={tasks.filter((t) => t.stage_id === instance.current_stage)}
          onCompleteTask={handleCompleteTask}
          onSkipTask={handleSkipTask}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleAdvance}
          disabled={!canAdvance || actionLoading}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--portal)' }}
          title={!canAdvance ? 'Gate requirements not met' : 'Advance to next stage'}
        >
          {actionLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
              arrow_forward
            </span>
          )}
          Advance Stage
        </button>

        <button
          onClick={() => setShowReassign((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
            person_add
          </span>
          Reassign
        </button>

        <button
          onClick={() => setShowPriority((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
            flag
          </span>
          Priority
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <button
          onClick={() => setShowActivity((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
              history
            </span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Activity</h3>
            <span className="text-[10px] text-[var(--text-muted)]">({activity.length})</span>
          </div>
          <span
            className="material-icons-outlined text-[var(--text-muted)] transition-transform"
            style={{
              fontSize: '18px',
              transform: showActivity ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            expand_more
          </span>
        </button>

        {showActivity && (
          <div className="mt-4">
            <ActivityTimeline activities={activity} />
          </div>
        )}
      </div>
    </div>
  )
}
