/**
 * Universal user resolver -- accepts email, slack_id, full name, first name, or alias.
 * Ported from CORE_UserResolve.gs resolveUser().
 *
 * Works in two modes:
 * 1. Sync mode: Pass a users array directly
 * 2. Async mode: Pass a lookup function that fetches from Firestore
 */

import { fuzzyMatch } from '../matching/fuzzy'

// ============================================================================
// TYPES
// ============================================================================

export interface UserRecord {
  email: string
  first_name: string
  last_name: string
  role?: string
  division?: string
  slack_id?: string
  phone?: string
  job_title?: string
  aliases?: string[] | string
  personal_email?: string
  location?: string
  npn?: string
  hire_date?: string
  google_chat_id?: string
  employee_profile?: Record<string, unknown> | string
  status?: string
  [key: string]: unknown
}

type UserLookupFn = () => Promise<UserRecord[]>

// ============================================================================
// HELPERS
// ============================================================================

/** Parse JSON fields that may be stored as strings. */
function parseJsonField<T>(value: T | string | undefined | null): T | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  return value as T
}

/** Ensure aliases is a string array. */
function getAliases(user: UserRecord): string[] {
  const raw = parseJsonField<string[]>(user.aliases)
  if (Array.isArray(raw)) return raw
  return []
}

// ============================================================================
// RESOLVE USER
// ============================================================================

/**
 * Resolve a user by any identifier.
 *
 * Match priority (same as GAS):
 * 1. email (exact, case-insensitive)
 * 2. slack_id (exact)
 * 3. first_name + last_name (exact, case-insensitive)
 * 4. aliases[] (exact match against JSON array entries)
 * 5. first_name fuzzy (single-token input, case-insensitive)
 *
 * Sync mode: resolveUser('vinnie', users)
 * Async mode: resolveUser('vinnie', fetchUsers)
 */
export function resolveUser(input: string, users: UserRecord[]): UserRecord | null
export function resolveUser(input: string, lookup: UserLookupFn): Promise<UserRecord | null>
export function resolveUser(
  input: string,
  usersOrLookup: UserRecord[] | UserLookupFn
): UserRecord | null | Promise<UserRecord | null> {
  if (!input || typeof input !== 'string') return null

  if (Array.isArray(usersOrLookup)) {
    return resolveFromArray(input, usersOrLookup)
  }

  // Async mode
  return usersOrLookup().then(users => resolveFromArray(input, users))
}

function resolveFromArray(input: string, users: UserRecord[]): UserRecord | null {
  if (!users || users.length === 0) return null

  const trimmed = input.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()

  // 1. Email match (exact, case-insensitive)
  for (const user of users) {
    if ((user.email || '').toLowerCase() === lower) {
      return enrichUser(user)
    }
  }

  // 2. Slack ID match (exact)
  for (const user of users) {
    if (user.slack_id && user.slack_id === trimmed) {
      return enrichUser(user)
    }
  }

  // 3. First + Last name match (exact, case-insensitive)
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const inputFirst = parts[0].toLowerCase()
    const inputLast = parts.slice(1).join(' ').toLowerCase()

    for (const user of users) {
      const userFirst = (user.first_name || '').toLowerCase()
      const userLast = (user.last_name || '').toLowerCase()
      if (userFirst === inputFirst && userLast === inputLast) {
        return enrichUser(user)
      }
    }
  }

  // 4. Aliases match (exact match against JSON array entries)
  for (const user of users) {
    const aliases = getAliases(user)
    for (const alias of aliases) {
      if (alias.toLowerCase() === lower) {
        return enrichUser(user)
      }
    }
  }

  // 5. First name fuzzy (single-token input only)
  if (parts.length === 1) {
    let bestMatch: UserRecord | null = null
    let bestScore = 0

    for (const user of users) {
      if ((user.status || '').toLowerCase() === 'inactive') continue
      const firstName = (user.first_name || '').toLowerCase()
      if (firstName === lower) {
        return enrichUser(user) // Exact first name match
      }
      const score = fuzzyMatch(lower, firstName)
      if (score > bestScore && score >= 80) {
        bestScore = score
        bestMatch = user
      }
    }

    if (bestMatch) return enrichUser(bestMatch)
  }

  return null
}

/** Parse JSON fields on the user record before returning. */
function enrichUser(user: UserRecord): UserRecord {
  return {
    ...user,
    aliases: getAliases(user),
    employee_profile: parseJsonField<Record<string, unknown>>(user.employee_profile) || {},
  }
}
