/**
 * analyze-group-gap — ANALYZE_GROUP_GAP super tool
 * Assesses employer group coverage gap and portability risk
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { lookupGroupPortability } from '../tools/lookup-group-portability'
import { calcExistingCoverageOffset } from '../tools/calc-existing-coverage-offset'
import { calcTotalLifeNeed } from '../tools/calc-total-life-need'

export function analyzeGroupGap(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  let totalGroupCoverage = 0
  let totalIndividualCoverage = 0

  // BUG 1 FIX: Differentiate group vs individual by checking for cashValue/annualPremium.
  // Group policies: type='life', no cashValue, no annualPremium (employer-paid).
  // Individual policies: type='life', has cashValue or annualPremium.
  const memberGaps: Array<{
    member: string; age: number; groupCoverage: number; portableAmount: number
    evaporatingAmount: number; totalNeed: number; netGap: number
    portabilityDeadlineDays: number; isPortable: boolean
  }> = []

  for (const member of household.members) {
    const groupAccounts = member.accounts.filter(a => a.type === 'life' && !a.cashValue && !a.annualPremium)
    const individualAccounts = member.accounts.filter(a => a.type === 'life' && (a.cashValue != null || a.annualPremium != null))

    const memberGroupCoverage = groupAccounts.reduce((s, a) => s + (a.deathBenefit || a.accountValue || 0), 0)
    const memberIndividualCoverage = individualAccounts.reduce((s, a) => s + (a.deathBenefit || a.accountValue || 0), 0)

    totalGroupCoverage += memberGroupCoverage
    totalIndividualCoverage += memberIndividualCoverage

    const portRule = lookupGroupPortability('employer-basic')
    toolsUsed.push('lookup-group-portability')

    const portableAmount = portRule ? Math.min(memberGroupCoverage, portRule.maxPortableAmount) : 0
    const evaporatingAmount = memberGroupCoverage - portableAmount
    const portabilityDeadlineDays = portRule?.portabilityWindow ?? 0

    // Preliminary need: 10x income
    const memberNeed = member.annualIncome * 10
    const memberOffset = memberGroupCoverage + memberIndividualCoverage
    const netGap = Math.max(0, memberNeed - memberOffset)

    memberGaps.push({
      member: member.name,
      age: member.age,
      groupCoverage: memberGroupCoverage,
      portableAmount,
      evaporatingAmount,
      totalNeed: memberNeed,
      netGap,
      portabilityDeadlineDays,
      isPortable: portableAmount > 0,
    })

    if (memberGroupCoverage > 0) {
      findings.push(`${member.name}: $${memberGroupCoverage.toLocaleString()} group coverage — $${portableAmount.toLocaleString()} portable, $${evaporatingAmount.toLocaleString()} evaporates on separation.`)
    }
    if (evaporatingAmount > 0) {
      warnings.push(`${member.name}: $${evaporatingAmount.toLocaleString()} coverage lost on job change.`)
    }
  }

  const offset = calcExistingCoverageOffset({ groupLife: totalGroupCoverage, individualPolicies: totalIndividualCoverage })
  toolsUsed.push('calc-existing-coverage-offset')

  const totalIncome = household.members.reduce((s, m) => s + m.annualIncome, 0)
  const preliminaryNeed = calcTotalLifeNeed({ incomeNeed: totalIncome * 10, existingCoverageOffset: offset.value.totalOffset })
  toolsUsed.push('calc-total-life-need')

  const gapExists = preliminaryNeed.value.netNeed > 0
  const groupPct = offset.value.totalOffset > 0 ? Math.round(totalGroupCoverage / offset.value.totalOffset * 100) : 0

  if (groupPct > 50) warnings.push(`${groupPct}% of total coverage is employer-dependent — high evaporation risk.`)

  return {
    success: true,
    result: {
      type: 'life_discovery',
      applicable: totalGroupCoverage > 0 || gapExists,
      summary: `Group: $${totalGroupCoverage.toLocaleString()} | Individual: $${totalIndividualCoverage.toLocaleString()} | Gap: $${preliminaryNeed.value.netNeed.toLocaleString()}`,
      findings,
      recommendation: gapExists ? `Coverage gap of $${preliminaryNeed.value.netNeed.toLocaleString()} identified. Full needs analysis recommended.` : 'Coverage appears adequate. Full needs analysis recommended to confirm.',
      metrics: { totalGroupCoverage, totalIndividualCoverage, totalOffset: offset.value.totalOffset, preliminaryNeed: preliminaryNeed.value.grossNeed, coverageGap: preliminaryNeed.value.netNeed, groupDependencyPct: groupPct, totalEvaporating: totalGroupCoverage, totalNetGap: preliminaryNeed.value.netNeed, membersWithGap: memberGaps.filter((g: { netGap?: number }) => (g.netGap ?? 0) > 0).length },
      details: { memberGaps },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
