/**
 * lookup-tax-bracket
 * Returns the federal tax bracket and marginal rate for a given income and filing status.
 * Also returns state tax info.
 *
 * Source: PROV+FEDS+STATE sheet (2025 brackets)
 *
 * @param income - Taxable income (after deductions)
 * @param filingStatus - Filing status (default: mfj)
 * @param state - Optional state code for state rate
 * @returns Bracket info with marginal rate
 */

import type { FilingStatus, TaxBracket } from './types'
import { FEDERAL_BRACKETS_2025, STATE_TAX_RATES } from './data/tax-brackets-2025'

export interface TaxBracketLookupResult {
  bracket: TaxBracket
  marginalRate: number
  stateRate?: number
  stateName?: string
  stateRetirementExempt?: boolean
}

export function lookupTaxBracket(
  income: number,
  filingStatus: FilingStatus = 'mfj',
  state?: string
): TaxBracketLookupResult {
  const brackets = FEDERAL_BRACKETS_2025[filingStatus] || FEDERAL_BRACKETS_2025.mfj
  const taxableIncome = Math.max(0, income)

  // Find the bracket this income falls into
  let bracket = brackets[0]
  for (const b of brackets) {
    if (taxableIncome >= b.min) {
      bracket = b
    }
  }

  const result: TaxBracketLookupResult = {
    bracket,
    marginalRate: bracket.rate,
  }

  if (state) {
    const stateInfo = STATE_TAX_RATES[state.toUpperCase()]
    if (stateInfo) {
      result.stateRate = stateInfo.rate
      result.stateName = stateInfo.name
      result.stateRetirementExempt = stateInfo.retirementExempt
    }
  }

  return result
}
