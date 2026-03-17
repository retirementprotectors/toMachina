/**
 * calc-net-outlay
 * True cost of life insurance after cash value.
 *
 * Formula: Net Outlay = Premium Outlay - Cash Value
 * Source: FE v TERM v IUL sheet
 *
 * If Cash Value > Premium Outlay, the policy has been a net gain.
 */

import type { CalcResult, CalcNetOutlayInput, CalcNetOutlayResult } from './types'

export function calcNetOutlay(input: CalcNetOutlayInput): CalcResult<CalcNetOutlayResult> {
  const { premiumOutlay, cashValue } = input

  const netOutlay = Math.round((premiumOutlay - cashValue) * 100) / 100
  const isNetGain = netOutlay < 0

  return {
    value: { netOutlay, isNetGain },
    breakdown: { premiumOutlay, cashValue, netOutlay },
  }
}
