// ---------------------------------------------------------------------------
// IRS Required Minimum Distribution (RMD) Calculator
// SECURE Act 2.0: RMD begins at age 73 (born 1951-1959), 75 (born 1960+)
// ---------------------------------------------------------------------------

/**
 * IRS Uniform Lifetime Table (Table III) — used when spouse is NOT the sole
 * beneficiary or spouse is ≤ 10 years younger.
 * Key = age of account owner, Value = distribution period (years).
 */
const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0,
  102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
  120: 2.0,
}

/**
 * Joint and Last Survivor Table — used when spouse is the sole beneficiary
 * AND is more than 10 years younger. Indexed as [owner_age][spouse_age].
 * This is a simplified version for common age gaps.
 */
const JOINT_SURVIVOR_TABLE: Record<number, Record<number, number>> = {}

export interface RmdInput {
  /** Age of account owner as of Dec 31 of the RMD year */
  ownerAge: number
  /** Fair Market Value of account as of Dec 31 of PRIOR year */
  priorYearBalance: number
  /** Whether this is the owner's first RMD year */
  isFirstRmd?: boolean
  /** Spouse age if sole beneficiary and > 10 years younger */
  spouseAge?: number
  /** Amount already distributed this year */
  amountDistributed?: number
  /** Whether systematic RMD is set up */
  systematicRmd?: boolean
}

export interface RmdResult {
  /** Calculated RMD amount */
  amount: number
  /** Distribution period (life expectancy factor) used */
  distributionPeriod: number
  /** Deadline for this RMD */
  deadline: string
  /** Whether the RMD has been satisfied */
  satisfied: boolean
  /** Remaining amount to distribute */
  remaining: number
  /** Urgency level */
  urgency: 'completed' | 'normal' | 'soon' | 'urgent' | 'overdue'
  /** Days until deadline */
  daysUntilDeadline: number
}

export interface RmdScheduleRow {
  year: number
  age: number
  projectedBalance: number
  distributionPeriod: number
  rmdAmount: number
  cumulativeDistributed: number
}

/**
 * Get the RMD starting age based on birth year.
 * SECURE Act 2.0 rules:
 * - Born 1950 or before: 72
 * - Born 1951-1959: 73
 * - Born 1960 or after: 75
 */
export function getRmdStartAge(birthYear: number): number {
  if (birthYear <= 1950) return 72
  if (birthYear <= 1959) return 73
  return 75
}

/**
 * Get the distribution period (life expectancy factor) for a given age.
 * Uses the Uniform Lifetime Table by default.
 * If spouse is sole beneficiary and > 10 years younger, would use Joint table.
 */
export function getDistributionPeriod(ownerAge: number, spouseAge?: number): number {
  // If spouse is sole beneficiary and > 10 years younger, use joint table
  if (spouseAge !== undefined && (ownerAge - spouseAge) > 10) {
    const joint = JOINT_SURVIVOR_TABLE[ownerAge]?.[spouseAge]
    if (joint) return joint
  }

  // Default: Uniform Lifetime Table
  const clamped = Math.min(120, Math.max(72, ownerAge))
  return UNIFORM_LIFETIME_TABLE[clamped] ?? 2.0
}

/**
 * Calculate the RMD amount for a given year.
 */
export function calculateRmd(input: RmdInput): RmdResult {
  const { ownerAge, priorYearBalance, isFirstRmd, spouseAge, amountDistributed = 0, systematicRmd } = input

  const distributionPeriod = getDistributionPeriod(ownerAge, spouseAge)
  const amount = Math.round((priorYearBalance / distributionPeriod) * 100) / 100
  const remaining = Math.max(0, Math.round((amount - amountDistributed) * 100) / 100)
  const satisfied = remaining <= 0 || amountDistributed >= amount

  // Deadline: April 1 of next year for first RMD, Dec 31 for subsequent
  const now = new Date()
  const currentYear = now.getFullYear()
  let deadline: Date
  if (isFirstRmd) {
    deadline = new Date(currentYear + 1, 3, 1) // April 1 next year
  } else {
    deadline = new Date(currentYear, 11, 31) // Dec 31 this year
  }

  const deadlineStr = deadline.toISOString().split('T')[0]
  const msUntil = deadline.getTime() - now.getTime()
  const daysUntilDeadline = Math.ceil(msUntil / (1000 * 60 * 60 * 24))

  let urgency: RmdResult['urgency']
  if (satisfied) {
    urgency = 'completed'
  } else if (daysUntilDeadline < 0) {
    urgency = 'overdue'
  } else if (daysUntilDeadline <= 30) {
    urgency = 'urgent'
  } else if (daysUntilDeadline <= 90) {
    urgency = 'soon'
  } else {
    urgency = 'normal'
  }

  return {
    amount,
    distributionPeriod,
    deadline: deadlineStr,
    satisfied,
    remaining,
    urgency,
    daysUntilDeadline,
  }
}

/**
 * Generate a multi-year RMD schedule projection.
 * Assumes a constant growth rate and that RMDs are taken from the account.
 */
export function generateRmdSchedule(
  startAge: number,
  startBalance: number,
  years: number = 10,
  growthRate: number = 0.04,
): RmdScheduleRow[] {
  const schedule: RmdScheduleRow[] = []
  let balance = startBalance
  let cumulative = 0
  const currentYear = new Date().getFullYear()

  for (let i = 0; i < years; i++) {
    const age = startAge + i
    if (age > 120) break

    const period = getDistributionPeriod(age)
    const rmd = Math.round((balance / period) * 100) / 100
    cumulative += rmd

    schedule.push({
      year: currentYear + i,
      age,
      projectedBalance: Math.round(balance * 100) / 100,
      distributionPeriod: period,
      rmdAmount: rmd,
      cumulativeDistributed: Math.round(cumulative * 100) / 100,
    })

    // Next year: subtract RMD, apply growth
    balance = (balance - rmd) * (1 + growthRate)
    if (balance <= 0) break
  }

  return schedule
}

/**
 * Check if an account type is RMD-eligible.
 * RMDs apply to: traditional IRA, SEP IRA, SIMPLE IRA, 401k, 403b, annuity (qualified), Investments (qualified).
 * RMDs do NOT apply to: Roth IRA (during owner's lifetime), life insurance, medicare.
 */
export function isRmdEligible(accountType: string, taxStatus?: string): boolean {
  const t = (accountType || '').toLowerCase()
  const tax = (taxStatus || '').toLowerCase()

  // Roth accounts are exempt during owner's lifetime
  if (t.includes('roth')) return false

  // Life and medicare are not RMD-eligible
  if (t.includes('life') || t.includes('medicare')) return false

  // Qualified accounts are RMD-eligible
  if (tax.includes('qualified') || tax.includes('pre-tax') || tax.includes('traditional')) return true

  // Annuity and Investments are typically qualified
  if (t.includes('annuity') || t.includes('ira') || t.includes('401') || t.includes('403') || t.includes('sep') || t.includes('simple')) return true
  if (t.includes('investment') || t.includes('bdria') || t.includes('bd_ria') || t.includes('brokerage')) return true

  return false
}
