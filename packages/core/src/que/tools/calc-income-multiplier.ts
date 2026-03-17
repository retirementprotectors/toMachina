/**
 * calc-income-multiplier
 * Life insurance needs based on age bracket.
 *
 * Formula: Recommended Coverage = Annual Income x Multiplier
 * Source: Family Needs Calculator
 *
 * Age-based multipliers:
 *   20-39 = 30x
 *   40-44 = 25x
 *   45-49 = 20x
 *   50-54 = 15x
 *   55-59 = 12x
 *   60-69 = 10x
 *   70+   = 5x
 */

import type { CalcResult, CalcIncomeMultiplierInput, CalcIncomeMultiplierResult } from './types'

function getMultiplier(age: number): number {
  if (age < 20) return 30
  if (age < 40) return 30
  if (age < 45) return 25
  if (age < 50) return 20
  if (age < 55) return 15
  if (age < 60) return 12
  if (age < 70) return 10
  return 5
}

export function calcIncomeMultiplier(input: CalcIncomeMultiplierInput): CalcResult<CalcIncomeMultiplierResult> {
  const { age, annualIncome } = input

  const multiplier = getMultiplier(age)
  const recommendedCoverage = Math.round(annualIncome * multiplier * 100) / 100

  return {
    value: { multiplier, recommendedCoverage },
    breakdown: { age, annualIncome, multiplier, recommendedCoverage },
  }
}
