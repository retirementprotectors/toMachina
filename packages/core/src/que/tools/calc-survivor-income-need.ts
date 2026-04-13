/** calc-survivor-income-need — Ongoing income gap for survivors */
import type { CalcResult, CalcSurvivorIncomeNeedInput, CalcSurvivorIncomeNeedResult } from './types'

export function calcSurvivorIncomeNeed(input: CalcSurvivorIncomeNeedInput): CalcResult<CalcSurvivorIncomeNeedResult> {
  const { survivorMonthlyExpenses, survivorMonthlyIncome, yearsNeeded } = input
  const monthlyGap = Math.max(0, survivorMonthlyExpenses - survivorMonthlyIncome)
  const annualGap = monthlyGap * 12
  const totalIncomeNeed = annualGap * yearsNeeded
  return {
    value: { totalIncomeNeed, monthlyGap, annualGap },
    breakdown: { survivorMonthlyExpenses, survivorMonthlyIncome, monthlyGap, annualGap, yearsNeeded, totalIncomeNeed },
  }
}
