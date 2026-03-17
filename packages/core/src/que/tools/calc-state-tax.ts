/**
 * calc-state-tax
 * State income tax calculator.
 *
 * CRITICAL: Iowa does NOT tax retirement income distributions
 * (IRA, pension, annuity, Social Security). Federal only.
 * Several other states also exempt retirement income (IL, MS, PA).
 *
 * Source: PROV+FEDS+STATE sheet
 *
 * @param input - Taxable income, state code, and whether this is retirement income
 */

import type { CalcResult, CalcStateTaxInput, CalcStateTaxResult } from './types'
import { STATE_TAX_RATES } from './data/tax-brackets-2025'

export function calcStateTax(input: CalcStateTaxInput): CalcResult<CalcStateTaxResult> {
  const { taxableIncome, state, isRetirementIncome = false } = input
  const stateCode = state.toUpperCase()
  const stateInfo = STATE_TAX_RATES[stateCode]

  if (!stateInfo) {
    return {
      value: { stateTax: 0, effectiveRate: 0, note: `Unknown state code: ${stateCode}` },
      notes: [`State code '${stateCode}' not found in tax database`],
    }
  }

  const notes: string[] = []

  // Check if this state exempts retirement income
  if (isRetirementIncome && stateInfo.retirementExempt) {
    notes.push(`${stateInfo.name} does not tax retirement income distributions (IRA, pension, annuity, SS)`)
    return {
      value: { stateTax: 0, effectiveRate: 0, note: notes[0] },
      breakdown: { taxableIncome, stateRate: stateInfo.rate, stateTax: 0 },
      notes,
    }
  }

  // Zero-tax states
  if (stateInfo.rate === 0) {
    notes.push(`${stateInfo.name} has no state income tax`)
    return {
      value: { stateTax: 0, effectiveRate: 0, note: notes[0] },
      breakdown: { taxableIncome, stateRate: 0, stateTax: 0 },
      notes,
    }
  }

  const stateTax = Math.round(taxableIncome * stateInfo.rate * 100) / 100
  const effectiveRate = stateInfo.rate

  return {
    value: { stateTax, effectiveRate },
    breakdown: { taxableIncome, stateRate: stateInfo.rate, stateTax },
    notes: notes.length > 0 ? notes : undefined,
  }
}
