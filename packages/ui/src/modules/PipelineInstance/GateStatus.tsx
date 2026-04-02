'use client'

// ============================================================================
// GateStatus — gate pass/fail visualization with blocker details
// ============================================================================

export interface ApiGateResult {
  pass: boolean
  reasons: string[]
}

export interface GateStatusProps {
  gateResult: ApiGateResult | null
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

  // Gate fails — show reasons
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="material-icons-outlined text-red-400" style={{ fontSize: '20px' }}>
          lock
        </span>
        <div>
          <p className="text-sm font-medium text-red-400">Blocked</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {gateResult.reasons.length} blocker{gateResult.reasons.length !== 1 ? 's' : ''} preventing
            advance from {stageName}
          </p>
        </div>
      </div>

      {gateResult.reasons.length > 0 && (
        <div className="mt-3 space-y-1.5 pl-8">
          {gateResult.reasons.map((reason, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-lg bg-[var(--bg-card)] px-3 py-2"
            >
              <span className="material-icons-outlined mt-0.5 text-red-400" style={{ fontSize: '14px' }}>
                error_outline
              </span>
              <p className="flex-1 text-xs text-[var(--text-primary)]">
                {reason}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
