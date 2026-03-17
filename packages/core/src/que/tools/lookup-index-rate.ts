/**
 * lookup-index-rate
 * Returns FIA index crediting details: method, cap, participation rate, spread, fee.
 *
 * Source: Index + MVA Calcs sheet (17 indexes)
 *
 * @param query - Index name, carrier, or product (partial, case-insensitive)
 * @returns Matching index rates
 */

import type { IndexRate } from './types'
import { findIndexRates } from './data/index-rates'

export function lookupIndexRate(query: { indexName?: string; carrier?: string; product?: string }): IndexRate[] {
  return findIndexRates(query)
}
