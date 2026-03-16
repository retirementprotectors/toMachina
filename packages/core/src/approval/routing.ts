// ---------------------------------------------------------------------------
// Routing — determine reviewer + target Firestore collection
// ---------------------------------------------------------------------------

import type { TargetTab, RoutingResult } from './types'
import { TAB_TO_COLLECTION, TAB_TO_CANONICAL_CATEGORY } from './types'

/** Default Slack channel for approvals (#service-general) */
const DEFAULT_SLACK_CHANNEL = 'C0AH592RNQK'

// ---------------------------------------------------------------------------
// Domain → Division lookup table
// Tab name keywords map to their owning division. Add new domains here
// instead of hardcoding if/else chains — survives org changes cleanly.
// ---------------------------------------------------------------------------
const DOMAIN_DIVISION_MAP: Record<string, RoutingResult['division']> = {
  'producer': 'SALES',
  'revenue': 'SALES',
  'commission': 'SALES',
  'medicare': 'SERVICE',
  'medsup': 'SERVICE',
  'annuity': 'SALES',
  'life': 'SALES',
  'legacy': 'LEGACY',
  'beni': 'LEGACY',
  'advisory': 'SALES',
}

/** Lightweight user record for reviewer resolution */
interface ReviewerCandidate {
  email: string
  level: number
  division: string
  first_name: string
  last_name: string
}

/**
 * Determine reviewer and Slack channel for an approval batch.
 *
 * Logic ported from IMPORT_Approval.gs resolveRoutingChannel_()
 * In the GAS version, this reads _COMPANY_STRUCTURE.
 * In toMachina, it reads the Firestore `org` collection.
 *
 * @param tabs - Set of target tabs in the batch (determines routing)
 * @param orgData - Organization structure data (from Firestore `org` collection)
 * @param users - Optional user records for direct reviewer lookup (bypasses orgData leader search)
 * @returns Routing result with reviewer email and Slack channel
 */
export function determineReviewer(
  tabs: Set<string>,
  orgData: OrgRecord[],
  users?: ReviewerCandidate[]
): RoutingResult {
  // Determine division based on tab content
  const division = determineDivision(tabs)

  let reviewerEmail = ''

  if (users && users.length > 0) {
    // Preferred path: resolve reviewer from the users collection directly.
    // Match by division, level <= 2 (OWNER/EXECUTIVE/LEADER), sort ascending
    // so the most-senior match wins.
    const match = users
      .filter(
        (u) =>
          u.division?.toUpperCase() === division && u.level <= 2
      )
      .sort((a, b) => a.level - b.level)[0]

    reviewerEmail = match?.email || ''
  }

  if (!reviewerEmail) {
    // Fallback: resolve from org structure data (backwards compatible)
    const leader = orgData.find(
      (o) =>
        o.role?.toLowerCase().includes('leader') &&
        o.division?.toUpperCase() === division
    )
    reviewerEmail = leader?.email || ''
  }

  // Find routing channel from org data (unit × pipeline grid)
  const channel = findRoutingChannel(tabs, orgData)

  return {
    reviewer_email: reviewerEmail,
    slack_channel: channel || DEFAULT_SLACK_CHANNEL,
    division,
  }
}

/**
 * Determine which division handles this batch based on tab content.
 *
 * Uses DOMAIN_DIVISION_MAP for a clean, extensible lookup instead of
 * hardcoded if/else chains. Each tab name is checked against the map's
 * keywords — first match wins. Default: SERVICE.
 */
function determineDivision(tabs: Set<string>): RoutingResult['division'] {
  const tabsLower = [...tabs].map((t) => t.toLowerCase())

  for (const [keyword, division] of Object.entries(DOMAIN_DIVISION_MAP)) {
    if (tabsLower.some((tab) => tab.includes(keyword))) {
      return division
    }
  }

  return 'SERVICE'
}

/**
 * Find the appropriate Slack channel from org data.
 * Falls back to DEFAULT_SLACK_CHANNEL if not found.
 */
function findRoutingChannel(tabs: Set<string>, orgData: OrgRecord[]): string {
  // Determine unit (Medicare or Retirement)
  const isMedicare = tabs.has('_ACCOUNT_MEDICARE')
  const unitKey = isMedicare ? 'MEDICARE' : 'RETIREMENT'

  // Look for matching org entity with slack_channel_id
  const match = orgData.find((o) =>
    o.entity_type === 'UNIT' &&
    o.name?.toUpperCase().includes(unitKey) &&
    o.slack_channel_id &&
    o.slack_channel_id !== 'PENDING'
  )

  return match?.slack_channel_id || DEFAULT_SLACK_CHANNEL
}

/**
 * Determine the target Firestore collection path for a given tab + entity.
 *
 * Accounts are subcollections under clients: `clients/{clientId}/accounts`
 * Everything else is a top-level collection.
 */
export function determineTargetCollection(
  targetTab: TargetTab,
  clientId?: string
): string {
  const collection = TAB_TO_COLLECTION[targetTab]

  if (!collection) return 'unknown'

  // Account tabs are subcollections under clients
  if (collection === 'accounts' && clientId) {
    return `clients/${clientId}/accounts`
  }

  return collection
}

/**
 * Get the canonical account category for a target tab.
 */
export function getCanonicalCategory(targetTab: string): string | undefined {
  return TAB_TO_CANONICAL_CATEGORY[targetTab]
}

/**
 * Group approval items by target_tab + entity_id for execution.
 * Each group = one API call (one record with multiple fields).
 *
 * Client groups execute first (creates must happen before account references).
 */
export function groupItemsForExecution<T extends { target_tab: string; entity_id: string }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const key = `${item.target_tab}|${item.entity_id}`
    const group = groups.get(key) || []
    group.push(item)
    groups.set(key, group)
  }

  // Sort: CLIENT first, then PRODUCER/AGENT, then ACCOUNT, then REVENUE
  const sorted = new Map<string, T[]>()
  const tabOrder = ['_CLIENT_MASTER', '_PRODUCER_MASTER', '_AGENT_MASTER']

  // Client groups first
  for (const [key, group] of groups) {
    if (tabOrder.some((t) => key.startsWith(t))) {
      sorted.set(key, group)
    }
  }
  // Then everything else
  for (const [key, group] of groups) {
    if (!sorted.has(key)) {
      sorted.set(key, group)
    }
  }

  return sorted
}

// ---------------------------------------------------------------------------
// Types for org data
// ---------------------------------------------------------------------------

interface OrgRecord {
  entity_type?: string
  name?: string
  role?: string
  division?: string
  email?: string
  slack_channel_id?: string
  [key: string]: unknown
}
