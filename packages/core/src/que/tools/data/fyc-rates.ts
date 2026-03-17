/**
 * First Year Commission (FYC) Rates by Carrier
 * Source: UL Case Matrix from *CaseWork- Components
 *
 * Target% = FYC on target premium
 * Excess% = FYC on premium above target
 * 14 carriers from discovery doc
 */

import type { FycRate } from '../types'

export const FYC_RATES: FycRate[] = [
  { carrier: 'Catholic Order of Foresters', carrierCode: 'CoF', targetPercent: 0.800, excessPercent: 0.100, preferred: true },
  { carrier: 'John Hancock', carrierCode: 'JH', targetPercent: 0.950, excessPercent: 0.015, preferred: true },
  { carrier: 'Mutual of Omaha', carrierCode: 'MOO', targetPercent: 0.950, excessPercent: 0.020, preferred: true },
  { carrier: 'AIG', carrierCode: 'AIG', targetPercent: 1.048, excessPercent: 0.025 },
  { carrier: 'Allianz Life', carrierCode: 'ALIC', targetPercent: 1.198, excessPercent: 0.0375 },
  { carrier: 'F&G', carrierCode: 'F&G', targetPercent: 1.248, excessPercent: 0.030 },
  { carrier: 'Kansas City Life', carrierCode: 'KCL', targetPercent: 1.200, excessPercent: 0.030 },
  { carrier: 'Lincoln Financial', carrierCode: 'LFG', targetPercent: 1.098, excessPercent: 0.050 },
  { carrier: 'North American', carrierCode: 'NAC', targetPercent: 1.098, excessPercent: 0.045 },
  { carrier: 'Nationwide', carrierCode: 'NWF', targetPercent: 1.098, excessPercent: 0.030 },
  { carrier: 'Protective', carrierCode: 'PRO', targetPercent: 1.098, excessPercent: 0.040 },
  { carrier: 'Symetra', carrierCode: 'SYM', targetPercent: 1.198, excessPercent: 0.050 },
]

/**
 * Lookup FYC rate by carrier code or full name.
 * Case-insensitive matching.
 */
export function findFycRate(carrierKey: string): FycRate | undefined {
  const key = carrierKey.toLowerCase()
  return FYC_RATES.find(
    (r) => r.carrierCode.toLowerCase() === key || r.carrier.toLowerCase().includes(key)
  )
}
