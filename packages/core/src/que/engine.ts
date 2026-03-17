/**
 * QUE Engine — Pure Functions
 *
 * Session lifecycle, state machine, quote scoring, and comparison matrix.
 * No Firestore, no API calls — pure TypeScript only.
 */

import type {
  QueSession,
  QueSessionStatus,
  QueProductLine,
  QueQuote,
  QueComparisonAlgorithm,
} from './types'

// ============================================================================
// VALID STATE TRANSITIONS
// ============================================================================

const VALID_TRANSITIONS: Record<QueSessionStatus, QueSessionStatus[]> = {
  draft: ['quoting', 'archived'],
  quoting: ['comparing', 'archived'],
  comparing: ['recommending', 'archived'],
  recommending: ['complete', 'archived'],
  complete: ['archived'],
  archived: [],
}

// ============================================================================
// SESSION CREATION
// ============================================================================

/**
 * Create a new QUE session data object.
 * Generates a UUID, sets status to 'draft', and initializes empty arrays.
 */
export function createSessionData(
  householdId: string,
  householdName: string,
  productLine: QueProductLine,
  assignedTo: string,
  createdBy: string,
): QueSession {
  const now = new Date().toISOString()
  return {
    session_id: crypto.randomUUID(),
    household_id: householdId,
    household_name: householdName,
    product_line: productLine,
    status: 'draft',
    client_snapshot: {
      members: [],
      accounts: [],
    },
    quote_parameters: {},
    quote_ids: [],
    selected_quote_ids: [],
    output_ids: [],
    assigned_to: assignedTo,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  }
}

// ============================================================================
// STATE MACHINE
// ============================================================================

/**
 * Validate whether a session status transition is allowed.
 * Any status can transition to 'archived'. Otherwise follows the linear flow:
 * draft → quoting → comparing → recommending → complete
 */
export function validateStateTransition(
  current: QueSessionStatus,
  target: QueSessionStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[current]
  return allowed.includes(target)
}

// ============================================================================
// QUOTE MANAGEMENT
// ============================================================================

/**
 * Add a quote ID to a session. Returns a new session object (immutable).
 * Auto-transitions from 'draft' to 'quoting' when the first quote is added.
 */
export function addQuoteToSession(
  session: QueSession,
  quoteId: string,
): QueSession {
  const newStatus: QueSessionStatus =
    session.status === 'draft' ? 'quoting' : session.status

  return {
    ...session,
    status: newStatus,
    quote_ids: [...session.quote_ids, quoteId],
    updated_at: new Date().toISOString(),
  }
}

// ============================================================================
// QUOTE SCORING
// ============================================================================

/**
 * Score and rank quotes using the specified comparison algorithm.
 * Returns a new array with score (0-100) and rank (1-based) filled in.
 *
 * Algorithms:
 * - lowest_premium: Rank by premium_annual ascending. Lowest = rank 1.
 * - best_value: For life = face_amount / premium_annual, for annuity = accumulation / premium.
 * - carrier_rated: Weighted composite (premium 40%, benefit 30%, rating 20%, fees 10%).
 * - custom: Returns quotes unscored (score=0, rank by original order).
 */
export function scoreQuotes(
  quotes: QueQuote[],
  algorithm: QueComparisonAlgorithm,
): QueQuote[] {
  if (quotes.length === 0) return []

  switch (algorithm) {
    case 'lowest_premium':
      return scoreByLowestPremium(quotes)
    case 'best_value':
      return scoreByBestValue(quotes)
    case 'carrier_rated':
      return scoreByCarrierRated(quotes)
    case 'custom':
      return quotes.map((q, i) => ({ ...q, score: 0, rank: i + 1 }))
  }
}

function scoreByLowestPremium(quotes: QueQuote[]): QueQuote[] {
  const count = quotes.length

  // Sort by annual premium ascending; missing premiums go to the end
  const sorted = [...quotes].sort((a, b) => {
    const pa = a.premium_annual ?? Infinity
    const pb = b.premium_annual ?? Infinity
    return pa - pb
  })

  return sorted.map((q, i) => ({
    ...q,
    rank: i + 1,
    score: Math.round(100 - i * (100 / count)),
  }))
}

function scoreByBestValue(quotes: QueQuote[]): QueQuote[] {
  // Compute value ratio for each quote
  const withRatio = quotes.map((q) => {
    const premium = q.premium_annual ?? q.premium_single ?? 0
    if (premium === 0) return { quote: q, ratio: 0 }

    // Life: face_amount / premium. Annuity: accumulation / premium.
    const faceAmount = extractNumericDetail(q.details, 'face_amount')
    const accumulation = extractNumericDetail(q.details, 'accumulation_value')

    const benefit = faceAmount > 0 ? faceAmount : accumulation
    return { quote: q, ratio: benefit / premium }
  })

  // Sort by ratio descending (higher = better value)
  withRatio.sort((a, b) => b.ratio - a.ratio)

  const maxRatio = withRatio[0]?.ratio ?? 1

  return withRatio.map(({ quote, ratio }, i) => ({
    ...quote,
    rank: i + 1,
    score: maxRatio > 0 ? Math.round((ratio / maxRatio) * 100) : 0,
  }))
}

