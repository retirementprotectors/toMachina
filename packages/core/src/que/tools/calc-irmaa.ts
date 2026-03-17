/**
 * calc-irmaa
 * Medicare IRMAA (Income-Related Monthly Adjustment Amount) calculator.
 *
 * Formula: MAGI bracket lookup => Part B monthly surcharge + Part D monthly surcharge
 * Note: IRMAA uses a 2-year lookback (2025 premiums based on 2023 MAGI).
 *
 * Source: IRMAA Calculator sheet
 *
 * 2025 MFJ brackets:
 *   $0-$212K => $0 surcharge
 *   $212K-$265K => Tier 1
 *   $265K-$332K => Tier 2
 *   $332K-$398K => Tier 3
 *   $398K-$750K => Tier 4
 *   $750K+ => Tier 5 (max)
 */

import type { CalcResult, CalcIrmaaInput, CalcIrmaaResult } from './types'
import { lookupIrmaaBracket } from './lookup-irmaa-bracket'

export function calcIrmaa(input: CalcIrmaaInput): CalcResult<CalcIrmaaResult> {
  const { magi, filingStatus = 'mfj', taxYear = 2025 } = input

  const bracket = lookupIrmaaBracket(magi, filingStatus, taxYear)
  const annualSurcharge = Math.round((bracket.partBMonthly + bracket.partDMonthly) * 12 * 100) / 100

  const notes: string[] = []
  if (bracket.tier !== 'Standard') {
    notes.push(`IRMAA surcharge triggered at ${bracket.tier}: $${annualSurcharge.toLocaleString()}/year per person`)
    notes.push('IRMAA uses 2-year lookback: 2025 premiums based on 2023 MAGI')
  }

  return {
    value: {
      partBSurcharge: bracket.partBMonthly,
      partDSurcharge: bracket.partDMonthly,
      annualSurcharge,
      tier: bracket.tier,
    },
    breakdown: {
      magi,
      partBMonthly: bracket.partBMonthly,
      partDMonthly: bracket.partDMonthly,
      annualSurcharge,
    },
    notes: notes.length > 0 ? notes : undefined,
  }
}
