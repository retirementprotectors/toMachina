/**
 * calc-va-depletion
 * Year-by-year Variable Annuity burn-rate projection.
 *
 * Formula per year:
 *   Net Return = Gross Return - Total Fee Rate
 *   After Withdrawal = Starting Value - Annual Withdrawal
 *   Fees = After Withdrawal * Total Fee Rate
 *   Growth = After Withdrawal * Gross Return
 *   Ending Value = After Withdrawal + Growth - Fees
 *   (simplified: Ending = (Starting - Withdrawal) * (1 + Net Return))
 *
 * Source: GROWTH MAX + VA DB sheets
 *
 * Example: $500K, $30K/yr withdrawal, 6.04% gross, 1.65% fees
 *   Net return = 4.39%, hits $0 around age 91
 */

import type { CalcResult, CalcVaDepletionInput, CalcVaDepletionResult, CalcVaDepletionYearRow } from './types'

export function calcVaDepletion(input: CalcVaDepletionInput): CalcResult<CalcVaDepletionResult> {
  const { startingValue, annualWithdrawal, grossReturn, totalFeeRate, years } = input
  const schedule: CalcVaDepletionYearRow[] = []
  let currentValue = startingValue
  let depletionYear: number | null = null

  for (let y = 1; y <= years; y++) {
    const startVal = Math.round(currentValue * 100) / 100
    const withdrawal = Math.min(annualWithdrawal, Math.max(0, startVal))
    const afterWithdrawal = startVal - withdrawal
    const fees = Math.round(afterWithdrawal * totalFeeRate * 100) / 100
    const growth = Math.round(afterWithdrawal * grossReturn * 100) / 100
    const endingValue = Math.max(0, Math.round((afterWithdrawal + growth - fees) * 100) / 100)

    schedule.push({
      year: y,
      startingValue: startVal,
      withdrawal,
      fees,
      growth,
      endingValue,
    })

    if (endingValue <= 0 && depletionYear === null) {
      depletionYear = y
    }

    currentValue = endingValue
    if (currentValue <= 0) {
      // Fill remaining years with zeros
      for (let z = y + 1; z <= years; z++) {
        schedule.push({
          year: z,
          startingValue: 0,
          withdrawal: 0,
          fees: 0,
          growth: 0,
          endingValue: 0,
        })
      }
      break
    }
  }

  const finalValue = schedule.length > 0 ? schedule[schedule.length - 1].endingValue : startingValue

  const notes: string[] = []
  if (depletionYear !== null) {
    notes.push(`Account depletes in year ${depletionYear}`)
  }

  return {
    value: { schedule, depletionYear, finalValue },
    breakdown: {
      startingValue,
      annualWithdrawal,
      grossReturn,
      totalFeeRate,
      netReturn: grossReturn - totalFeeRate,
      finalValue,
    },
    notes: notes.length > 0 ? notes : undefined,
  }
}
