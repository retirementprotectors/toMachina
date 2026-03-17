/**
 * lookup-carrier-product
 * Returns product specs, rates, and features for FIA carriers.
 *
 * Source: Index + MVA Calcs sheet (10 carriers)
 *
 * @param query - Carrier name and/or product name (partial, case-insensitive)
 * @returns Matching carrier products
 */

import type { CarrierProduct } from './types'
import { findCarrierProducts } from './data/carrier-products'

export function lookupCarrierProduct(query: { carrier?: string; product?: string }): CarrierProduct[] {
  return findCarrierProducts(query)
}
