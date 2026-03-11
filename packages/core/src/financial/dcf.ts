/**
 * DCF valuation and book value calculations.
 * Ported from CORE_Financial.gs calculateDCF(), calculateBookValue().
 * Formulas ported EXACTLY from GAS source.
 */

import { roundCurrency, normalizeRate, normalizeAmount } from './helpers'
import { calculateNPV } from './npv'

/**
 * Calculate book value using revenue multiple.
 * Ported from CORE_Financial.gs calculateBookValue().
 */
export function calculateBookValue(revenue: number, multiple: number): number {
  const validRevenue = normalizeAmount(revenue)
  let validMultiple = multiple || 1
  if (validMultiple < 0) validMultiple = 1
  return roundCurrency(validRevenue * validMultiple)
}

/**
 * Calculate Discounted Cash Flow (DCF) valuation.
 * Ported from CORE_Financial.gs calculateDCF().
 *
 * Uses Gordon Growth Model for terminal value if not provided:
 * Terminal Value = Last CF * (1 + g) / (r - g)
 */
export function calculateDCF(
  cashflows: number[],
  discountRate: number,
  terminalValue?: number | null,
  terminalGrowthRate?: number
): number {
  if (!cashflows || !Array.isArray(cashflows) || cashflows.length === 0) {
    return 0
  }

  const rate = normalizeRate(discountRate || 0.10)
  const growthRate = normalizeRate(terminalGrowthRate || 0.03)

  // Calculate NPV of projected cashflows
  const npv = calculateNPV(cashflows, rate)

  // Calculate terminal value
  let terminal: number
  if (terminalValue !== null && terminalValue !== undefined) {
    terminal = normalizeAmount(terminalValue)
  } else {
    // Gordon Growth Model
    const lastCF = normalizeAmount(cashflows[cashflows.length - 1])
    if (rate <= growthRate) {
      // If discount rate <= growth rate, use simple multiple (fallback)
      terminal = lastCF * 10
    } else {
      terminal = lastCF * (1 + growthRate) / (rate - growthRate)
    }
  }

  // Discount terminal value to present
  const discountedTerminal = terminal / Math.pow(1 + rate, cashflows.length)

  return roundCurrency(npv + discountedTerminal)
}
