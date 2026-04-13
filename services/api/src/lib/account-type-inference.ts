/**
 * Account type inference and owner name parsing utilities.
 *
 * Used by the carrier import pipeline to classify accounts
 * when the carrier format doesn't provide an explicit category.
 */

// Keywords that signal specific account types
const LIFE_SIGNALS = [
  'life', 'iul', 'ul', 'vul', 'whole life', 'term', 'universal life',
  'indexed universal', 'variable universal', 'death benefit', 'face amount',
  'beneficiary', 'insured', 'cash value', 'paid up', 'level term',
  'graded', 'guaranteed issue', 'final expense',
]

const ANNUITY_SIGNALS = [
  'annuity', 'fia', 'myga', 'spia', 'dia', 'rila',
  'fixed index', 'multi-year', 'fixed annuity', 'variable annuity',
  'accumulation', 'annuitant', 'surrender', 'income rider',
  'guaranteed minimum', 'contract value', 'account value',
]

const MEDICARE_SIGNALS = [
  'medicare', 'mapd', 'pdp', 'supplement', 'medigap', 'med supp',
  'part d', 'part c', 'advantage', 'enrollment', 'cms',
  'member id', 'disenroll', 'snp', 'hmo', 'ppo',
]

const INVESTMENT_SIGNALS = [
  'brokerage', 'advisory', 'ria', 'bd', 'custodian', 'rep code',
  'market value', 'portfolio', 'mutual fund', 'etf', 'cusip',
  'share class', 'nav', 'cost basis', 'fee schedule', 'management fee',
  'schwab', 'rbc', 'dst', 'broker dealer', 'registered investment',
  'account number', 'model portfolio',
]

const BANKING_SIGNALS = [
  'cd', 'certificate of deposit', 'savings', 'checking', 'money market',
  'apy', 'fdic', 'routing', 'bank', 'deposit', 'maturity date',
  'term months', 'high yield', 'jumbo cd',
]

const LIABILITY_SIGNALS = [
  'mortgage', 'loan', 'debt', 'heloc', 'credit card', 'lender',
  'payoff', 'balance due', 'monthly payment', 'student loan', 'auto loan',
  'personal loan', 'line of credit', 'interest rate', 'collateral',
]

/**
 * Infer the account type/category from available data fields.
 *
 * Scans field names, values, product names, and carrier identifiers
 * to determine the most likely category.
 *
 * Returns 'life' | 'annuity' | 'medicare' | 'investments' | 'unknown'
 */
