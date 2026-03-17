/**
 * calc-college-funding
 * Future cost of college calculator.
 *
 * Formula: Annual Cost at Entry = $35,331 x (1 + 6.80%)^(18 - childAge)
 *          Total Cost = Annual Cost at Entry x 4 years
 * Source: Family Needs Calculator
 *
 * Example: child age 5 => $35,331 x (1.068)^13 x 4 = ~$337,000
 */

import type { CalcResult, CalcCollegeFundingInput, CalcCollegeFundingResult } from './types'

export function calcCollegeFunding(input: CalcCollegeFundingInput): CalcResult<CalcCollegeFundingResult> {
  const {
    childAge,
    annualCostToday = 35_331,
    inflationRate = 0.068,
    collegeYears = 4,
  } = input

  const yearsUntilCollege = Math.max(0, 18 - childAge)
  const annualCostAtEntry = Math.round(annualCostToday * Math.pow(1 + inflationRate, yearsUntilCollege) * 100) / 100
  const totalCost = Math.round(annualCostAtEntry * collegeYears * 100) / 100

  const notes: string[] = []
  if (childAge >= 18) {
    notes.push('Child is already college age or older; using current cost')
  }

  return {
    value: { totalCost, annualCostAtEntry, yearsUntilCollege },
    breakdown: { childAge, annualCostToday, inflationRate, yearsUntilCollege, annualCostAtEntry, totalCost },
    notes: notes.length > 0 ? notes : undefined,
  }
}
