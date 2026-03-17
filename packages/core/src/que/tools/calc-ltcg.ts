/**
 * calc-ltcg
 * Long-term capital gains tax calculator.
 *
 * Formula: Gain = Market Value - Cost Basis
 *          Tax = Gain x Tax Rate (default 15%)
 *          Net Proceeds = Market Value - Tax
 * Source: Tax Harvesting templates
 *
 * Note: Stepped-up basis (inherited accounts) => $0 gain.
 */

import type { CalcResult, CalcLtcgInput, CalcLtcgResult } from './types'

export function calcLtcg(input: CalcLtcgInput): CalcResult<CalcLtcgResult> {
  const { marketValue, costBasis, taxRate = 0.15 } = input

  const gain = Math.max(0, Math.round((marketValue - costBasis) * 100) / 100)
  const tax = Math.round(gain * taxRate * 100) / 100
  const netProceeds = Math.round((marketValue - tax) * 100) / 100

  const notes: string[] = []
  if (gain === 0) {
    notes.push('No taxable gain (basis equals or exceeds market value)')
  }

  return {
    value: { gain, tax, netProceeds },
    breakdown: { marketValue, costBasis, gain, taxRate, tax },
    notes: notes.length > 0 ? notes : undefined,
  }
}
