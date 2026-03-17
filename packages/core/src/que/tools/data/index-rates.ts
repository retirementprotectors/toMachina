/**
 * FIA Index Reference Data
 * Source: Index + MVA Calcs sheet from *CaseWork- Components
 *
 * 17 indexes across multiple carriers.
 * Methods: Annual Point-to-Point, Monthly Averaging, Trigger, Monthly Sum
 * Factors: Cap, Participation Rate, Spread, Fee
 */

import type { IndexRate } from '../types'

export const INDEX_RATES: IndexRate[] = [
  // --- Ameritas ---
  {
    indexName: 'S&P 500',
    carrier: 'Ameritas',
    product: 'Ameritas Life Accumulator',
    method: 'Annual Point-to-Point',
    cap: 9.85,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },
  {
    indexName: 'PIMCO Tactical Balanced ER Index',
    carrier: 'Ameritas',
    product: 'Ameritas Life Accumulator',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 165,
    spread: 0,
    fee: 0.50,
  },

  // --- Corebridge ---
  {
    indexName: 'S&P 500',
    carrier: 'Corebridge',
    product: 'Corebridge Index Annuity',
    method: 'Annual Point-to-Point',
    cap: 8.50,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },
  {
    indexName: 'Barclays Trailblazer Sector 5 Index',
    carrier: 'Corebridge',
    product: 'Corebridge Index Annuity',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 140,
    spread: 0,
    fee: 0.50,
  },

  // --- Delaware Life ---
  {
    indexName: 'Goldman Sachs TimeX Index',
    carrier: 'Delaware Life',
    product: 'Delaware Life Retirement Achiever',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 170,
    spread: 0,
    fee: 1.25,
  },
  {
    indexName: 'S&P 500',
    carrier: 'Delaware Life',
    product: 'Delaware Life Retirement Achiever',
    method: 'Monthly Averaging',
    cap: 3.00,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },

  // --- F&G ---
  {
    indexName: 'S&P 500',
    carrier: 'F&G',
    product: 'F&G Safe Income Plus',
    method: 'Annual Point-to-Point',
    cap: 7.50,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },
  {
    indexName: 'Bloomberg US Dynamic Balance II ER Index',
    carrier: 'F&G',
    product: 'F&G Safe Income Plus',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 145,
    spread: 0,
    fee: 0.50,
  },
  {
    indexName: 'Fidelity AIM Dividend Index',
    carrier: 'F&G',
    product: 'F&G Accumulator Plus',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 350,
    spread: 5.00,
    fee: 0,
  },
  {
    indexName: 'S&P 500',
    carrier: 'F&G',
    product: 'F&G Accumulator Plus',
    method: 'Monthly Sum Cap',
    cap: 2.50,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },
  {
    indexName: 'Barclays Atlas 5 Index',
    carrier: 'F&G',
    product: 'F&G Performance Pro',
    method: 'Trigger',
    cap: 0,
    participationRate: 100,
    spread: 0,
    fee: 0.25,
  },

  // --- North American ---
  {
    indexName: 'S&P 500',
    carrier: 'North American',
    product: 'NAC BenefitSolutions',
    method: 'Annual Point-to-Point',
    cap: 6.50,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },
  {
    indexName: 'PIMCO Global Optima ER Index',
    carrier: 'North American',
    product: 'NAC BenefitSolutions',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 115,
    spread: 0,
    fee: 0.50,
  },
  {
    indexName: 'Goldman Sachs Momentum Builder Index',
    carrier: 'North American',
    product: 'NAC BenefitSolutions',
    method: 'Trigger',
    cap: 0,
    participationRate: 100,
    spread: 0,
    fee: 0.75,
  },
  {
    indexName: 'S&P 500',
    carrier: 'North American',
    product: 'NAC Guarantee Choice',
    method: 'Annual Point-to-Point',
    cap: 7.00,
    participationRate: 100,
    spread: 0,
    fee: 0,
  },
  {
    indexName: 'PIMCO Tactical Balanced ER Index',
    carrier: 'North American',
    product: 'NAC Guarantee Choice',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 130,
    spread: 0,
    fee: 0.50,
  },
  {
    indexName: 'BNP Paribas Multi-Asset Diversified 5 Index',
    carrier: 'North American',
    product: 'NAC Guarantee Choice',
    method: 'Annual Point-to-Point',
    cap: 0,
    participationRate: 10,
    spread: 0,
    fee: 0.25,
  },
]

/**
 * Lookup index rates by index name, carrier, or product.
 * Case-insensitive partial matching.
 */
export function findIndexRates(query: { indexName?: string; carrier?: string; product?: string }): IndexRate[] {
  return INDEX_RATES.filter((r) => {
    if (query.indexName && !r.indexName.toLowerCase().includes(query.indexName.toLowerCase())) return false
    if (query.carrier && !r.carrier.toLowerCase().includes(query.carrier.toLowerCase())) return false
    if (query.product && !r.product.toLowerCase().includes(query.product.toLowerCase())) return false
    return true
  })
}
