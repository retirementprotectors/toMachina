'use client'

import { useState, useMemo } from 'react'
import type {
  FlowStageDef,
  FlowStepDef,
  FlowTaskTemplateDef,
} from '@tomachina/core'

// ============================================================================
// FlowPreview — Read-only visual flow preview of a pipeline
// Horizontal stage flow with expandable steps and tasks
// ============================================================================

export interface FlowPreviewProps {
  pipelineKey: string
  stages: FlowStageDef[]
  steps: Record<string, FlowStepDef[]>
  tasks: Record<string, FlowTaskTemplateDef[]>
}

/* --- Task badge --- */

function TaskBadge({ task }: { task: FlowTaskTemplateDef }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-[var(--bg-surface)] px-2.5 py-1.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-card)]">
        {task.task_order}
      </span>
      <span className="flex-1 truncate text-[10px] text-[var(--text-primary)]">
        {task.task_name}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {task.is_required && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1 py-0.5 text-[9px] font-medium text-red-400">
            <span className="material-icons-outlined" style={{ fontSize: '8px' }}>star</span>
            Req
          </span>
        )}
        {task.is_system_check && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/10 px-1 py-0.5 text-[9px] font-medium text-blue-400">
            <span className="material-icons-outlined" style={{ fontSize: '8px' }}>smart_toy</span>
            {task.check_type || 'Sys'}
          </span>
        )}
      </div>
    </div>
  )
}

/* --- Step card --- */

function StepCard({
  step,
  stepTasks,
}: {
  step: FlowStepDef
  stepTasks: FlowTaskTemplateDef[]
}) {
  const [expanded, setExpanded] = useState(false)
  const sorted = useMemo(
    () => [...stepTasks].sort((a, b) => a.task_order - b.task_order),
    [stepTasks]
  )

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-surface)]">
            {step.step_order}
          </span>
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {step.step_name}
          </span>
          {step.gate_enforced && (
            <span className="material-icons-outlined text-amber-400" style={{ fontSize: '10px' }}>lock</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">
            {sorted.length} task{sorted.length !== 1 ? 's' : ''}
          </span>
          <span
            className="material-icons-outlined text-[var(--text-muted)] transition-transform"
            style={{ fontSize: '14px', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {expanded && sorted.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-2 pb-2 pt-1.5 space-y-1">
          {sorted.map((task) => (
            <TaskBadge key={task.task_id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

/* --- Stage box --- */

function StageBox({
  stage,
  stageSteps,
  stageTasks,
  isLast,
}: {
  stage: FlowStageDef
  stageSteps: FlowStepDef[]
  stageTasks: Record<string, FlowTaskTemplateDef[]>
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const sorted = useMemo(
    () => [...stageSteps].sort((a, b) => a.step_order - b.step_order),
    [stageSteps]
  )

  const totalTasks = Object.values(stageTasks).reduce((sum, t) => sum + t.length, 0)

  return (
    <div className="flex items-start">
      {/* Stage card */}
      <div className="w-56 shrink-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-left transition-colors hover:border-[var(--border-medium)]"
        >
          {/* Color header stripe */}
          <div
            className="h-1.5 rounded-t-xl"
            style={{ backgroundColor: stage.stage_color || 'var(--portal)' }}
          />

          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {stage.stage_name}
              </span>
              {stage.gate_enforced && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                  <span className="material-icons-outlined" style={{ fontSize: '9px' }}>lock</span>
                  Gate
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
              <span className="flex items-center gap-0.5">
                <span className="material-icons-outlined" style={{ fontSize: '10px' }}>checklist</span>
                {sorted.length} step{sorted.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-0.5">
                <span className="material-icons-outlined" style={{ fontSize: '10px' }}>task_alt</span>
                {totalTasks} task{totalTasks !== 1 ? 's' : ''}
              </span>
            </div>

            {expanded && (
              <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: 'var(--portal)' }}>
                <span>Click to collapse</span>
              </div>
            )}
            {!expanded && sorted.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: 'var(--portal)' }}>
                <span>Click to expand</span>
              </div>
            )}
          </div>
        </button>

        {/* Expanded step list */}
        {expanded && sorted.length > 0 && (
          <div className="mt-2 space-y-1.5 pl-2">
            {sorted.map((step) => (
              <StepCard
                key={step.step_id}
                step={step}
                stepTasks={stageTasks[step.step_id] || []}
              />
            ))}
          </div>
        )}
      </div>

      {/* Arrow to next stage */}
      {!isLast && (
        <div className="flex shrink-0 items-center px-3 pt-8">
          <div className="h-px w-6 bg-[var(--border-subtle)]" />
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
            arrow_forward
          </span>
          <div className="h-px w-6 bg-[var(--border-subtle)]" />
        </div>
      )}
    </div>
  )
}

/* --- Main Component --- */

export default function FlowPreview({
  pipelineKey,
  stages,
  steps,
  tasks,
}: FlowPreviewProps) {
  const sorted = useMemo(
    () => [...stages].sort((a, b) => a.stage_order - b.stage_order),
    [stages]
  )

  /* --- Aggregate counts --- */
  const totalStages = sorted.length
  const totalSteps = Object.values(steps).reduce((sum, s) => sum + s.length, 0)
  const totalTasks = Object.values(tasks).reduce((sum, t) => sum + t.length, 0)
  const totalGates = sorted.filter((s) => s.gate_enforced).length
    + Object.values(steps).flat().filter((s) => s.gate_enforced).length

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">account_tree</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No stages defined for {pipelineKey}
        </p>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Add stages to see the flow preview
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>layers</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{totalStages}</span>
          <span className="text-[10px] text-[var(--text-muted)]">stages</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>checklist</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{totalSteps}</span>
          <span className="text-[10px] text-[var(--text-muted)]">steps</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>task_alt</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{totalTasks}</span>
          <span className="text-[10px] text-[var(--text-muted)]">tasks</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-1.5">
          <span className="material-icons-outlined text-amber-400" style={{ fontSize: '14px' }}>lock</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{totalGates}</span>
          <span className="text-[10px] text-[var(--text-muted)]">gates</span>
        </div>
      </div>

      {/* Horizontal flow */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start">
          {sorted.map((stage, i) => {
            const stageSteps = steps[stage.stage_id] || []
            const stageTasks: Record<string, FlowTaskTemplateDef[]> = {}
            for (const step of stageSteps) {
              stageTasks[step.step_id] = tasks[step.step_id] || []
            }

            return (
              <StageBox
                key={stage.stage_id}
                stage={stage}
                stageSteps={stageSteps}
                stageTasks={stageTasks}
                isLast={i === sorted.length - 1}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
