/**
 * calc-household-aggregate
 * Combined household financials across all members.
 *
 * Formula: Sum across all members: income, investable assets, net worth, account count
 * Source: Householding model
 */

import type { CalcResult, HouseholdMember, CalcHouseholdAggregateResult } from './types'

export function calcHouseholdAggregate(members: HouseholdMember[]): CalcResult<CalcHouseholdAggregateResult> {
  const totalIncome = Math.round(members.reduce((sum, m) => sum + m.annualIncome, 0) * 100) / 100
  const totalInvestable = Math.round(members.reduce((sum, m) => sum + m.investableAssets, 0) * 100) / 100
  const totalNetWorth = Math.round(members.reduce((sum, m) => sum + m.totalNetWorth, 0) * 100) / 100
  const totalAccounts = members.reduce((sum, m) => sum + m.accountCount, 0)
  const memberCount = members.length

  return {
    value: { totalIncome, totalInvestable, totalNetWorth, totalAccounts, memberCount },
    breakdown: { totalIncome, totalInvestable, totalNetWorth, totalAccounts, memberCount },
  }
}
