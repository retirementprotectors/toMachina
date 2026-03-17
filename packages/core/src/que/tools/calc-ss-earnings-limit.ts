/**
 * calc-ss-earnings-limit
 * Pre-FRA (Full Retirement Age) earnings impact on Social Security.
 *
 * Formula: $1 withheld per $2 above earnings limit
 *          Excess = Annual Earnings - Earnings Limit
 *          Amount Withheld = Excess / 2 (capped at annual benefit)
 *          Max Earnings = Limit + (Yearly Benefit x 2)
 *
 * Source: SS FRA Calc sheet
 * Earnings limit: $23,400 for 2025
 */

import type { CalcResult, CalcSsEarningsLimitInput, CalcSsEarningsLimitResult } from './types'

export function calcSsEarningsLimit(input: CalcSsEarningsLimitInput): CalcResult<CalcSsEarningsLimitResult> {
  const {
    annualEarnings,
    annualBenefit,
    earningsLimit = 23_400, // 2025 limit
  } = input

  const excessEarnings = Math.max(0, annualEarnings - earningsLimit)
  const rawWithheld = Math.round((excessEarnings / 2) * 100) / 100
  const amountWithheld = Math.min(rawWithheld, annualBenefit)
  const netBenefit = Math.round((annualBenefit - amountWithheld) * 100) / 100
  const maxEarningsNoWithhold = Math.round((earningsLimit + annualBenefit * 2) * 100) / 100

  const notes: string[] = []
  if (excessEarnings > 0) {
    notes.push(`Earnings exceed limit by $${excessEarnings.toLocaleString()}; $1 withheld per $2 over`)
  }
  if (amountWithheld >= annualBenefit) {
    notes.push('Entire SS benefit is withheld due to high earnings')
  }

  return {
    value: { amountWithheld, excessEarnings, netBenefit, maxEarningsNoWithhold },
    breakdown: {
      annualEarnings,
      annualBenefit,
      earningsLimit,
      excessEarnings,
      amountWithheld,
      netBenefit,
    },
    notes: notes.length > 0 ? notes : undefined,
  }
}
