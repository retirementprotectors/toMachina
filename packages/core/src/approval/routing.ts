// ---------------------------------------------------------------------------
// Routing — determine reviewer + target Firestore collection
// ---------------------------------------------------------------------------

import type { TargetTab, RoutingResult } from './types'
import { TAB_TO_COLLECTION, TAB_TO_CANONICAL_CATEGORY } from './types'

/** Default Slack channel for approvals (#service-general) */
const DEFAULT_SLACK_CHANNEL = 'C0AH592RNQK'

/**
 * Determine reviewer and Slack channel for an approval batch.
 *
 * Logic ported from IMPORT_Approval.gs resolveRoutingChannel_()
 * In the GAS version, this reads _COMPANY_STRUCTURE.
 * In toMachina, it reads the Firestore `org` collection.
 *
 * @param tabs - Set of target tabs in the batch (determines routing)
 * @param orgData - Organization structure data (from Firestore `org` collection)
 * @returns Routing result with reviewer email and Slack channel
 */
export function determineReviewer(
  tabs: Set<string>,
  orgData: OrgRecord[]
): RoutingResult {
  // Determine division based on tab content
  const division = determineDivision(tabs)

  // Find the division leader from org data
  const leader = orgData.find((o) =>
    o.role?.toLowerCase().includes('leader') &&
    o.division?.toUpperCase() === division
  )

  // Find routing channel from org data (unit × pipeline grid)
  const channel = findRoutingChannel(tabs, orgData)

  return {
    reviewer_email: leader?.email || '',
    slack_channel: channel || DEFAULT_SLACK_CHANNEL,
    division,
  }
}

/**
 * Determine which division handles this batch based on tab content.
 *
 * - Producer/Revenue → SALES
 * - Medicare → SERVICE
 * - Life/Annuity with estate keywords → LEGACY
 * - Default → SERVICE
 */
function determineDivision(tabs: Set<string>): RoutingResult['division'] {
  if (tabs.has('_PRODUCER_MASTER') || tabs.has('_AGENT_MASTER') || tabs.has('_REVENUE_MASTER')) {
    return 'SALES'
  }
  if (tabs.has('_ACCOUNT_MEDICARE')) {
    return 'SERVICE'
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
