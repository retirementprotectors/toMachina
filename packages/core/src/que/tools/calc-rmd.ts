/**
 * calc-rmd
 * Required Minimum Distribution calculator for QUE casework.
 *
 * Formula: RMD = Prior Year Value / IRS Uniform Lifetime Factor
 * Source: RMD Calc sheet
 *
 * Example: age 73, $500K => $500,000 / 26.5 = $18,868
 *
 * Note: This is the QUE casework version (pure, no urgency/deadline logic).
 * The full RMD module with urgency tracking lives in packages/core/financial/rmd.ts.
 */

import type { CalcResult, CalcRmdInput, CalcRmdResult } from './types'
import { lookupIrsFactor } from './lookup-irs-factor'

export function calcRmd(input: CalcRmdInput): CalcResult<CalcRmdResult> {
  const { age, priorYearValue } = input
  const notes: string[] = []

  const lookup = lookupIrsFactor(age)
  if (!lookup) {
    return {
      value: { rmd: 0, factor: 0 },
      notes: [`Age ${age} is outside the IRS Uniform Lifetime Table range (72-120)`],
    }
  }

  const factor = lookup.factor
  const rmd = Math.round((priorYearValue / factor) * 100) / 100

  if (age < 73) {
    notes.push('SECURE Act 2.0: RMD begins at 73 for those born 1951-1959, 75 for born 1960+')
  }

  return {
    value: { rmd, factor },
    breakdown: { priorYearValue, factor, rmd },
    notes: notes.length > 0 ? notes : undefined,
  }
}
