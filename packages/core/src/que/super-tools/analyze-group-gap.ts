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

  for (const member of household.members) {
    const groupAccounts = member.accounts.filter(a => a.type === 'life')
    const individualAccounts = member.accounts.filter(a => a.type === 'life')

    const memberGroupCoverage = groupAccounts.reduce((s, a) => s + (a.accountValue || 0), 0)
    const memberIndividualCoverage = individualAccounts.reduce((s, a) => s + (a.accountValue || 0), 0)

    totalGroupCoverage += memberGroupCoverage
    totalIndividualCoverage += memberIndividualCoverage

    // Check portability
    const portRule = lookupGroupPortability('employer-basic')
    toolsUsed.push('lookup-group-portability')

    if (portRule && memberGroupCoverage > 0) {
      findings.push(`${member.name}: $${memberGroupCoverage.toLocaleString()} group coverage — portable up to $${portRule.maxPortableAmount.toLocaleString()} within ${portRule.portabilityWindow} days of separation. Rate multiplier: ${portRule.rateMultiplier}x.`)
      if (memberGroupCoverage > portRule.maxPortableAmount) {
        warnings.push(`${member.name}: $${(memberGroupCoverage - portRule.maxPortableAmount).toLocaleString()} evaporates on job change — exceeds portability cap.`)
      }
    }
  }

  // Existing coverage offset
  const offset = calcExistingCoverageOffset({
    groupLife: totalGroupCoverage,
    individualPolicies: totalIndividualCoverage,
  })
  toolsUsed.push('calc-existing-coverage-offset')

  // Preliminary life need (simplified — income * 10 heuristic)
  const totalIncome = household.members.reduce((s, m) => s + m.annualIncome, 0)
  const preliminaryNeed = calcTotalLifeNeed({
    incomeNeed: totalIncome * 10,
    existingCoverageOffset: offset.value.totalOffset,
  })
  toolsUsed.push('calc-total-life-need')

  const gapExists = preliminaryNeed.value.netNeed > 0
  const groupPct = offset.value.totalOffset > 0 ? Math.round(totalGroupCoverage / offset.value.totalOffset * 100) : 0

  if (gapExists) {
    findings.push(`Coverage gap: $${preliminaryNeed.value.netNeed.toLocaleString()} — current coverage is ${Math.round(offset.value.totalOffset / totalIncome)}x income, recommended 10x+.`)
  }

  if (groupPct > 50) {
    warnings.push(`${groupPct}% of total coverage is employer-dependent — high evaporation risk.`)
  }

  return {
    success: true,
    result: {
      type: 'life_discovery',
      applicable: totalGroupCoverage > 0 || gapExists,
      summary: `Group coverage: $${totalGroupCoverage.toLocaleString()} | Individual: $${totalIndividualCoverage.toLocaleString()} | Gap: $${preliminaryNeed.value.netNeed.toLocaleString()}`,
      findings,
      recommendation: gapExists
        ? `Coverage gap of $${preliminaryNeed.value.netNeed.toLocaleString()} identified. Full needs analysis recommended.`
        : 'Coverage appears adequate at preliminary level. Full needs analysis recommended to confirm.',
      metrics: {
        totalGroupCoverage,
        totalIndividualCoverage,
        totalOffset: offset.value.totalOffset,
        preliminaryNeed: preliminaryNeed.value.grossNeed,
        coverageGap: preliminaryNeed.value.netNeed,
        groupDependencyPct: groupPct,
      },
      details: { members: household.members.map(m => m.name) },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
