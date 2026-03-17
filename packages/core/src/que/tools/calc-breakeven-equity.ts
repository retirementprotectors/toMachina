/**
 * calc-breakeven-equity
 * Return rate needed to avoid losing principal.
 *
 * Formula: BEP Rate = (Withdrawals + Fees - Income) / Portfolio Value
 * Source: Income Portfolio Analysis
 *
 * KILLER METRIC: If BEP > 7-8%, client is guaranteed to run out of money.
 */

import type { CalcResult, CalcBreakevenEquityInput, CalcBreakevenEquityResult } from './types'

export function calcBreakevenEquity(input: CalcBreakevenEquityInput): CalcResult<CalcBreakevenEquityResult> {
  const { annualWithdrawals, annualFees, annualIncome, portfolioValue } = input

  const netDrain = annualWithdrawals + annualFees - annualIncome
  const breakevenRate = portfolioValue > 0
    ? Math.round((netDrain / portfolioValue) * 10000) / 10000
    : 0
  const breakevenPercent = Math.round(breakevenRate * 10000) / 100
  const isUnsustainable = breakevenPercent > 7

  const notes: string[] = []
  if (isUnsustainable) {
    notes.push(`WARNING: Required return of ${breakevenPercent}% exceeds sustainable threshold (7%). Client is likely to deplete principal.`)
  }

  return {
    value: { breakevenRate, breakevenPercent, isUnsustainable },
    breakdown: {
      annualWithdrawals,
      annualFees,
      annualIncome,
      portfolioValue,
      netDrain,
      breakevenRate,
    },
    notes: notes.length > 0 ? notes : undefined,
  }
}
