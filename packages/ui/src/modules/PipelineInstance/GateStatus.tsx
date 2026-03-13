'use client'

import type { GateResult } from '@tomachina/core'

// ============================================================================
// GateStatus — gate pass/fail visualization with blocker details
// ============================================================================

export interface GateStatusProps {
  gateResult: GateResult | null
  stageName: string
}

export function GateStatus({ gateResult, stageName }: GateStatusProps) {
  // No gate configured — render nothing
  if (!gateResult) return null

  // Gate passes
  if (gateResult.pass) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '20px' }}>
          lock_open
        </span>
        <div>
          <p className="text-sm font-medium text-emerald-400">Ready to advance</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            All gate requirements met for {stageName}
          </p>
        </div>
      </div>
    )
  }

  // Gate fails — show blockers
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="material-icons-outlined text-red-400" style={{ fontSize: '20px' }}>
          lock
        </span>
        <div>
          <p className="text-sm font-medium text-red-400">Blocked</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {gateResult.blockers.length} blocker{gateResult.blockers.length !== 1 ? 's' : ''} preventing
            advance from {stageName}
          </p>
        </div>
      </div>

      {/* Blocker list */}
      {gateResult.blockers.length > 0 && (
        <div className="mt-3 space-y-1.5 pl-8">
          {gateResult.blockers.map((blocker, idx) => (
            <div
              key={`${blocker.task_id}-${idx}`}
              className="flex items-start gap-2 rounded-lg bg-[var(--bg-card)] px-3 py-2"
            >
              <span className="material-icons-outlined mt-0.5 text-red-400" style={{ fontSize: '14px' }}>
                error_outline
              </span>
              <div className="flex-1">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {blocker.task_name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {blocker.reason}
                </p>
                {blocker.check_result && (
                  <span className="mt-0.5 inline-block rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                    {blocker.check_result}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
