/**
 * RAIDEN Ticket Status Lifecycle
 *
 * Defines the valid statuses and allowed transitions for RAIDEN-submitted
 * tracker items (bugs, UX issues, enhancements reported via #dojo-fixes).
 *
 * Lifecycle:
 *   new → investigating → fix_shipped → ux_testing → verified_closed
 *
 * Note: transitions are one-way — no backwards movement without explicit re-open.
 */

export const RAIDEN_STATUSES = [
  'new',
  'investigating',
  'fix_shipped',
  'ux_testing',
  'verified_closed',
] as const

export type RaidenStatus = (typeof RAIDEN_STATUSES)[number]

/**
 * Valid forward transitions for each status.
 * A status not in this map has no valid forward transitions (terminal).
 */
const VALID_TRANSITIONS: Record<RaidenStatus, RaidenStatus[]> = {
  new: ['investigating'],
  investigating: ['fix_shipped'],
  fix_shipped: ['ux_testing'],
  ux_testing: ['verified_closed'],
  verified_closed: [],
}

/**
 * Returns true if transitioning from `from` → `to` is a valid lifecycle move.
 * Also returns true if `from` is `verified_closed` and `to` is `new`
 * (re-open path — a closed issue that has re-surfaced).
 */
export function isValidTransition(from: string, to: string): boolean {
  // Re-open: verified_closed → new (issue re-surfaced after closure)
  if (from === 'verified_closed' && to === 'new') return true

  const allowed = VALID_TRANSITIONS[from as RaidenStatus]
  if (!allowed) return false
  return allowed.includes(to as RaidenStatus)
}

/**
 * Returns the list of valid next statuses from the current status.
 * Includes 'new' as an option when re-opening a verified_closed ticket.
 */
export function getNextStatuses(current: string): RaidenStatus[] {
  if (current === 'verified_closed') return ['new']
  return VALID_TRANSITIONS[current as RaidenStatus] ?? []
}

/**
 * Returns true if the given string is a recognised RAIDEN status.
 */
export function isRaidenStatus(value: string): value is RaidenStatus {
  return (RAIDEN_STATUSES as readonly string[]).includes(value)
}
