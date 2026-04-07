/** calc-income-need — Survivor income replacement need */
import type { CalcResult, CalcIncomeNeedInput, CalcIncomeNeedResult } from './types'

export function calcIncomeNeed(input: CalcIncomeNeedInput): CalcResult<CalcIncomeNeedResult> {
  const { annualIncome, yearsNeeded, inflationRate = 0.03 } = input
  const inflationFactor = Math.pow(1 + inflationRate, yearsNeeded)
  const totalNeed = Math.round(annualIncome * yearsNeeded * ((inflationFactor - 1) / (inflationRate * yearsNeeded > 0 ? inflationRate : 1)) * 100) / 100
  const simpleNeed = annualIncome * yearsNeeded
  return {
    value: { totalNeed, simpleNeed, inflationFactor: Math.round(inflationFactor * 1000) / 1000 },
    breakdown: { annualIncome, yearsNeeded, inflationRate, inflationFactor, totalNeed, simpleNeed },
  }
}
