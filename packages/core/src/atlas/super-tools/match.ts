// ---------------------------------------------------------------------------
// Super Tool: MATCH
// Orchestrates dedup/matching: matchClient, matchAccount, findDuplicates
// Runs AFTER normalize so matching operates on clean, consistent data.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
} from '../types'
import { matchClient, matchAccount, findDuplicates } from '../../matching'
import type { MatchResult, DuplicatePair } from '../../matching'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_MATCH',
  name: 'Match & Dedup',
  description:
    'Match incoming records against existing data. Three tiers: exact (name+DOB), contact (name+phone/email), name-only. Auto-tags: existing match, duplicate, spouse prospect, new insert.',
  tools: ['match-client', 'match-account', 'find-duplicates'],
}

export type MatchTag = 'EXISTING_MATCH' | 'DUPLICATE' | 'SPOUSE_PROSPECT' | 'NEW_INSERT' | 'REVIEW_NEEDED'

export interface MatchInput {
  records: Record<string, unknown>[]
  /** Existing client records to match against (for client mode) */
  existing_clients?: Record<string, unknown>[]
  /** Existing accounts grouped by tab name (for account mode) */
  existing_accounts_by_tab?: Record<string, Record<string, unknown>[]>
  /** Match mode: 'client' (default), 'account', or 'both' */
  mode?: 'client' | 'account' | 'both'
  /** Fields to check for internal duplicates. Defaults to ['first_name', 'last_name', 'dob'] */
  dedup_fields?: string[]
}

export interface MatchedRecord {
  record: Record<string, unknown>
  tag: MatchTag
  match_result?: MatchResult<Record<string, unknown>>
  existing_id?: string
  confidence: number
}

export interface MatchOutput {
  matched: MatchedRecord[]
  internal_duplicates: DuplicatePair<Record<string, unknown>>[]
  summary: {
    existing_matches: number
    duplicates: number
    spouse_prospects: number
    new_inserts: number
    review_needed: number
  }
}

/**
 * Execute the Match super tool.
 * Pure function — all matching logic is in packages/core/matching.
 */
export async function execute(
  input: MatchInput,
  _context: SuperToolContext
): Promise<SuperToolResult<MatchOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const {
      records,
      existing_clients = [],
      existing_accounts_by_tab = {},
      mode = 'client',
      dedup_fields = ['first_name', 'last_name', 'dob'],
    } = input

    if (!records || !Array.isArray(records)) {
      return { success: false, error: 'Input records must be an array' }
    }

    // Step 1: Match each incoming record against existing records
    const matched: MatchedRecord[] = []

    for (const record of records) {
      let clientResult: MatchResult<Record<string, unknown>> | undefined
      let tag: MatchTag = 'NEW_INSERT'
      let existingId: string | undefined
      let confidence = 0

      if (mode === 'client' || mode === 'both') {
        // Build ClientMatchCriteria from the record
        clientResult = matchClient(
          {
            firstName: String(record.first_name || ''),
            lastName: String(record.last_name || ''),
            dob: String(record.dob || ''),
            phone: String(record.phone || record.cell_phone || ''),
            email: String(record.email || ''),
            ssn_last4: record.ssn_last4 ? String(record.ssn_last4) : undefined,
          },
          existing_clients
        )

        if (clientResult.score >= 90) {
          tag = 'EXISTING_MATCH'
          existingId = extractId(clientResult.match)
          confidence = clientResult.score
        } else if (clientResult.score >= 70) {
          // Check if this might be a spouse
          if (clientResult.match && isSpouseCandidate(record, clientResult.match)) {
            tag = 'SPOUSE_PROSPECT'
            existingId = extractId(clientResult.match)
            confidence = clientResult.score
          } else {
            tag = 'REVIEW_NEEDED'
            confidence = clientResult.score
          }
        } else if (clientResult.score >= 50) {
          tag = 'REVIEW_NEEDED'
          confidence = clientResult.score
        }
      }

      if ((mode === 'account' || mode === 'both') && tag === 'NEW_INSERT') {
        // Build AccountMatchCriteria from the record
        const accountResult = matchAccount(
          {
            policyNumber: String(record.policy_number || record.account_number || ''),
            carrier: String(record.carrier || record.custodian || ''),
            clientId: String(record.client_id || ''),
            effectiveDate: String(record.effective_date || record.issue_date || ''),
          },
          existing_accounts_by_tab
        )

        if (accountResult.score >= 90) {
          tag = 'EXISTING_MATCH'
          existingId = extractId(accountResult.match)
          confidence = accountResult.score
        }
      }

      matched.push({
        record,
        tag,
        match_result: clientResult,
        existing_id: existingId,
        confidence,
      })
    }

    toolResults['match-records'] = {
      success: true,
      processed: records.length,
      passed: matched.filter((m) => m.tag !== 'REVIEW_NEEDED').length,
      failed: matched.filter((m) => m.tag === 'REVIEW_NEEDED').length,
    }

    // Step 2: Find duplicates within the incoming batch itself
    const internalDuplicates = findDuplicates(records, dedup_fields)
    toolResults['find-duplicates'] = {
      success: true,
      data: { duplicate_pairs: internalDuplicates.length },
    }

    // Mark internal duplicates (second record in pair gets tagged)
    for (const dupPair of internalDuplicates) {
      const dupIndex = records.indexOf(dupPair.record2)
      if (dupIndex >= 0 && matched[dupIndex]) {
        matched[dupIndex].tag = 'DUPLICATE'
        matched[dupIndex].confidence = dupPair.score
      }
    }

    // Compute summary
    const summary = {
      existing_matches: matched.filter((m) => m.tag === 'EXISTING_MATCH').length,
      duplicates: matched.filter((m) => m.tag === 'DUPLICATE').length,
      spouse_prospects: matched.filter((m) => m.tag === 'SPOUSE_PROSPECT').length,
      new_inserts: matched.filter((m) => m.tag === 'NEW_INSERT').length,
      review_needed: matched.filter((m) => m.tag === 'REVIEW_NEEDED').length,
    }

    return {
      success: true,
      data: {
        matched,
        internal_duplicates: internalDuplicates,
        summary,
      },
      tool_results: toolResults,
      stats: {
        records_in: records.length,
        records_out: records.length,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Match failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Extract document ID from a matched record.
 * Checks common ID fields in priority order.
 */
function extractId(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined
  return (
    String(record.client_id || record.account_id || record.producer_id || record.id || '') || undefined
  )
}

/**
 * Check if a matched record indicates a potential spouse relationship.
 * Same last name + different first name + shared phone/email/address.
 */
function isSpouseCandidate(
  record: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  const recFirst = String(record.first_name || '').toLowerCase().trim()
  const recLast = String(record.last_name || '').toLowerCase().trim()
  const existFirst = String(existing.first_name || '').toLowerCase().trim()
  const existLast = String(existing.last_name || '').toLowerCase().trim()

  // Must share last name but have different first names
  if (recLast !== existLast || recFirst === existFirst) return false

  // Must share at least one contact method
  const sharedPhone =
    record.phone && existing.phone && String(record.phone) === String(existing.phone)
  const sharedEmail =
    record.email && existing.email && String(record.email) === String(existing.email)
  const sharedAddress =
    record.address && existing.address && String(record.address) === String(existing.address)

  return !!(sharedPhone || sharedEmail || sharedAddress)
}
