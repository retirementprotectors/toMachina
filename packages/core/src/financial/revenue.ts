/**
 * Revenue calculation utilities.
 * Ported from CORE_Financial.gs calculateAnnualRevenue(), calculateMonthlyRevenue(),
 * projectRevenue(), projectCashFlow().
 * Formulas ported EXACTLY from GAS source.
 */

import { roundCurrency, normalizeRate, normalizeAmount } from './helpers'

// ============================================================================
// TYPES
// ============================================================================

interface AccountForRevenue {
  premium?: number
  amount?: number
  product_type?: string
  type?: string
  [key: string]: unknown
}

interface MonthlyBreakdown {
  month: number
  amount: number
}

interface MonthlyRevenueResult {
  total: number
  monthly: number
  breakdown: MonthlyBreakdown[]
}

interface YearProjection {
  year: number
  revenue: number
  cumulative: number
}

interface RevenueProjection {
  projections: YearProjection[]
  total: number
}

interface CashFlowProjection {
  year: number
  revenue: number
  expenses: number
  netCashFlow: number
  cumulative: number
}

interface CashFlowResult {
  projections: CashFlowProjection[]
  total: {
    revenue: number
    expenses: number
    net: number
  }
}

// ============================================================================
// REVENUE CALCULATIONS
// ============================================================================

/**
 * Calculate annual revenue from accounts.
 * Ported from CORE_Financial.gs calculateAnnualRevenue().
 */
export function calculateAnnualRevenue(
  accounts: AccountForRevenue[],
  rates?: Record<string, number>
): number {
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return 0
  }

  let total = 0
  const validRates = rates || {}

  accounts.forEach(account => {
    const premium = normalizeAmount(account.premium || account.amount || 0)

    if (Object.keys(validRates).length > 0) {
      const accountType = account.product_type || account.type || 'default'
      const rate = normalizeRate(validRates[accountType] || validRates['default'] || 0)
      total += premium * rate
    } else {
      total += premium
    }
  })

  return roundCurrency(total)
}

/**
 * Calculate monthly revenue breakdown.
 * Ported from CORE_Financial.gs calculateMonthlyRevenue().
 */
export function calculateMonthlyRevenue(
  accounts: AccountForRevenue[],
  rates?: Record<string, number>
): MonthlyRevenueResult {
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return { total: 0, monthly: 0, breakdown: [] }
  }

  const annual = calculateAnnualRevenue(accounts, rates)
  const monthly = roundCurrency(annual / 12)

  const breakdown: MonthlyBreakdown[] = []
  const monthlyAmount = roundCurrency(annual / 12)
  for (let i = 0; i < 12; i++) {
    breakdown.push({ month: i + 1, amount: monthlyAmount })
  }

  return { total: annual, monthly, breakdown }
}

/**
 * Project revenue over multiple years with growth rate.
 * Ported from CORE_Financial.gs projectRevenue().
 */
export function projectRevenue(
  accounts: AccountForRevenue[],
  years: number,
  growthRate: number,
  rates?: Record<string, number>
): RevenueProjection {
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return { projections: [], total: 0 }
  }

  const validYears = Math.max(1, Math.floor(years || 1))
  const validGrowthRate = normalizeRate(growthRate || 0)

  const baseRevenue = calculateAnnualRevenue(accounts, rates)
  const projections: YearProjection[] = []
  let total = 0

  for (let year = 1; year <= validYears; year++) {
    const yearRevenue = roundCurrency(baseRevenue * Math.pow(1 + validGrowthRate, year - 1))
    total += yearRevenue
    projections.push({
      year,
      revenue: yearRevenue,
      cumulative: roundCurrency(total),
    })
  }

  return { projections, total: roundCurrency(total) }
}

/**
 * Project cash flow over multiple years.
 * Ported from CORE_Financial.gs projectCashFlow().
 */
export function projectCashFlow(
  revenue: number | number[],
  expenses: number | number[],
  years: number
): CashFlowResult {
  const validYears = Math.max(1, Math.floor(years || 1))

  const revenueArray = Array.isArray(revenue)
    ? revenue
    : Array(validYears).fill(normalizeAmount(typeof revenue === 'number' ? revenue : 0))

  const expensesArray = Array.isArray(expenses)
    ? expenses
    : Array(validYears).fill(normalizeAmount(typeof expenses === 'number' ? expenses : 0))

  const projections: CashFlowProjection[] = []
  let totalRevenue = 0
  let totalExpenses = 0

  for (let year = 1; year <= validYears; year++) {
    const rawRevenue = revenueArray[year - 1]
    const rawExpenses = expensesArray[year - 1]

    const yearRevenue = normalizeAmount(
      typeof rawRevenue === 'object' && rawRevenue !== null
        ? ((rawRevenue as Record<string, number>).amount || (rawRevenue as Record<string, number>).revenue || 0)
        : (typeof rawRevenue === 'number' ? rawRevenue : 0)
    )

    const yearExpenses = normalizeAmount(
      typeof rawExpenses === 'object' && rawExpenses !== null
        ? ((rawExpenses as Record<string, number>).amount || (rawExpenses as Record<string, number>).expenses || 0)
        : (typeof rawExpenses === 'number' ? rawExpenses : 0)
    )

    const netCashFlow = roundCurrency(yearRevenue - yearExpenses)

    totalRevenue += yearRevenue
    totalExpenses += yearExpenses

    projections.push({
      year,
      revenue: roundCurrency(yearRevenue),
      expenses: roundCurrency(yearExpenses),
      netCashFlow,
      cumulative: roundCurrency(totalRevenue - totalExpenses),
    })
  }

  return {
    projections,
    total: {
      revenue: roundCurrency(totalRevenue),
      expenses: roundCurrency(totalExpenses),
      net: roundCurrency(totalRevenue - totalExpenses),
    },
  }
}
