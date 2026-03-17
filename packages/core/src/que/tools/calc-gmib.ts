/**
 * calc-gmib
 * Guaranteed Minimum Income Benefit calculator.
 *
 * Formula: Annual Income = Benefit Base x Payout Rate (by attained age)
 * Source: Income Comparison sheet
 *
 * Example: $1,990,295 base x 6.58% at age 70 = $130,961/yr
 */

import type { CalcResult, CalcGmibInput, CalcGmibResult } from './types'

export function calcGmib(input: CalcGmibInput): CalcResult<CalcGmibResult> {
  const { benefitBase, payoutRate } = input

  const annualIncome = Math.round(benefitBase * payoutRate * 100) / 100
  const monthlyIncome = Math.round((annualIncome / 12) * 100) / 100

  return {
    value: { annualIncome, monthlyIncome },
    breakdown: { benefitBase, payoutRate, annualIncome, monthlyIncome },
  }
}
