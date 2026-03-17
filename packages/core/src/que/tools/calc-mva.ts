/**
 * calc-mva
 * Market Value Adjustment reverse-engineering calculator.
 *
 * Formula: Total Penalty% = (AV - SV) / AV x 100
 *          Free Withdrawal = AV x Free% (default 10%)
 *          Surrender Charge = AV x SC% (if known)
 *          Hidden MVA = Total Penalty - Free Withdrawal - Surrender Charge
 * Source: MVA Calculator
 *
 * Decomposes the gap between AV and SV into its components.
 */

import type { CalcResult, CalcMvaInput, CalcMvaResult } from './types'

export function calcMva(input: CalcMvaInput): CalcResult<CalcMvaResult> {
  const {
    accountValue,
    surrenderValue,
    freeWithdrawalPercent = 0.10,
    surrenderChargePercent,
  } = input

  const totalPenaltyDollar = Math.round((accountValue - surrenderValue) * 100) / 100
  const totalPenaltyPercent = accountValue > 0
    ? Math.round((totalPenaltyDollar / accountValue) * 10000) / 100
    : 0

  const freeWithdrawal = Math.round(accountValue * freeWithdrawalPercent * 100) / 100
  const surrenderChargeDollar = surrenderChargePercent !== undefined
    ? Math.round(accountValue * surrenderChargePercent * 100) / 100
    : 0

  // Hidden MVA = whatever is left after known components
  const hiddenMvaDollar = Math.max(
    0,
    Math.round((totalPenaltyDollar - freeWithdrawal - surrenderChargeDollar) * 100) / 100
  )
  const hiddenMvaPercent = accountValue > 0
    ? Math.round((hiddenMvaDollar / accountValue) * 10000) / 100
    : 0

  const notes: string[] = []
  if (hiddenMvaDollar > 0) {
    notes.push(`Hidden MVA detected: $${hiddenMvaDollar.toLocaleString()} (${hiddenMvaPercent}% of AV)`)
  }
  if (surrenderChargePercent === undefined) {
    notes.push('Surrender charge % not provided; full gap attributed to MVA after free withdrawal')
  }

  return {
    value: {
      totalPenaltyPercent,
      totalPenaltyDollar,
      freeWithdrawal,
      surrenderChargeDollar,
      hiddenMvaDollar,
      hiddenMvaPercent,
    },
    breakdown: {
      accountValue,
      surrenderValue,
      totalPenaltyDollar,
      freeWithdrawal,
      surrenderChargeDollar,
      hiddenMvaDollar,
    },
    notes: notes.length > 0 ? notes : undefined,
  }
}
