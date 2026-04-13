/** calc-total-life-need — Master life insurance need */
import type { CalcResult, CalcTotalLifeNeedInput, CalcTotalLifeNeedResult } from './types'

export function calcTotalLifeNeed(input: CalcTotalLifeNeedInput): CalcResult<CalcTotalLifeNeedResult> {
  const { incomeNeed = 0, debtNeed = 0, collegeFundingNeed = 0, miscCashNeed = 0, survivorCashNeed = 0, survivorIncomeNeed = 0, existingCoverageOffset = 0 } = input
  const grossNeed = incomeNeed + debtNeed + collegeFundingNeed + miscCashNeed + survivorCashNeed + survivorIncomeNeed
  const netNeed = Math.max(0, grossNeed - existingCoverageOffset)
  const coverageGap = netNeed
  return {
    value: { grossNeed, netNeed, coverageGap },
    breakdown: { incomeNeed, debtNeed, collegeFundingNeed, miscCashNeed, survivorCashNeed, survivorIncomeNeed, existingCoverageOffset, grossNeed, netNeed },
  }
}
