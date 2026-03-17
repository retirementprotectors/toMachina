/**
 * calc-delta
 * Year-by-year advantage of proposed over current product.
 *
 * Formula: Delta = Proposed Value - Current Value (per year)
 *          Cumulative Delta = running sum
 * Source: GROWTH MAX sheet
 *
 * Crossover year = first year where proposed exceeds current.
 */

import type { CalcResult, CalcDeltaInput, CalcDeltaResult, CalcDeltaYearRow } from './types'

export function calcDelta(input: CalcDeltaInput): CalcResult<CalcDeltaResult> {
  const { proposedValues, currentValues } = input
  const schedule: CalcDeltaYearRow[] = []
  let cumulativeDelta = 0
  let crossoverYear: number | null = null
  const len = Math.max(proposedValues.length, currentValues.length)

  for (let i = 0; i < len; i++) {
    const proposedValue = proposedValues[i] ?? 0
    const currentValue = currentValues[i] ?? 0
    const delta = Math.round((proposedValue - currentValue) * 100) / 100
    cumulativeDelta = Math.round((cumulativeDelta + delta) * 100) / 100

    schedule.push({
      year: i + 1,
      proposedValue,
      currentValue,
      delta,
      cumulativeDelta,
    })

    if (crossoverYear === null && proposedValue > currentValue) {
      crossoverYear = i + 1
    }
  }

  const totalDelta = schedule.length > 0 ? schedule[schedule.length - 1].cumulativeDelta : 0

  return {
    value: { schedule, totalDelta, crossoverYear },
    breakdown: { totalDelta, crossoverYear: crossoverYear ?? 0 },
  }
}
