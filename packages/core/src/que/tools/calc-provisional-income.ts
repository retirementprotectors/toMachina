/**
 * calc-provisional-income
 * IRS formula for Social Security taxation threshold.
 *
 * Formula: Provisional Income = 50% x SS Benefits
 *          + Taxable Pensions + Wages + Interest/Dividends
 *          + IRA Distributions/Conversions + Tax-Exempt Income
 * Source: PROV+FEDS+STATE sheet
 *
 * This determines which SS taxation bracket applies (0%, 50%, or 85%).
 */

import type { CalcResult, CalcProvisionalIncomeInput, CalcProvisionalIncomeResult } from './types'

export function calcProvisionalIncome(input: CalcProvisionalIncomeInput): CalcResult<CalcProvisionalIncomeResult> {
  const {
    ssBenefits,
    taxablePensions = 0,
    wages = 0,
    interestDividends = 0,
    iraDistributions = 0,
    taxExemptIncome = 0,
  } = input

  const halfSS = Math.round(ssBenefits * 0.5 * 100) / 100
  const otherIncome = Math.round((taxablePensions + wages + interestDividends + iraDistributions + taxExemptIncome) * 100) / 100
  const provisionalIncome = Math.round((halfSS + otherIncome) * 100) / 100

  return {
    value: { provisionalIncome, halfSS, otherIncome },
    breakdown: {
      ssBenefits,
      halfSS,
      taxablePensions,
      wages,
      interestDividends,
      iraDistributions,
      taxExemptIncome,
      provisionalIncome,
    },
  }
}
