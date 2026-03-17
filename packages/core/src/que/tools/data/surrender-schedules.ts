/**
 * Surrender Charge Schedules by Carrier/Product
 * Source: MVA Calculator data from *CaseWork- Components
 *
 * Each schedule is an array of charge percentages by policy year.
 * Year 1 = index 0, etc.
 */

import type { SurrenderSchedule } from '../types'

export const SURRENDER_SCHEDULES: SurrenderSchedule[] = [
  {
    carrier: 'North American',
    product: 'NAC BenefitSolutions',
    schedule: [
      { year: 1, chargePercent: 0.10 },
      { year: 2, chargePercent: 0.10 },
      { year: 3, chargePercent: 0.09 },
      { year: 4, chargePercent: 0.09 },
      { year: 5, chargePercent: 0.08 },
      { year: 6, chargePercent: 0.08 },
      { year: 7, chargePercent: 0.07 },
      { year: 8, chargePercent: 0.06 },
      { year: 9, chargePercent: 0.04 },
      { year: 10, chargePercent: 0.02 },
      { year: 11, chargePercent: 0.00 },
    ],
  },
  {
    carrier: 'F&G',
    product: 'F&G Safe Income Plus',
    schedule: [
      { year: 1, chargePercent: 0.09 },
      { year: 2, chargePercent: 0.09 },
      { year: 3, chargePercent: 0.08 },
      { year: 4, chargePercent: 0.08 },
      { year: 5, chargePercent: 0.07 },
      { year: 6, chargePercent: 0.07 },
      { year: 7, chargePercent: 0.06 },
      { year: 8, chargePercent: 0.05 },
      { year: 9, chargePercent: 0.03 },
      { year: 10, chargePercent: 0.00 },
    ],
  },
  {
    carrier: 'F&G',
    product: 'F&G Accumulator Plus',
    schedule: [
      { year: 1, chargePercent: 0.08 },
      { year: 2, chargePercent: 0.07 },
      { year: 3, chargePercent: 0.06 },
      { year: 4, chargePercent: 0.05 },
      { year: 5, chargePercent: 0.04 },
      { year: 6, chargePercent: 0.03 },
      { year: 7, chargePercent: 0.00 },
    ],
  },
  {
    carrier: 'Delaware Life',
    product: 'Delaware Life Retirement Achiever',
    schedule: [
      { year: 1, chargePercent: 0.10 },
      { year: 2, chargePercent: 0.10 },
      { year: 3, chargePercent: 0.09 },
      { year: 4, chargePercent: 0.09 },
      { year: 5, chargePercent: 0.08 },
      { year: 6, chargePercent: 0.07 },
      { year: 7, chargePercent: 0.06 },
      { year: 8, chargePercent: 0.05 },
      { year: 9, chargePercent: 0.03 },
      { year: 10, chargePercent: 0.00 },
    ],
  },
  {
    carrier: 'Corebridge',
    product: 'Corebridge Index Annuity',
    schedule: [
      { year: 1, chargePercent: 0.08 },
      { year: 2, chargePercent: 0.07 },
      { year: 3, chargePercent: 0.06 },
      { year: 4, chargePercent: 0.05 },
      { year: 5, chargePercent: 0.04 },
      { year: 6, chargePercent: 0.03 },
      { year: 7, chargePercent: 0.00 },
    ],
  },
  {
    carrier: 'Ameritas',
    product: 'Ameritas Life Accumulator',
    schedule: [
      { year: 1, chargePercent: 0.10 },
      { year: 2, chargePercent: 0.09 },
      { year: 3, chargePercent: 0.08 },
      { year: 4, chargePercent: 0.07 },
      { year: 5, chargePercent: 0.06 },
      { year: 6, chargePercent: 0.05 },
      { year: 7, chargePercent: 0.04 },
      { year: 8, chargePercent: 0.03 },
      { year: 9, chargePercent: 0.02 },
      { year: 10, chargePercent: 0.00 },
    ],
  },
]

/**
 * Lookup surrender schedule by carrier and product.
 * Case-insensitive partial matching.
 */
export function findSurrenderSchedule(carrier: string, product?: string): SurrenderSchedule | undefined {
  const c = carrier.toLowerCase()
  return SURRENDER_SCHEDULES.find((s) => {
    if (!s.carrier.toLowerCase().includes(c)) return false
    if (product && !s.product.toLowerCase().includes(product.toLowerCase())) return false
    return true
  })
}
