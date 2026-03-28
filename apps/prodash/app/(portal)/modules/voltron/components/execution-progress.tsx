'use client'

import type { ExecutionPhase, VoltronStageResult } from '../types'

interface ExecutionProgressProps {
  phase: ExecutionPhase
  stages: VoltronStageResult[]
  currentStage: string | null
  wireId: string | null
  executionId: string | null
  simulation: boolean
  error: string | null
  onApprove: () => void
  onReject: () => void
  onReset: () => void
}

/** Icon + color for each stage status */
function stageIcon(stage: VoltronStageResult): { icon: string; color: string } {
  switch (stage.status) {
    case 'complete':
      return { icon: 'check_circle', color: 'var(--success)' }
    case 'error':
      return { icon: 'error', color: 'var(--error)' }
    case 'running':
      return { icon: 'pending', color: 'var(--info)' }
    case 'approval_pending':
      return { icon: 'gpp_maybe', color: 'var(--warning)' }
    case 'skipped':
      return { icon: 'skip_next', color: 'var(--text-muted)' }
    case 'pending':
    default:
      return { icon: 'radio_button_unchecked', color: 'var(--text-muted)' }
  }
}

/** Compute duration from start/completed timestamps (ms) */
function stageDuration(stage: VoltronStageResult): number | null {
  if (!stage.started_at || !stage.completed_at) return null
  return new Date(stage.completed_at).getTime() - new Date(stage.started_at).getTime()
}

/**
 * Real-time wire execution progress visualization.
 * Shows stage-by-stage progress with SSE updates, approval gate UI, and error handling.
 */
export function ExecutionProgress({
  phase,
  stages,
  currentStage,
  wireId,
  executionId,
  simulation,
  error,
  onApprove,
  onReject,
  onReset,
}: ExecutionProgressProps) {
  if (phase === 'idle') return null

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PhaseIndicator phase={phase} />
          <div>
            <div className="font-semibold text-sm text-[var(--text-primary)]">
              {wireId?.replace(/_/g, ' ') ?? 'Wire Execution'}
            </div>
            {executionId && (
              <div className="text-[10px] font-mono text-[var(--text-muted)]">
                {executionId}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {simulation && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)]">
              <span className="material-icons-outlined text-[14px]">science</span>
              Simulation
            </span>
          )}
          {(phase === 'complete' || phase === 'error') && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
            >
              <span className="material-icons-outlined text-[14px]">refresh</span>
              New Execution
            </button>
          )}
        </div>
      </div>

      {/* Stage timeline */}
      <div className="space-y-0">
        {stages.map((stage, idx) => {
          const { icon, color } = stageIcon(stage)
          return (
            <div key={`${stage.stage}-${idx}`} className="flex items-start gap-3 py-2">
              <div className="flex flex-col items-center shrink-0">
                <span
                  className="material-icons-outlined text-[20px]"
                  style={{ color }}
                >
                  {icon}
                </span>
                {(idx < stages.length - 1 || currentStage) && (
                  <div className="w-px h-4 bg-[var(--border)]" />
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="text-sm text-[var(--text-primary)] font-medium">
                  {formatStageName(stage.stage)}
                </div>
                {stage.error && (
                  <div className="text-xs text-[var(--error)] mt-0.5">{stage.error}</div>
                )}
                {(() => {
                  const ms = stageDuration(stage)
                  return ms != null && ms > 0 ? (
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {ms}ms
                    </div>
                  ) : null
                })()}
              </div>
            </div>
          )
        })}

        {/* Current executing stage */}
        {currentStage && phase === 'executing' && (
          <div className="flex items-start gap-3 py-2">
            <div className="flex flex-col items-center shrink-0">
              <span className="material-icons-outlined text-[20px] text-[var(--portal)] animate-pulse">
                pending
              </span>
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="text-sm text-[var(--portal)] font-medium">
                {formatStageName(currentStage)}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Executing...</div>
            </div>
          </div>
        )}

        {/* Loading indicator when executing but no current stage name yet */}
        {phase === 'executing' && !currentStage && stages.length === 0 && (
          <div className="flex items-center gap-3 py-2">
            <span className="material-icons-outlined text-[20px] text-[var(--portal)] animate-spin">
              sync
            </span>
            <div className="text-sm text-[var(--text-secondary)]">Starting wire execution...</div>
          </div>
        )}
      </div>

      {/* Approval gate */}
      {phase === 'approval_pending' && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-[20px] text-[var(--warning)]">
              gpp_maybe
            </span>
            <div className="text-sm font-semibold text-[var(--warning)]">
              Approval Required
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            The next stage requires your approval before proceeding.
            {currentStage && (
              <> Pending: <strong>{formatStageName(currentStage)}</strong></>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--success)] text-white hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              <span className="material-icons-outlined text-[16px]">check</span>
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all flex items-center gap-1.5"
            >
              <span className="material-icons-outlined text-[16px]">close</span>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {phase === 'error' && error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error)]/5 p-4">
          <div className="flex items-start gap-2">
            <span className="material-icons-outlined text-[18px] text-[var(--error)] shrink-0 mt-0.5">
              error_outline
            </span>
            <div className="text-sm text-[var(--error)]">{error}</div>
          </div>
        </div>
      )}

      {/* Completion banner */}
      {phase === 'complete' && (
        <div className="rounded-lg border border-[var(--success)] bg-[var(--success)]/5 p-4">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-[20px] text-[var(--success)]">
              task_alt
            </span>
            <div className="text-sm font-semibold text-[var(--success)]">
              {simulation ? 'Simulation Complete' : 'Wire Execution Complete'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Phase badge with animated indicator */
function PhaseIndicator({ phase }: { phase: ExecutionPhase }) {
  const config: Record<ExecutionPhase, { icon: string; color: string; label: string }> = {
    idle: { icon: 'radio_button_unchecked', color: 'var(--text-muted)', label: 'Idle' },
    executing: { icon: 'sync', color: 'var(--info)', label: 'Executing' },
    approval_pending: { icon: 'gpp_maybe', color: 'var(--warning)', label: 'Approval' },
    complete: { icon: 'task_alt', color: 'var(--success)', label: 'Complete' },
    error: { icon: 'error', color: 'var(--error)', label: 'Error' },
  }

  const c = config[phase]
  return (
    <span
      className={`material-icons-outlined text-[28px] ${phase === 'executing' ? 'animate-spin' : ''}`}
      style={{ color: c.color }}
    >
      {c.icon}
    </span>
  )
}

/** Format SNAKE_CASE stage names into readable form */
function formatStageName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
