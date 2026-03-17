/**
 * Carrier Product Reference Data
 * Source: Index + MVA Calcs sheet, *CaseWork- Components folder
 *
 * 10 carriers with product specs for FIA comparison and casework.
 */

import type { CarrierProduct } from '../types'

export const CARRIER_PRODUCTS: CarrierProduct[] = [
  // --- Ameritas ---
  {
    carrier: 'Ameritas',
    product: 'Ameritas Life Accumulator',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0,
    features: ['Annual Point-to-Point', 'Monthly Averaging', 'No MVA'],
  },
  // --- Corebridge (2 products) ---
  {
    carrier: 'Corebridge',
    product: 'Corebridge Index Annuity',
    type: 'FIA',
    surrenderYears: 7,
    bonus: 0,
    features: ['Annual Point-to-Point', 'Trigger Strategy', 'GMDB'],
  },
  {
    carrier: 'Corebridge',
    product: 'Corebridge Income Plus',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0.05,
    features: ['GLWB', 'Income Rider', 'Annual Point-to-Point'],
  },
  // --- Delaware Life (2 products) ---
  {
    carrier: 'Delaware Life',
    product: 'Delaware Life Retirement Achiever',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0.06,
    features: ['Annual Point-to-Point', 'Monthly Averaging', 'MVA'],
  },
  {
    carrier: 'Delaware Life',
    product: 'Delaware Life Income Achiever',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0.05,
    features: ['GLWB', 'Roll-up', 'Annual Point-to-Point'],
  },
  // --- F&G (3 products) ---
  {
    carrier: 'F&G',
    product: 'F&G Safe Income Plus',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0.07,
    features: ['GLWB', '2x LTC Multiplier', 'Roll-up'],
  },
  {
    carrier: 'F&G',
    product: 'F&G Accumulator Plus',
    type: 'FIA',
    surrenderYears: 7,
    bonus: 0.04,
    features: ['Annual Point-to-Point', 'Monthly Sum Cap', 'MVA'],
  },
  {
    carrier: 'F&G',
    product: 'F&G Performance Pro',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0.06,
    features: ['Annual Point-to-Point', 'Trigger', 'GMDB'],
  },
  // --- North American (2 products) ---
  {
    carrier: 'North American',
    product: 'NAC BenefitSolutions',
    type: 'FIA',
    surrenderYears: 11,
    bonus: 0.07,
    features: ['GLWB', '2x LTC Multiplier', 'Performance Trigger', 'Highest Anniversary Value DB'],
  },
  {
    carrier: 'North American',
    product: 'NAC Guarantee Choice',
    type: 'FIA',
    surrenderYears: 10,
    bonus: 0.05,
    features: ['Guaranteed Growth', 'Annual Point-to-Point', 'MVA'],
  },
]

/**
 * Lookup a carrier product by carrier name and/or product name.
 * Case-insensitive partial matching.
 */
export function findCarrierProducts(query: { carrier?: string; product?: string }): CarrierProduct[] {
  return CARRIER_PRODUCTS.filter((p) => {
    if (query.carrier && !p.carrier.toLowerCase().includes(query.carrier.toLowerCase())) return false
    if (query.product && !p.product.toLowerCase().includes(query.product.toLowerCase())) return false
    return true
  })
}
