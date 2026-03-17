/**
 * calc-fia-projection
 * Year-by-year Fixed Index Annuity growth projection.
 *
 * Formula:
 *   Year 1: Starting = Deposits x (1 + First Year Bonus)
 *   Each year: Growth = (Starting - Withdrawal) * Hypo Growth Rate
 *              Fees = (Starting - Withdrawal) * Annual Fee Rate
 *              Ending = Starting - Withdrawal + Growth - Fees
 *
 * Source: GROWTH MAX sheet
 *
 * FIAs typically have 0% M+E+A fees (unlike VAs), so growth compounds faster.
 */

import type { CalcResult, CalcFiaProjectionInput, CalcFiaProjectionResult, CalcFiaProjectionYearRow } from './types'

export function calcFiaProjection(input: CalcFiaProjectionInput): CalcResult<CalcFiaProjectionResult> {
  const {
    deposits,
    firstYearBonus,
    hypoGrowthRate,
    years,
    annualWithdrawal = 0,
    annualFeeRate = 0,
  } = input

  const schedule: CalcFiaProjectionYearRow[] = []
  let currentValue = Math.round(deposits * (1 + firstYearBonus) * 100) / 100

  for (let y = 1; y <= years; y++) {
    const startVal = Math.round(currentValue * 100) / 100
    const withdrawal = Math.min(annualWithdrawal, Math.max(0, startVal))
    const afterWithdrawal = startVal - withdrawal
    const fees = Math.round(afterWithdrawal * annualFeeRate * 100) / 100
    const growth = Math.round(afterWithdrawal * hypoGrowthRate * 100) / 100
    const endingValue = Math.max(0, Math.round((afterWithdrawal + growth - fees) * 100) / 100)

    schedule.push({
      year: y,
      startingValue: startVal,
      withdrawal,
      fees,
      growth,
      endingValue,
    })

    currentValue = endingValue
  }

  const finalValue = schedule.length > 0 ? schedule[schedule.length - 1].endingValue : currentValue
  const totalGrowth = Math.round((finalValue - deposits) * 100) / 100

  return {
    value: { schedule, finalValue, totalGrowth },
    breakdown: {
      deposits,
      firstYearBonus,
      startingValueWithBonus: Math.round(deposits * (1 + firstYearBonus) * 100) / 100,
      hypoGrowthRate,
      finalValue,
      totalGrowth,
    },
  }
}
