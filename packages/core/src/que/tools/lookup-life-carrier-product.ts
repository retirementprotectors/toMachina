/**
 * lookup-life-carrier-product
 * Carrier product specs: term, UL, IUL, whole life offerings.
 *
 * Source: RPI Life & Estate carrier relationships
 */

import type { CalcResult } from './types'

export interface LifeCarrierProduct {
  carrier: string
  product: string
  type: 'term' | 'ul' | 'iul' | 'whole-life' | 'gul'
  minFaceAmount: number
  maxFaceAmount: number
  availableRiders: string[]
  strengthNote: string
}

const LIFE_CARRIER_PRODUCTS: LifeCarrierProduct[] = [
  {
    carrier: 'Lincoln Financial',
    product: 'TermAccel',
    type: 'term',
    minFaceAmount: 100000,
    maxFaceAmount: 1000000,
    availableRiders: ['WOP', 'ADB', 'CI'],
    strengthNote: 'Strong term pricing for Preferred+ clients',
  },
  {
    carrier: 'Nationwide',
    product: 'Nationwide YourLife CareMatters',
    type: 'iul',
    minFaceAmount: 50000,
    maxFaceAmount: 5000000,
    availableRiders: ['LTC rider', 'WOP', 'GDB'],
    strengthNote: 'IUL with LTC hybrid rider — Swiss Army option',
  },
  {
    carrier: 'Pacific Life',
    product: 'Pacific Discovery Protector Plus',
    type: 'ul',
    minFaceAmount: 100000,
    maxFaceAmount: 10000000,
    availableRiders: ['NLG', 'WOP', 'ADB'],
    strengthNote: 'No-lapse guarantee UL for estate permanence',
  },
  {
    carrier: 'Protective',
    product: 'Protective Classic Choice Term',
    type: 'term',
    minFaceAmount: 100000,
    maxFaceAmount: 2000000,
    availableRiders: ['WOP', 'CI', 'ADB'],
    strengthNote: 'Very competitive 20/30-year term pricing',
  },
  {
    carrier: 'Transamerica',
    product: 'Trendsetter Super',
    type: 'term',
    minFaceAmount: 25000,
    maxFaceAmount: 10000000,
    availableRiders: ['WOP', 'CI', 'ADB', 'Children'],
    strengthNote: 'High face amounts available for income replacement',
  },
  {
    carrier: 'CoF',
    product: 'Value 4 Life',
    type: 'whole-life',
    minFaceAmount: 5000,
    maxFaceAmount: 250000,
    availableRiders: ['WOP', 'Paid-up additions'],
    strengthNote: 'Final expense focus — simplified issue, no paramed',
  },
]

export function lookupLifeCarrierProduct(query?: { carrier?: string; type?: string }): LifeCarrierProduct[] {
  if (!query) return LIFE_CARRIER_PRODUCTS
  return LIFE_CARRIER_PRODUCTS.filter(p => {
    const carrierMatch = !query.carrier || p.carrier.toLowerCase().includes(query.carrier.toLowerCase())
    const typeMatch = !query.type || p.type === query.type
    return carrierMatch && typeMatch
  })
}

export function lookupLifeCarrierProductResult(query?: { carrier?: string; type?: string }): CalcResult<LifeCarrierProduct[]> {
  return { value: lookupLifeCarrierProduct(query) }
}
