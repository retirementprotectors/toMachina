/**
 * calc-mgsv
 * Minimum Guaranteed Surrender Value calculator.
 *
 * Formula: MGSV = MGSV% x Premiums x (1 + Guaranteed Rate)^Years
 * Source: MVA Calculator
 *
 * Default: 87.5% of premiums accumulated at 3% guaranteed interest.
 *
 * Example: $100K premium, 5 years => 0.875 x $100,000 x (1.03)^5 = $101,434
 */

import type { CalcResult, CalcMgsvInput, CalcMgsvResult } from './types'

export function calcMgsv(input: CalcMgsvInput): CalcResult<CalcMgsvResult> {
  const {
    totalPremiums,
    yearsHeld,
    guaranteedRate = 0.03,
    mgsvPercent = 0.875,
  } = input

  const accumulatedValue = Math.round(totalPremiums * Math.pow(1 + guaranteedRate, yearsHeld) * 100) / 100
  const mgsv = Math.round(accumulatedValue * mgsvPercent * 100) / 100

  return {
    value: { mgsv, accumulatedValue },
    breakdown: { totalPremiums, yearsHeld, guaranteedRate, mgsvPercent, accumulatedValue, mgsv },
  }
}
