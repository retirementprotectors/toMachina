/**
 * calc-rollup
 * Benefit base growth projection (simple or compound).
 *
 * Formula:
 *   Simple:   Base + (Base x Rate x Year)
 *   Compound: Base x (1 + Rate)^Year
 * Source: GMIB-to-Life process
 */

import type { CalcResult, CalcRollupInput, CalcRollupResult, CalcRollupYearRow } from './types'

export function calcRollup(input: CalcRollupInput): CalcResult<CalcRollupResult> {
  const { startingBase, rollupRate, years, method = 'simple' } = input
  const schedule: CalcRollupYearRow[] = []
  let currentBase = startingBase

  for (let y = 1; y <= years; y++) {
    let growth: number
    let newBase: number

    if (method === 'compound') {
      growth = Math.round(currentBase * rollupRate * 100) / 100
      newBase = Math.round((currentBase + growth) * 100) / 100
    } else {
      // Simple: always based on starting base
      growth = Math.round(startingBase * rollupRate * 100) / 100
      newBase = Math.round((currentBase + growth) * 100) / 100
    }

    schedule.push({ year: y, benefitBase: newBase, growth })
    currentBase = newBase
  }

  const finalBase = schedule.length > 0 ? schedule[schedule.length - 1].benefitBase : startingBase
  const totalGrowth = Math.round((finalBase - startingBase) * 100) / 100

  return {
    value: { finalBase, totalGrowth, schedule },
    breakdown: { startingBase, rollupRate, years, finalBase, totalGrowth },
  }
}
