/**
 * Dedup logic for entity matching across 7 entity types.
 * Ported from CORE_Match.gs matchClient(), matchAccount(), matchAgent(),
 * calculateNameScore(), calculateMatchScore(), findDuplicates(), batchMatch().
 *
 * All functions are PURE -- they accept data arrays instead of reading from Sheets.
 */

import { fuzzyMatch } from './fuzzy'

// ============================================================================
// CONFIGURABLE THRESHOLDS (TRK-CFG-003)
// ============================================================================

export interface DedupThresholds {
  /** Weight for last name in name scoring (0-100). Default: 60 */
  name_weight_last: number
  /** Weight for first name in name scoring (0-100). Default: 40 */
  name_weight_first: number
  /** Minimum fuzzy match score to consider a name match. Default: 75 */
  fuzzy_min: number
  /** Score threshold to flag as duplicate. Default: 85 */
  duplicate_threshold: number
  /** Score assigned for exact email match. Default: 100 */
  email_exact_score: number
}

/** Hardcoded defaults — used as fallback when Firestore config is unavailable. */
export const DEFAULT_DEDUP_THRESHOLDS: DedupThresholds = {
  name_weight_last: 60,
  name_weight_first: 40,
  fuzzy_min: 75,
  duplicate_threshold: 85,
  email_exact_score: 100,
}

// ============================================================================
// TYPES
// ============================================================================

export interface MatchResult<T> {
  match: T | null
  score: number
  method: string
}

export interface AccountMatchResult<T> extends MatchResult<T> {
  sourceTab: string
}

export interface DuplicatePair<T> {
  record1: T
  record2: T
  score: number
}

export interface BatchMatchResults<T> {
  matched: Array<{
    source: T
    match: T
    score: number
    method: string
  }>
  unmatched: T[]
  errors: Array<{ record: T; error: string }>
}

// ============================================================================
// NAME SCORING
// ============================================================================

interface NameFields {
  firstName?: string
  lastName?: string
  first_name?: string
  last_name?: string
}

/**
 * Calculate name similarity score.
 * Weighted: configurable (default 60% last name, 40% first name).
 * Ported from CORE_Match.gs calculateNameScore().
 */
export function calculateNameScore(a: NameFields, b: NameFields, thresholds?: DedupThresholds): number {
  const t = thresholds || DEFAULT_DEDUP_THRESHOLDS
  const firstName1 = (a.firstName || a.first_name || '').toLowerCase()
  const lastName1 = (a.lastName || a.last_name || '').toLowerCase()
  const firstName2 = (b.first_name || b.firstName || '').toLowerCase()
  const lastName2 = (b.last_name || b.lastName || '').toLowerCase()

  const lastNameScore = fuzzyMatch(lastName1, lastName2)
  const firstNameScore = fuzzyMatch(firstName1, firstName2)

  return Math.round(lastNameScore * (t.name_weight_last / 100) + firstNameScore * (t.name_weight_first / 100))
}

/**
 * Calculate overall match score between two records on specified fields.
 * Ported from CORE_Match.gs calculateMatchScore().
 */
export function calculateMatchScore(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: string[]
): number {
  if (!fields || fields.length === 0) return 0

  let totalScore = 0
  let fieldCount = 0

  for (const field of fields) {
    let valA = a[field]
    let valB = b[field]

    if (valA != null && valB != null) {
      // Date objects -- compare by time value
      if (valA instanceof Date) valA = valA.getTime()
      if (valB instanceof Date) valB = valB.getTime()

      if (valA === valB) {
        totalScore += 100
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        totalScore += fuzzyMatch(valA, valB)
      }
      fieldCount++
    }
  }

  return fieldCount > 0 ? Math.round(totalScore / fieldCount) : 0
}

// ============================================================================
// CLIENT MATCHING
// ============================================================================

interface ClientMatchCriteria {
  firstName?: string
  lastName?: string
  dob?: string
  phone?: string
  email?: string
  ssn_last4?: string
}

interface ClientRecord {
  first_name?: string
  last_name?: string
  dob?: string
  phone?: string
  email?: string
  ssn_last4?: string
  status?: string
  [key: string]: unknown
}

/**
 * Match a client record against an array of existing clients.
 * Ported from CORE_Match.gs matchClient().
 *
 * Match priority (same as GAS):
 * 1. SSN last4 + name > 70 => score 100
 * 2. Email exact => score 95
 * 3. Phone + last name + first name similarity > 60 => score 90
 * 4. Name + DOB => score 85
 * 5. Fuzzy name >= 75 => best score
 */
