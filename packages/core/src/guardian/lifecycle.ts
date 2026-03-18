// ============================================================================
// GUARDIAN — Audit Phase Lifecycle Engine
// Enforces Scan → Detect → Respond → Verify → Protect gate progression.
// Agents execute WITHIN a phase. JDM fires transitions. No skipping.
// ============================================================================

import {
  GUARDIAN_PHASES,
  GUARDIAN_PHASE_ORDER,
  type GuardianPhase,
  type GuardianAudit,
  type GuardianFinding,
  type PhaseTransitionResult,
} from '../types/guardian'

/**
 * Get the next phase in the lifecycle. Returns null if already at final phase.
 */
export function getNextPhase(current: GuardianPhase): GuardianPhase | null {
  const currentIdx = GUARDIAN_PHASE_ORDER[current]
  const nextIdx = currentIdx + 1
  if (nextIdx >= GUARDIAN_PHASES.length) return null
  return GUARDIAN_PHASES[nextIdx]
}

/**
 * Validate whether an audit can transition to the next phase.
 * Returns { success: true } or { success: false, blocked_reason: string }.
 *
 * Transition rules:
 *   scan → detect:    snapshot_id must be set (scan must complete)
 *   detect → respond: at least 1 finding must exist
 *   respond → verify: all critical/high findings must be in_progress or resolved
 *   verify → protect: no open critical findings remain (re-scan clean)
 */
export function validatePhaseTransition(
  audit: GuardianAudit,
  findings: GuardianFinding[]
): PhaseTransitionResult {
  const next = getNextPhase(audit.phase)

  if (!next) {
    return {
      success: false,
      from: audit.phase,
      to: audit.phase,
      blocked_reason: 'Audit is already in final phase (protect). No further transitions.',
    }
  }

  // Gate: scan → detect
  if (audit.phase === 'scan' && next === 'detect') {
    if (!audit.snapshot_id) {
      return {
        success: false,
        from: 'scan',
        to: 'detect',
        blocked_reason: 'Cannot advance to detect: snapshot has not been completed. Run the snapshot tool first.',
      }
    }
  }

  // Gate: detect → respond
  if (audit.phase === 'detect' && next === 'respond') {
    if (findings.length === 0) {
      return {
        success: false,
        from: 'detect',
        to: 'respond',
        blocked_reason: 'Cannot advance to respond: no findings have been created. Detection must produce at least 1 finding.',
      }
    }
  }

  // Gate: respond → verify
  if (audit.phase === 'respond' && next === 'verify') {
    const openCriticalHigh = findings.filter(
      (f) =>
        (f.severity === 'critical' || f.severity === 'high') &&
        f.status === 'open'
    )
    if (openCriticalHigh.length > 0) {
      return {
        success: false,
        from: 'respond',
        to: 'verify',
        blocked_reason: `Cannot advance to verify: ${openCriticalHigh.length} critical/high findings are still open. All critical and high severity findings must be in_progress or resolved before verification.`,
      }
    }
  }

  // Gate: verify → protect
  if (audit.phase === 'verify' && next === 'protect') {
    const openCritical = findings.filter(
      (f) => f.severity === 'critical' && (f.status === 'open' || f.status === 'in_progress')
    )
    if (openCritical.length > 0) {
      return {
        success: false,
        from: 'verify',
        to: 'protect',
        blocked_reason: `Cannot advance to protect: ${openCritical.length} critical findings are not fully resolved. All critical findings must be resolved or accepted before protection baseline is locked.`,
      }
    }
  }

  return {
    success: true,
    from: audit.phase,
    to: next,
  }
}

/**
 * Check if a phase is valid.
 */
export function isValidPhase(phase: string): phase is GuardianPhase {
  return GUARDIAN_PHASES.includes(phase as GuardianPhase)
}

/**
 * Get human-readable phase label.
 */
export function getPhaseLabel(phase: GuardianPhase): string {
  const labels: Record<GuardianPhase, string> = {
    scan: 'Scan — Know What You Have',
    detect: 'Detect — Find What\'s Wrong',
    respond: 'Respond — Fix What\'s Broken',
    verify: 'Verify — Prove It\'s Clean',
    protect: 'Protect — Lock It Down',
  }
  return labels[phase]
}

/**
 * Get phase progress as a percentage (0-100).
 */
export function getPhaseProgress(phase: GuardianPhase): number {
  return ((GUARDIAN_PHASE_ORDER[phase] + 1) / GUARDIAN_PHASES.length) * 100
}
