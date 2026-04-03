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
 * Assessment: RON-new → RON-researching → RON-strategizing
 * Development: RON-discovery → RON-seeded → RON-planned → RON-built → RON-deployed → RON-reported
 */
export const RONIN_STATUSES = [
  'RON-new',
  'RON-researching',
  'RON-strategizing',
  'RON-discovery',
  'RON-seeded',
  'RON-planned',
  'RON-built',
  'RON-deployed',
  'RON-reported',
] as const

export type RoninStatus = (typeof RONIN_STATUSES)[number]

export function isRoninStatus(value: string): value is RoninStatus {
  return (RONIN_STATUSES as readonly string[]).includes(value)
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