export function matchClient(
  criteria: ClientMatchCriteria,
  clients: ClientRecord[],
  normalizers?: {
    normalizeName?: (s: string) => string
    normalizeDate?: (s: string | Date | unknown) => string
    phoneDigits?: (s: string) => string
    normalizeEmail?: (s: string) => string
  },
  thresholds?: DedupThresholds,
): MatchResult<ClientRecord> {
  const t = thresholds || DEFAULT_DEDUP_THRESHOLDS
  const norm = normalizers || {}
  const normName = norm.normalizeName || ((s: string) => s?.toLowerCase().trim() || '')
  const normDate = norm.normalizeDate || ((s: string | Date | unknown) => String(s || '').trim())
  const normPhone = norm.phoneDigits || ((s: string) => (s || '').replace(/\D/g, ''))
  const normEmail = norm.normalizeEmail || ((s: string) => (s || '').toLowerCase().trim())

  const normalized = {
    firstName: normName(criteria.firstName || ''),
    lastName: normName(criteria.lastName || ''),
    dob: normDate(criteria.dob || ''),
    phone: normPhone(criteria.phone || ''),
    email: normEmail(criteria.email || ''),
    ssn_last4: criteria.ssn_last4 ? String(criteria.ssn_last4).slice(-4) : null,
  }

  let bestMatch: ClientRecord | null = null
  let bestScore = 0
  const matchMethod = 'fuzzy_name'

  for (const client of clients) {
    if (client.status === 'deleted') continue

    // Exact SSN match (if available)
    if (normalized.ssn_last4 && client.ssn_last4 === normalized.ssn_last4) {
      const nameScore = calculateNameScore(
        { firstName: normalized.firstName, lastName: normalized.lastName },
        client,
        t,
      )
      if (nameScore > 70) {
        return { match: client, score: 100, method: 'ssn_last4' }
      }
    }

    // Email exact match
    if (normalized.email && client.email === normalized.email) {
      return { match: client, score: t.email_exact_score, method: 'email' }
    }

    // Phone + Last Name + First Name match
    if (normalized.phone && normPhone(client.phone || '') === normalized.phone) {
      if (fuzzyMatch(normalized.lastName, client.last_name) > 80) {
        const firstNameSim = fuzzyMatch(
          normalized.firstName,
          normName(client.first_name || '')
        )
        if (firstNameSim > 60) {
          return { match: client, score: 90, method: 'phone_lastname' }
        }
        // Same phone + same last name but DIFFERENT first name = likely spouse
      }
    }

    // Name + DOB match
    if (normalized.dob && normalized.dob === normDate(client.dob || '')) {
      const nameScore = calculateNameScore(
        { firstName: normalized.firstName, lastName: normalized.lastName },
        client,
        t,
      )
      if (nameScore > 80) {
        return { match: client, score: 85, method: 'name_dob' }
      }
    }

    // Fuzzy name match
    const nameScore = calculateNameScore(
      { firstName: normalized.firstName, lastName: normalized.lastName },
      client,
      t,
    )
    if (nameScore > bestScore) {
      bestScore = nameScore
      bestMatch = client
    }
  }

  // Return best fuzzy match if above configurable threshold
  if (bestScore >= t.fuzzy_min) {
    return { match: bestMatch, score: bestScore, method: matchMethod }
  }

  return { match: null, score: bestScore, method: 'none' }
}

// ============================================================================
// ACCOUNT MATCHING
// ============================================================================

interface AccountMatchCriteria {
  policyNumber?: string
  carrier?: string
  clientId?: string
  effectiveDate?: string
  targetTab?: string
}

interface AccountRecord {
  policy_number?: string
  account_number?: string
  contract_number?: string
  carrier_name?: string
  custodian?: string
  client_id?: string
  effective_date?: string
  issue_date?: string
  opened_date?: string
  status?: string
  [key: string]: unknown
}

/**
 * Match an account against arrays of existing accounts by tab.
 * Ported from CORE_Match.gs matchAccount().
 *
 * Searches up to 4 account tabs: _ACCOUNT_INVESTMENTS, _ACCOUNT_LIFE, _ACCOUNT_ANNUITY, _ACCOUNT_MEDICARE.
 */
