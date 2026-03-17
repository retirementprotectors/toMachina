/**
 * lookup-surrender-schedule
 * Returns the surrender charge schedule for a given carrier/product.
 *
 * Source: MVA Calculator carrier data
 *
 * @param carrier - Carrier name (partial, case-insensitive)
 * @param product - Optional product name for disambiguation
 * @returns Surrender schedule or undefined
 */

import type { SurrenderSchedule } from './types'
import { findSurrenderSchedule } from './data/surrender-schedules'

export function lookupSurrenderSchedule(carrier: string, product?: string): SurrenderSchedule | undefined {
  return findSurrenderSchedule(carrier, product)
}
