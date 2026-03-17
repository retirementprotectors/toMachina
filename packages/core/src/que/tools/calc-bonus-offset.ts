/**
 * calc-bonus-offset
 * Net cost after carrier bonus on consolidation.
 *
 * Formula: Gross Cost = Surrender Cost + LTCG Cost
 *          Bonus Credit = Deposits x Bonus Rate
 *          Net Cost = Gross Cost - Bonus Credit
 *          If Net Cost < 0, client has a NET GAIN (bonus exceeds costs)
 * Source: Consolidation templates
 *
 * Example: Nassau 7% bonus on $200K deposit = $14K credit.
 *          If surrender + LTCG = $10K, net cost = -$4K (client gains $4K).
 */

import type { CalcResult, CalcBonusOffsetInput, CalcBonusOffsetResult } from './types'

export function calcBonusOffset(input: CalcBonusOffsetInput): CalcResult<CalcBonusOffsetResult> {
  const { surrenderCost, ltcgCost, deposits, bonusRate } = input

  const grossCost = Math.round((surrenderCost + ltcgCost) * 100) / 100
  const bonusCredit = Math.round(deposits * bonusRate * 100) / 100
  const netCost = Math.round((grossCost - bonusCredit) * 100) / 100
  const isNetGain = netCost < 0

  const notes: string[] = []
  if (isNetGain) {
    notes.push(`Client nets a gain of $${Math.abs(netCost).toLocaleString()} from the carrier bonus`)
  }

  return {
    value: { grossCost, bonusCredit, netCost, isNetGain },
    breakdown: { surrenderCost, ltcgCost, deposits, bonusRate, grossCost, bonusCredit, netCost },
    notes: notes.length > 0 ? notes : undefined,
  }
}
