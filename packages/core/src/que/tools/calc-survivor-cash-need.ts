/** calc-survivor-cash-need — Immediate cash needed at death */
import type { CalcResult, CalcSurvivorCashNeedInput, CalcSurvivorCashNeedResult } from './types'

export function calcSurvivorCashNeed(input: CalcSurvivorCashNeedInput): CalcResult<CalcSurvivorCashNeedResult> {
  const { debtTotal = 0, funeralCost = 15000, emergencyFund = 0, finalExpenses = 5000 } = input
  const totalCashNeed = debtTotal + funeralCost + emergencyFund + finalExpenses
  return {
    value: { totalCashNeed },
    breakdown: { debtTotal, funeralCost, emergencyFund, finalExpenses, totalCashNeed },
  }
}
