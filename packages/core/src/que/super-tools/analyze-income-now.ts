/**
 * ANALYZE_INCOME_NOW — Super Tool (TRK-13383)
 *
 * Analyzes household for immediate income activation opportunities.
 * Detects dormant income riders and calculates breakeven equity.
 *
 * Calc tools used:
 *   1. calc-household-aggregate → Combined income, expenses, disposable
 *   2. calc-gmib               → Current GMIB payouts across all FIAs
 *   3. calc-rmd                → RMD requirements for IRA accounts
 *   4. calc-breakeven-equity   → Can portfolio sustain current withdrawals?
 *
 * Output: Income gap/surplus, BEP metric, recommended activation
 */

import type { SuperToolHousehold, SuperToolOutput, SuperToolAccount } from './types'
import { calcHouseholdAggregate } from '../tools/calc-household-aggregate'
import { calcGmib } from '../tools/calc-gmib'
import { calcRmd } from '../tools/calc-rmd'
import { calcBreakevenEquity } from '../tools/calc-breakeven-equity'
import type { HouseholdMember } from '../tools/types'

export function analyzeIncomeNow(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  // 1. Aggregate household financials
  const members: HouseholdMember[] = household.members.map((m) => ({
    name: m.name,
    annualIncome: m.annualIncome,
    investableAssets: m.investableAssets,
    totalNetWorth: m.totalNetWorth,
    accountCount: m.accounts.length,
  }))
  const aggResult = calcHouseholdAggregate(members)
  toolsUsed.push('calc-household-aggregate')

  const agg = aggResult.value

  // 2. Find all accounts with dormant income riders (GMIB/GLWB)
  const allAccounts = household.members.flatMap((m) => m.accounts)
  const dormantRiders = allAccounts.filter(
    (a) => a.benefitBase && a.payoutRate && !a.riderActivated
  )
  const activeRiders = allAccounts.filter(
    (a) => a.benefitBase && a.payoutRate && a.riderActivated
  )

  // Calculate GMIB income for dormant riders
  let totalDormantIncome = 0
  const dormantDetails: Array<{ account: string; annualIncome: number; monthlyIncome: number }> = []
  for (const acct of dormantRiders) {
    const gmibResult = calcGmib({ benefitBase: acct.benefitBase!, payoutRate: acct.payoutRate! })
    toolsUsed.push('calc-gmib')
    totalDormantIncome += gmibResult.value.annualIncome
    dormantDetails.push({
      account: `${acct.carrier} ${acct.product} (${acct.id})`,
      annualIncome: gmibResult.value.annualIncome,
      monthlyIncome: gmibResult.value.monthlyIncome,
    })
  }

  // Calculate GMIB income for active riders
  let totalActiveIncome = 0
  for (const acct of activeRiders) {
    const gmibResult = calcGmib({ benefitBase: acct.benefitBase!, payoutRate: acct.payoutRate! })
    totalActiveIncome += gmibResult.value.annualIncome
  }

  if (dormantRiders.length > 0) {
    findings.push(
      `${dormantRiders.length} dormant income rider(s) detected with $${Math.round(totalDormantIncome).toLocaleString()}/year in available guaranteed income`
    )
  }

  // 3. RMD requirements for IRA accounts
  const iraAccounts = allAccounts.filter((a) => a.taxStatus === 'ira')
  let totalRmd = 0
  const rmdDetails: Array<{ account: string; rmd: number; factor: number }> = []
  for (const member of household.members) {
    if (member.age >= 72) {
      const memberIras = member.accounts.filter((a) => a.taxStatus === 'ira')
      for (const acct of memberIras) {
        const rmdResult = calcRmd({ age: member.age, priorYearValue: acct.accountValue })
        toolsUsed.push('calc-rmd')
        totalRmd += rmdResult.value.rmd
        rmdDetails.push({
          account: `${acct.carrier} ${acct.product} (${acct.id})`,
          rmd: rmdResult.value.rmd,
          factor: rmdResult.value.factor,
        })
      }
    }
  }

  if (totalRmd > 0) {
    findings.push(`Total RMD requirement: $${Math.round(totalRmd).toLocaleString()}/year`)
  }

  // 4. Breakeven equity analysis on advisory/VA accounts
  const withdrawalAccounts = allAccounts.filter(
    (a) => a.annualWithdrawal && a.annualWithdrawal > 0 && a.accountValue > 0
  )
  let worstBep = 0
  const bepDetails: Array<{ account: string; breakevenPercent: number; isUnsustainable: boolean }> = []
  for (const acct of withdrawalAccounts) {
    const bepResult = calcBreakevenEquity({
      annualWithdrawals: acct.annualWithdrawal!,
      annualFees: acct.accountValue * (acct.totalFeeRate ?? 0),
      annualIncome: 0,
      portfolioValue: acct.accountValue,
    })
    toolsUsed.push('calc-breakeven-equity')
    if (bepResult.value.breakevenPercent > worstBep) {
      worstBep = bepResult.value.breakevenPercent
    }
    bepDetails.push({
      account: `${acct.carrier} ${acct.product} (${acct.id})`,
      breakevenPercent: bepResult.value.breakevenPercent,
      isUnsustainable: bepResult.value.isUnsustainable,
    })
    if (bepResult.value.isUnsustainable) {
      warnings.push(
        `${acct.carrier} ${acct.product}: BEP of ${bepResult.value.breakevenPercent}% is unsustainable (>7%)`
      )
    }
  }

  if (worstBep > 0) {
    findings.push(`Worst breakeven equity requirement: ${worstBep}%`)
  }

  // Determine applicability
  const applicable = dormantRiders.length > 0 || warnings.length > 0
  const incomeGap = agg.totalIncome - totalDormantIncome - totalActiveIncome

  let summary: string
  let recommendation: string

  if (dormantRiders.length > 0) {
    summary = `${dormantRiders.length} dormant income rider(s) could add $${Math.round(totalDormantIncome).toLocaleString()}/year in guaranteed income.`
    recommendation = worstBep > 7
      ? 'Activate dormant income riders immediately to reduce portfolio withdrawal pressure and lower breakeven equity requirement.'
      : 'Dormant income riders represent untapped guaranteed income. Activation would improve income floor stability.'
  } else {
    summary = 'No dormant income riders detected in the household portfolio.'
    recommendation = 'No immediate income activation opportunities. Review income LATER for deferral strategies.'
  }

  return {
    success: true,
    result: {
      type: 'income_now',
      applicable,
      summary,
      findings,
      recommendation,
      metrics: {
        totalHouseholdIncome: agg.totalIncome,
        totalDormantIncome,
        totalActiveIncome,
        totalRmd,
        worstBreakevenPercent: worstBep,
        dormantRiderCount: dormantRiders.length,
        incomeGap,
      },
      details: {
        dormantDetails,
        rmdDetails,
        bepDetails,
        aggregate: agg,
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
