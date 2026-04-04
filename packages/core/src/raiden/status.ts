/**
 * RAIDEN Ticket Status Lifecycle — RDN-prefixed
 *
 * All RAIDEN statuses use the RDN- prefix so warrior tabs can filter
 * by prefix alone: status.startsWith('RDN-')
 *
 * Lifecycle:
 *   RDN-new → RDN-triaging → RDN-fixing → RDN-verifying → RDN-deploy → RDN-reported
 */

export const RAIDEN_STATUSES = [
  'RDN-new',
  'RDN-triaging',
  'RDN-fixing',
  'RDN-verifying',
  'RDN-deploy',
  'RDN-reported',
] as const

export type RaidenStatus = (typeof RAIDEN_STATUSES)[number]

/**
 * Valid forward transitions for each status.
 * A status not in this map has no valid forward transitions (terminal).
 */
const VALID_TRANSITIONS: Record<RaidenStatus, RaidenStatus[]> = {
  'RDN-new': ['RDN-triaging'],
  'RDN-triaging': ['RDN-fixing'],
  'RDN-fixing': ['RDN-verifying'],
  'RDN-verifying': ['RDN-deploy'],
  'RDN-deploy': ['RDN-reported'],
  'RDN-reported': [],
}

/**
 * Returns true if transitioning from `from` → `to` is a valid lifecycle move.
 * Also returns true if `from` is `RDN-reported` and `to` is `RDN-new`
 * (re-open path — a closed issue that has re-surfaced).
 */
export function isValidTransition(from: string, to: string): boolean {
  // Re-open: RDN-reported → RDN-new (issue re-surfaced after closure)
  if (from === 'RDN-reported' && to === 'RDN-new') return true

  const allowed = VALID_TRANSITIONS[from as RaidenStatus]
  if (!allowed) return false
  return allowed.includes(to as RaidenStatus)
}

/**
 * Returns the list of valid next statuses from the current status.
 * Includes 'RDN-new' as an option when re-opening a reported ticket.
 */
export function getNextStatuses(current: string): RaidenStatus[] {
  if (current === 'RDN-reported') return ['RDN-new']
  return VALID_TRANSITIONS[current as RaidenStatus] ?? []
}

/**
 * Returns true if the given string is a recognised RAIDEN status.
 */
export function isRaidenStatus(value: string): value is RaidenStatus {
  return (RAIDEN_STATUSES as readonly string[]).includes(value)
}

/**
 * RONIN Pipeline Statuses — RON-prefixed
 *
 * Assessment:  RON-new → RON-researching → RON-strategizing
 * Foundation:  RON-discovery → RON-seeded → RON-planned → RON-plan-audited
 * Development: RON-built → RON-code-audited → RON-deployed → RON-ux-reviewed → RON-reported
 */
export const RONIN_STATUSES = [
  'RON-new',
  'RON-researching',
  'RON-strategizing',
  'RON-discovery',
  'RON-seeded',
  'RON-planned',
  'RON-plan-audited',
  'RON-built',
  'RON-code-audited',
  'RON-deployed',
  'RON-ux-reviewed',
  'RON-reported',
] as const

export type RoninStatus = (typeof RONIN_STATUSES)[number]

export const RONIN_PHASES = {
  assessment: ['RON-new', 'RON-researching', 'RON-strategizing'] as const,
  foundation: ['RON-discovery', 'RON-seeded', 'RON-planned', 'RON-plan-audited'] as const,
  development: ['RON-built', 'RON-code-audited', 'RON-deployed', 'RON-ux-reviewed', 'RON-reported'] as const,
} as const

export type RoninPhase = keyof typeof RONIN_PHASES

const RONIN_TRANSITIONS: Record<RoninStatus, RoninStatus[]> = {
  'RON-new': ['RON-researching'],
  'RON-researching': ['RON-strategizing'],
  'RON-strategizing': ['RON-discovery'],
  'RON-discovery': ['RON-seeded'],
  'RON-seeded': ['RON-planned'],
  'RON-planned': ['RON-plan-audited'],
  'RON-plan-audited': ['RON-built'],
  'RON-built': ['RON-code-audited'],
  'RON-code-audited': ['RON-deployed'],
  'RON-deployed': ['RON-ux-reviewed'],
  'RON-ux-reviewed': ['RON-reported'],
  'RON-reported': [],
}

export function isRoninStatus(value: string): value is RoninStatus {
  return (RONIN_STATUSES as readonly string[]).includes(value)
}

export function isValidRoninTransition(from: string, to: string): boolean {
  if (from === 'RON-reported' && to === 'RON-new') return true
  const allowed = RONIN_TRANSITIONS[from as RoninStatus]
  if (!allowed) return false
  return allowed.includes(to as RoninStatus)
}

export function getNextRoninStatuses(current: string): RoninStatus[] {
  if (current === 'RON-reported') return ['RON-new']
  return RONIN_TRANSITIONS[current as RoninStatus] ?? []
}

export function getRoninPhase(status: string): RoninPhase | null {
  for (const [phase, statuses] of Object.entries(RONIN_PHASES)) {
    if ((statuses as readonly string[]).includes(status)) return phase as RoninPhase
  }
  return null
}

/**
 * INTAKE Pipeline Statuses — INT-prefixed
 *
 * Items arrive from #the-dojo Slack, get auto-classified by triage engine,
 * then land in /q for CEO approval → routed to warrior pipeline.
 *
 * Lifecycle:
 *   INT-new → INT-classified → (approved) RDN-new / RON-new / VLT-new
 *                             → (declined) INT-declined
 */
export const INT_PIPELINE_STATUSES = [
  'INT-new',
  'INT-classified',
  'INT-declined',
] as const

export type IntPipelineStatus = (typeof INT_PIPELINE_STATUSES)[number]

const INT_TRANSITIONS: Record<IntPipelineStatus, string[]> = {
  'INT-new': ['INT-classified'],
  'INT-classified': ['RDN-new', 'RON-new', 'VLT-new', 'INT-declined'],
  'INT-declined': [],
}

export function isIntPipelineStatus(value: string): value is IntPipelineStatus {
  return (INT_PIPELINE_STATUSES as readonly string[]).includes(value)
}

export function isValidIntTransition(from: string, to: string): boolean {
  const allowed = INT_TRANSITIONS[from as IntPipelineStatus]
  if (!allowed) return false
  return allowed.includes(to)
}

export function getNextIntStatuses(current: string): string[] {
  return INT_TRANSITIONS[current as IntPipelineStatus] ?? []
}

/**
 * VOLTRON Statuses — VLT-prefixed (placeholder for future use)
 */
export const VOLTRON_STATUSES = [
  'VLT-active',
  'VLT-idle',
  'VLT-error',
] as const

export type VoltronStatus = (typeof VOLTRON_STATUSES)[number]
