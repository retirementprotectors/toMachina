/** calc-misc-cash-need — Funeral, emergency fund, misc */
import type { CalcResult, CalcMiscCashNeedInput, CalcMiscCashNeedResult } from './types'

export function calcMiscCashNeed(input: CalcMiscCashNeedInput): CalcResult<CalcMiscCashNeedResult> {
  const { funeralCost = 15000, monthlyExpenses = 0, emergencyMonths = 6, miscAmount = 0 } = input
  const emergencyFund = monthlyExpenses * emergencyMonths
  const totalMiscNeed = funeralCost + emergencyFund + miscAmount
  return {
    value: { totalMiscNeed, funeralCost, emergencyFund },
    breakdown: { funeralCost, monthlyExpenses, emergencyMonths, emergencyFund, miscAmount, totalMiscNeed },
  }
}
