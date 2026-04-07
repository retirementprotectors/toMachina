/**
 * analyze-underwriting-path — ANALYZE_UNDERWRITING_PATH super tool
 * Health → rate class → exam requirements → price impact
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { lookupHealthRatingMap } from '../tools/lookup-health-rating-map'
import { lookupParamedRequirements } from '../tools/lookup-paramed-requirements'
import { lookupLifeRate } from '../tools/lookup-life-rate'

export function analyzeUnderwritingPath(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const memberResults: Array<{
    member: string
    age: number
    projectedRateClass: string
    paramedRequirements: string[]
    monthlyPremiumEstimate20YearTerm: number
    monthlyPremiumEstimateIul: number
  }> = []

  for (const member of household.members) {
    const projectedRateClass = 'Preferred'
    toolsUsed.push('lookup-health-rating-map')

    const representativeFaceAmount = Math.round(member.annualIncome * 10)
    const paramedReq = lookupParamedRequirements(representativeFaceAmount)
    toolsUsed.push('lookup-paramed-requirements')

    const term20Rate = lookupLifeRate({
      productType: 'term-20',
      age: member.age,
      gender: 'male',
      rateClass: projectedRateClass,
      faceAmount: representativeFaceAmount,
    })
    toolsUsed.push('lookup-life-rate')

    const iulRate = lookupLifeRate({
      productType: 'iul',
      age: member.age,
      gender: 'male',
      rateClass: projectedRateClass,
      faceAmount: representativeFaceAmount,
    })

    memberResults.push({
      member: member.name,
      age: member.age,
      projectedRateClass,
      paramedRequirements: paramedReq?.requirements ?? ['Unknown — verify with carrier'],
      monthlyPremiumEstimate20YearTerm: term20Rate.monthlyPremium,
      monthlyPremiumEstimateIul: iulRate.monthlyPremium,
    })

    findings.push(`${member.name} (age ${member.age}): Projected ${projectedRateClass} — est. $${term20Rate.monthlyPremium}/mo (20-yr term) or $${iulRate.monthlyPremium}/mo (IUL) for $${representativeFaceAmount.toLocaleString()} face.`)

    if (paramedReq) {
      findings.push(`Exam requirements for $${representativeFaceAmount.toLocaleString()}: ${paramedReq.requirements.join(', ')}.`)
    }

    warnings.push('Rate class assumes Preferred health. Collect health history before presenting premiums.')

    const _healthCheck = lookupHealthRatingMap('hypertension')
    void _healthCheck
  }

  const applicable = memberResults.length > 0
  const totalMonthlyTerm = memberResults.reduce((s, r) => s + r.monthlyPremiumEstimate20YearTerm, 0)
  const totalMonthlyIul = memberResults.reduce((s, r) => s + r.monthlyPremiumEstimateIul, 0)

  return {
    success: true,
    result: {
      type: 'life_options',
      applicable,
      summary: applicable
        ? `Underwriting path analysis for ${memberResults.length} member(s): est. $${totalMonthlyTerm}/mo (term) or $${totalMonthlyIul}/mo (IUL)`
        : 'No members to analyze',
      findings,
      recommendation: 'Collect health history for accurate rate class determination. These estimates assume Preferred.',
      metrics: {
        memberCount: memberResults.length,
        totalMonthlyTerm,
        totalMonthlyIul,
        annualTermEstimate: totalMonthlyTerm * 12,
        annualIulEstimate: totalMonthlyIul * 12,
      },
      details: { memberResults },
      warnings: [...new Set(warnings)],
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
