/**
 * calc-surrender-charge
 * Cost to exit an existing annuity product.
 *
 * Formula: Gross Charge = AV x Charge%
 *          Free Withdrawal = AV x Free% (default 10%)
 *          Net Charge = Gross Charge - Free Withdrawal (min 0)
 *          Net Surrender Value = AV - Net Charge
 * Source: Consolidation templates
 */

import type { CalcResult, CalcSurrenderChargeInput, CalcSurrenderChargeResult } from './types'

export function calcSurrenderCharge(input: CalcSurrenderChargeInput): CalcResult<CalcSurrenderChargeResult> {
  const { accountValue, chargePercent, freeWithdrawalPercent = 0.10 } = input

  const grossCharge = Math.round(accountValue * chargePercent * 100) / 100
  const freeWithdrawal = Math.round(accountValue * freeWithdrawalPercent * 100) / 100
  const netCharge = Math.max(0, Math.round((grossCharge - freeWithdrawal) * 100) / 100)
  const netSurrenderValue = Math.round((accountValue - netCharge) * 100) / 100

  return {
    value: { grossCharge, freeWithdrawal, netCharge, netSurrenderValue },
    breakdown: { accountValue, chargePercent, freeWithdrawalPercent, grossCharge, freeWithdrawal, netCharge },
  }
}