export function matchAccount(
  criteria: AccountMatchCriteria,
  accountsByTab: Record<string, AccountRecord[]>,
  normalizers?: {
    normalizeCarrierName?: (s: string) => string
    normalizeDate?: (s: string | Date | unknown) => string
  }
): AccountMatchResult<AccountRecord> {
  const ACCOUNT_TABS = ['_ACCOUNT_INVESTMENTS', '_ACCOUNT_LIFE', '_ACCOUNT_ANNUITY', '_ACCOUNT_MEDICARE']
  const norm = normalizers || {}
  const normCarrier = norm.normalizeCarrierName || ((s: string) => (s || '').trim())
  const normDate = norm.normalizeDate || ((s: string | Date | unknown) => String(s || '').trim())

  const tabsToSearch = criteria.targetTab ? [criteria.targetTab] : ACCOUNT_TABS

  const normalized = {
    policyNumber: criteria.policyNumber ? String(criteria.policyNumber).trim().toUpperCase() : null,
    carrier: normCarrier(criteria.carrier || ''),
    clientId: criteria.clientId || null,
    effectiveDate: normDate(criteria.effectiveDate || ''),
  }

  for (const tabName of tabsToSearch) {
    const accounts = accountsByTab[tabName]
    if (!accounts || accounts.length === 0) continue

    for (const account of accounts) {
      if (account.status === 'deleted') continue

      // Collect all possible policy/account number fields
      const recordNumbers: string[] = []
      if (account.policy_number) recordNumbers.push(String(account.policy_number).trim().toUpperCase())
      if (account.account_number) recordNumbers.push(String(account.account_number).trim().toUpperCase())
      if (account.contract_number) recordNumbers.push(String(account.contract_number).trim().toUpperCase())

      // Exact policy/account number match (strongest)
      if (normalized.policyNumber && recordNumbers.includes(normalized.policyNumber)) {
        return { match: account, score: 100, method: 'policy_number', sourceTab: tabName }
      }

      const accountCarrierName = normCarrier(account.carrier_name || account.custodian || '')
      const accountDate = normDate(account.effective_date || account.issue_date || account.opened_date || '')

      // Client + Carrier + Date match
      if (
        normalized.clientId && normalized.clientId === account.client_id &&
        normalized.carrier && normalized.carrier === accountCarrierName &&
        normalized.effectiveDate && normalized.effectiveDate === accountDate
      ) {
        return { match: account, score: 90, method: 'client_carrier_date', sourceTab: tabName }
      }

      // Client + Carrier match (without date)
      if (
        normalized.clientId && normalized.clientId === account.client_id &&
        normalized.carrier && normalized.carrier === accountCarrierName
      ) {
        return { match: account, score: 80, method: 'client_carrier', sourceTab: tabName }
      }
    }
  }

  return { match: null, score: 0, method: 'none', sourceTab: '' }
}

// ============================================================================
// AGENT MATCHING
// ============================================================================

interface AgentMatchCriteria {
  npn?: string
  email?: string
  firstName?: string
  lastName?: string
}

interface AgentRecord {
  npn?: string
  email?: string
  first_name?: string
  last_name?: string
  status?: string
  [key: string]: unknown
}

/**
 * Match an agent against an array of existing agents.
 * Ported from CORE_Match.gs matchAgent().
 */
export function matchAgent(
  criteria: AgentMatchCriteria,
  agents: AgentRecord[],
  normalizers?: {
    normalizeName?: (s: string) => string
    normalizeEmail?: (s: string) => string
  }
): MatchResult<AgentRecord> {
  const norm = normalizers || {}
  const normName = norm.normalizeName || ((s: string) => s?.toLowerCase().trim() || '')
  const normEmail = norm.normalizeEmail || ((s: string) => (s || '').toLowerCase().trim())

  const normalized = {
    npn: criteria.npn ? String(criteria.npn).trim() : null,
    email: normEmail(criteria.email || ''),
    firstName: normName(criteria.firstName || ''),
    lastName: normName(criteria.lastName || ''),
  }

  for (const agent of agents) {
    if (agent.status === 'deleted') continue

    // NPN exact match (strongest - unique identifier)
    if (normalized.npn && agent.npn === normalized.npn) {
      return { match: agent, score: 100, method: 'npn' }
    }

    // Email exact match
    if (normalized.email && agent.email === normalized.email) {
      return { match: agent, score: 95, method: 'email' }
    }

    // Name match
    const nameScore = calculateNameScore(
      { firstName: normalized.firstName, lastName: normalized.lastName },
      agent
    )
    if (nameScore > 85) {
      return { match: agent, score: nameScore, method: 'name' }
    }
  }

  return { match: null, score: 0, method: 'none' }
}

// ============================================================================
// BULK MATCHING
// ============================================================================

/**
 * Find potential duplicates in a dataset.
 * Ported from CORE_Match.gs findDuplicates().
 */
export function findDuplicates<T extends Record<string, unknown>>(
  records: T[],
  matchFields: string[],
  threshold = DEFAULT_DEDUP_THRESHOLDS.duplicate_threshold,
): DuplicatePair<T>[] {
  const duplicates: DuplicatePair<T>[] = []

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const score = calculateMatchScore(records[i], records[j], matchFields)
      if (score >= threshold) {
        duplicates.push({
          record1: records[i],
          record2: records[j],
          score,
        })
      }
    }
  }

  return duplicates
}

/**
 * Match a batch of records against a dataset.
 * Ported from CORE_Match.gs batchMatch().
 */
export function batchMatch<T extends Record<string, unknown>>(
  records: T[],
  matchFn: (record: T) => MatchResult<T>
): BatchMatchResults<T> {
  const results: BatchMatchResults<T> = {
    matched: [],
    unmatched: [],
    errors: [],
  }

  for (const record of records) {
    try {
      const result = matchFn(record)
      if (result.match) {
        results.matched.push({
          source: record,
          match: result.match,
          score: result.score,
          method: result.method,
        })
      } else {
        results.unmatched.push(record)
      }
    } catch (e) {
      results.errors.push({ record, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return results
}