function scoreByCarrierRated(quotes: QueQuote[]): QueQuote[] {
  // Weights: premium 40%, benefit 30%, rating 20%, fees 10%
  const scored = quotes.map((q) => {
    const premiumScore = normalizePremium(q, quotes)
    const benefitScore = normalizeBenefit(q, quotes)
    const ratingScore = normalizeRating(q)
    const feeScore = normalizeFees(q, quotes)

    const composite = Math.round(
      premiumScore * 0.4 +
      benefitScore * 0.3 +
      ratingScore * 0.2 +
      feeScore * 0.1,
    )

    return { quote: q, composite }
  })

  // Sort by composite descending
  scored.sort((a, b) => b.composite - a.composite)

  return scored.map(({ quote, composite }, i) => ({
    ...quote,
    rank: i + 1,
    score: composite,
  }))
}

// ============================================================================
// COMPARISON MATRIX
// ============================================================================

/**
 * Build a side-by-side comparison matrix from scored quotes.
 * Headers = quote identifiers (carrier + product).
 * Rows = comparable fields with values per quote.
 */
export function buildComparisonMatrix(
  quotes: QueQuote[],
): { headers: string[]; rows: { label: string; values: (string | number)[] }[] } {
  if (quotes.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = quotes.map(
    (q) => `${q.carrier_name} — ${q.product_name}`,
  )

  const rows: { label: string; values: (string | number)[] }[] = [
    {
      label: 'Rank',
      values: quotes.map((q) => q.rank ?? 0),
    },
    {
      label: 'Score',
      values: quotes.map((q) => q.score ?? 0),
    },
    {
      label: 'Monthly Premium',
      values: quotes.map((q) => q.premium_monthly ?? '—'),
    },
    {
      label: 'Annual Premium',
      values: quotes.map((q) => q.premium_annual ?? '—'),
    },
    {
      label: 'Single Premium',
      values: quotes.map((q) => q.premium_single ?? '—'),
    },
  ]

  // Collect all unique detail keys across quotes for dynamic rows
  const detailKeys = new Set<string>()
  for (const q of quotes) {
    for (const key of Object.keys(q.details)) {
      detailKeys.add(key)
    }
  }

  // Sort detail keys alphabetically for consistent output
  const sortedKeys = [...detailKeys].sort()
  for (const key of sortedKeys) {
    rows.push({
      label: formatDetailLabel(key),
      values: quotes.map((q) => {
        const val = q.details[key]
        if (val === undefined || val === null) return '—'
        if (typeof val === 'number' || typeof val === 'string') return val
        return String(val)
      }),
    })
  }

  return { headers, rows }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Safely extract a numeric value from a Record<string, unknown>.
 */
function extractNumericDetail(
  details: Record<string, unknown>,
  key: string,
): number {
  const val = details[key]
  return typeof val === 'number' ? val : 0
}

/**
 * Normalize premium score (0-100). Lower premium = higher score.
 */
function normalizePremium(quote: QueQuote, all: QueQuote[]): number {
  const premiums = all
    .map((q) => q.premium_annual ?? q.premium_single ?? 0)
    .filter((p) => p > 0)
  if (premiums.length === 0) return 50

  const min = Math.min(...premiums)
  const max = Math.max(...premiums)
  const current = quote.premium_annual ?? quote.premium_single ?? 0

  if (max === min) return 100
  // Lower premium = higher score
  return Math.round(((max - current) / (max - min)) * 100)
}

/**
 * Normalize benefit score (0-100). Higher benefit = higher score.
 */
function normalizeBenefit(quote: QueQuote, all: QueQuote[]): number {
  const benefits = all.map((q) => {
    const face = extractNumericDetail(q.details, 'face_amount')
    const accum = extractNumericDetail(q.details, 'accumulation_value')
    return face > 0 ? face : accum
  })

  const max = Math.max(...benefits, 1)
  const current =
    extractNumericDetail(quote.details, 'face_amount') ||
    extractNumericDetail(quote.details, 'accumulation_value')

  return Math.round((current / max) * 100)
}

/**
 * Normalize carrier rating to a score (0-100).
 * Maps AM Best ratings: A++ = 100, A+ = 90, A = 80, A- = 70, B++ = 60, etc.
 */
function normalizeRating(quote: QueQuote): number {
  const rating = quote.details['am_best_rating']
  if (typeof rating !== 'string') return 50 // Default mid-score if unknown

  const ratingMap: Record<string, number> = {
    'A++': 100,
    'A+': 90,
    'A': 80,
    'A-': 70,
    'B++': 60,
    'B+': 50,
    'B': 40,
    'B-': 30,
    'C++': 20,
    'C+': 10,
    'C': 5,
  }

  return ratingMap[rating] ?? 50
}

/**
 * Normalize fee score (0-100). Lower fees = higher score.
 */
function normalizeFees(quote: QueQuote, all: QueQuote[]): number {
  const fees = all
    .map((q) => extractNumericDetail(q.details, 'total_fee_rate'))
    .filter((f) => f > 0)

  if (fees.length === 0) return 50

  const min = Math.min(...fees)
  const max = Math.max(...fees)
  const current = extractNumericDetail(quote.details, 'total_fee_rate')

  if (max === min) return 100
  // Lower fees = higher score
  return Math.round(((max - current) / (max - min)) * 100)
}

/**
 * Format a snake_case detail key into a human-readable label.
 * e.g., "face_amount" → "Face Amount"
 */
function formatDetailLabel(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
