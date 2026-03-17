/**
 * lookup-fyc-rate
 * Returns FYC Target% and Excess% for a given life insurance carrier.
 *
 * Source: UL Case Matrix (14 carriers)
 *
 * @param carrierKey - Carrier code (e.g. 'CoF', 'NAC') or full name
 * @returns FYC rate or undefined
 */

import type { FycRate } from './types'
import { findFycRate } from './data/fyc-rates'

export function lookupFycRate(carrierKey: string): FycRate | undefined {
  return findFycRate(carrierKey)
}
