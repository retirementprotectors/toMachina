/**
 * lookup-irmaa-bracket
 * Returns the IRMAA Part B + Part D surcharge for a given MAGI and filing status.
 *
 * Source: IRMAA Calculator (2024 + 2025 brackets)
 * Note: IRMAA uses a 2-year lookback (2025 premiums based on 2023 MAGI).
 *
 * @param magi - Modified Adjusted Gross Income
 * @param filingStatus - Filing status (default: mfj)
 * @param taxYear - Year for bracket selection (default: 2025)
 * @returns IRMAA bracket with surcharges
 */

import type { FilingStatus, IrmaaBracket } from './types'
import { getIrmaaBrackets } from './data/irmaa-brackets'

export function lookupIrmaaBracket(
  magi: number,
  filingStatus: FilingStatus = 'mfj',
  taxYear: number = 2025
): IrmaaBracket {
  const brackets = getIrmaaBrackets(taxYear, filingStatus)

  // Find the bracket this MAGI falls into
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (magi >= brackets[i].magiMin) {
      return brackets[i]
    }
  }

  // Fallback to standard (first bracket)
  return brackets[0]
}
