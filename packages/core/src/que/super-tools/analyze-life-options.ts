/**
 * analyze-life-options — ANALYZE_LIFE_OPTIONS super tool
 * 3-option comparison: Final Expenses / Income Replacement / Swiss-Army IUL
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcTotalLifeNeed } from '../tools/calc-total-life-need'
import { lookupLifeRate } from '../tools/lookup-life-rate'
import { lookupLifeCarrierProduct } from '../tools/lookup-life-carrier-product'
import { calcNetOutlay } from '../tools/calc-net-outlay'

export function analyzeLifeOptions(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  // BUG 3c FIX: Output memberOptions matching template contract
  const memberOptions: Array<{
    member: string; age: number; totalNeed: number
    optionA: { label: string; faceAmount: number; monthlyPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean }
    optionB: { label: string; faceAmount: number; monthlyPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean }
    optionC: { label: string; faceAmount: number; monthlyPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean; cashValueAt10Years: number }
  }> = []

  for (const member of household.members) {
    const existingCoverage = member.accounts
      .filter(a => a.type === 'life')
      .reduce((s, a) => s + (a.deathBenefit || a.accountValue || 0), 0)

    const needResult = calcTotalLifeNeed({ incomeNeed: member.annualIncome * 10, existingCoverageOffset: existingCoverage })
    toolsUsed.push('calc-total-life-need')

    const targetFace = Math.max(100000, needResult.value.netNeed)
    const roundedFace = Math.ceil(targetFace / 100000) * 100000

    // Option A: Final Expense (Whole Life)
    const feFace = Math.min(50000, roundedFace)
    const feCarrier = lookupLifeCarrierProduct({ carrier: 'MOO', type: 'whole-life' })
    toolsUsed.push('lookup-life-carrier-product')
    const feRate = lookupLifeRate({ productType: 'whole-life', age: member.age, gender: 'male', rateClass: 'Standard', faceAmount: feFace })
    toolsUsed.push('lookup-life-rate')

    // Option B: Income Replacement (20-Year Term)
    const termCarrier = lookupLifeCarrierProduct({ carrier: 'PRO', type: 'term' })
    const termRate = lookupLifeRate({ productType: 'term-20', age: member.age, gender: 'male', rateClass: 'Preferred', faceAmount: roundedFace })
    toolsUsed.push('lookup-life-rate')

    // Option C: Swiss-Army IUL
    const iulFace = Math.round(roundedFace * 0.75)
    const iulCarrier = lookupLifeCarrierProduct({ carrier: 'JH', type: 'iul' })
    const iulRate = lookupLifeRate({ productType: 'iul', age: member.age, gender: 'male', rateClass: 'Preferred', faceAmount: iulFace })
    toolsUsed.push('lookup-life-rate')

    const netOutlay = calcNetOutlay({ premiumOutlay: iulRate.annualPremium * 10, cashValue: iulRate.annualPremium * 10 * 0.6 })
    toolsUsed.push('calc-net-outlay')

    const cashValueAt10Years = Math.round(iulRate.annualPremium * 10 * 0.6)

    memberOptions.push({
      member: member.name,
      age: member.age,
      totalNeed: roundedFace,
      optionA: {
        label: 'Final Expense',
        faceAmount: feFace,
        monthlyPremium: feRate.monthlyPremium,
        termYears: null,
        carrier: feCarrier?.[0]?.carrier || 'Mutual of Omaha',
        product: feCarrier?.[0]?.product || 'Living Promise',
        livingBenefits: false,
      },
      optionB: {
        label: 'Income Replacement',
        faceAmount: roundedFace,
        monthlyPremium: termRate.monthlyPremium,
        termYears: 20,
        carrier: termCarrier?.[0]?.carrier || 'Protective',
        product: termCarrier?.[0]?.product || 'Classic Choice Term',
        livingBenefits: false,
      },
      optionC: {
        label: 'Swiss-Army IUL',
        faceAmount: iulFace,
        monthlyPremium: iulRate.monthlyPremium,
        termYears: null,
        carrier: iulCarrier?.[0]?.carrier || 'John Hancock',
        product: iulCarrier?.[0]?.product || 'Accumulation IUL',
        livingBenefits: true,
        cashValueAt10Years,
      },
    })

    findings.push(`${member.name}: A=$${feRate.monthlyPremium}/mo WL | B=$${termRate.monthlyPremium}/mo Term | C=$${iulRate.monthlyPremium}/mo IUL`)
  }

  warnings.push('Premiums are planning estimates. Carrier illustration required for actual quotes.')

  const primary = memberOptions[0]

  return {
    success: true,
    result: {
      type: 'life_options',
      applicable: memberOptions.length > 0,
      summary: primary ? `3-option comparison for ${primary.member}: WL $${primary.optionA.monthlyPremium}/mo | Term $${primary.optionB.monthlyPremium}/mo | IUL $${primary.optionC.monthlyPremium}/mo` : 'No members to analyze',
      findings,
      recommendation: primary ? `Option B (Term) is most cost-effective. Option C (IUL) adds living benefits.` : '',
      metrics: {
        memberCount: memberOptions.length,
        optionAMonthly: primary?.optionA.monthlyPremium ?? 0,
        optionBMonthly: primary?.optionB.monthlyPremium ?? 0,
        optionCMonthly: primary?.optionC.monthlyPremium ?? 0,
      },
      details: { memberOptions },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