export function inferAccountType(data: Record<string, unknown>): string {
  // If explicitly tagged, trust it
  if (data.account_category && typeof data.account_category === 'string') {
    const explicit = data.account_category.toLowerCase().trim()
    if (['life', 'annuity', 'medicare', 'investments', 'investment', 'bdria', 'bd_ria', 'banking', 'bank', 'liabilities', 'liability', 'debt'].includes(explicit)) {
      if (explicit === 'bd_ria' || explicit === 'bdria' || explicit === 'investment') return 'investments'
      if (explicit === 'bank') return 'banking'
      if (explicit === 'liability' || explicit === 'debt') return 'liabilities'
      return explicit
    }
  }

  if (data.line_of_business && typeof data.line_of_business === 'string') {
    const lob = data.line_of_business.toLowerCase().trim()
    if (lob.includes('life')) return 'life'
    if (lob.includes('annuit')) return 'annuity'
    if (lob.includes('medicare') || lob.includes('health')) return 'medicare'
    if (lob.includes('invest') || lob.includes('advisory') || lob.includes('brokerage')) return 'investments'
    if (lob.includes('bank') || lob.includes('cd') || lob.includes('deposit')) return 'banking'
    if (lob.includes('loan') || lob.includes('mortgage') || lob.includes('debt') || lob.includes('liabilit')) return 'liabilities'
  }

  // Build a searchable text blob from all string values + keys
  const textParts: string[] = []
  for (const [key, val] of Object.entries(data)) {
    textParts.push(key.toLowerCase())
    if (typeof val === 'string') {
      textParts.push(val.toLowerCase())
    }
  }
  const blob = textParts.join(' ')

  // Score each category
  const scores: Record<string, number> = {
    life: 0,
    annuity: 0,
    medicare: 0,
    investments: 0,
    banking: 0,
    liabilities: 0,
  }

  for (const signal of LIFE_SIGNALS) {
    if (blob.includes(signal)) scores.life++
  }
  for (const signal of ANNUITY_SIGNALS) {
    if (blob.includes(signal)) scores.annuity++
  }
  for (const signal of MEDICARE_SIGNALS) {
    if (blob.includes(signal)) scores.medicare++
  }
  for (const signal of INVESTMENT_SIGNALS) {
    if (blob.includes(signal)) scores.investments++
  }
  for (const signal of BANKING_SIGNALS) {
    if (blob.includes(signal)) scores.banking++
  }
  for (const signal of LIABILITY_SIGNALS) {
    if (blob.includes(signal)) scores.liabilities++
  }

  // Structural signals (field presence)
  if (data.face_amount != null || data.death_benefit != null || data.insured_name != null) {
    scores.life += 3
  }
  if (data.account_value != null || data.annuitant_name != null || data.surrender_charge_pct != null) {
    scores.annuity += 3
  }
  if (data.member_id != null || data.plan_type != null || data.county != null) {
    scores.medicare += 3
  }
  if (data.market_value != null || data.cusip != null || data.rep_code != null || data.nav != null) {
    scores.investments += 3
  }
  if (data.routing_number != null || data.apy != null || data.fdic_insured != null || data.maturity_date != null) {
    scores.banking += 3
  }
  if (data.loan_type != null || data.monthly_payment != null || data.payoff_date != null || data.collateral != null) {
    scores.liabilities += 3
  }

  // Find winner
  let maxScore = 0
  let winner = 'unknown'
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      winner = category
    }
  }

  // Require at least 2 signals to make a call
  if (maxScore < 2) return 'unknown'

  return winner
}

/**
 * Parse an owner name string into first_name and last_name.
 *
 * Handles these formats:
 *   "LAST, FIRST"        → { first_name: "First", last_name: "Last" }
 *   "LAST, FIRST MIDDLE" → { first_name: "First", last_name: "Last" }
 *   "FIRST LAST"         → { first_name: "First", last_name: "Last" }
 *   "FIRST M LAST"       → { first_name: "First", last_name: "Last" }
 *   "FIRST"              → { first_name: "First", last_name: "" }
 *
 * Names are title-cased in the output.
 */
export function parseOwnerName(ownerName: string): { first_name: string; last_name: string } {
  if (!ownerName || typeof ownerName !== 'string') {
    return { first_name: '', last_name: '' }
  }

  const trimmed = ownerName.trim()
  if (!trimmed) {
    return { first_name: '', last_name: '' }
  }

  let firstName = ''
  let lastName = ''

  if (trimmed.includes(',')) {
    // "LAST, FIRST" or "LAST, FIRST MIDDLE"
    const [lastPart, ...rest] = trimmed.split(',')
    lastName = lastPart.trim()
    const firstParts = rest.join(',').trim().split(/\s+/)
    firstName = firstParts[0] || ''
  } else {
    // "FIRST LAST" or "FIRST M LAST" or single name
    const parts = trimmed.split(/\s+/)
    if (parts.length === 1) {
      firstName = parts[0]
      lastName = ''
    } else if (parts.length === 2) {
      firstName = parts[0]
      lastName = parts[1]
    } else {
      // 3+ parts: first is first name, last is last name, middle discarded
      firstName = parts[0]
      lastName = parts[parts.length - 1]
    }
  }

  return {
    first_name: titleCase(firstName),
    last_name: titleCase(lastName),
  }
}

function titleCase(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
