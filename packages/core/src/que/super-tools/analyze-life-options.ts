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

  // v2 FIX: Full template contract — description, annualPremium, pros, cons, cashValue, netOutlay
  interface LifeOpt { label: string; description: string; faceAmount: number; monthlyPremium: number; annualPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean; cashValueAt10Years: number; netOutlayAt10Years: number; pros: string[]; cons: string[] }
  const memberOptions: Array<{ member: string; age: number; totalNeed: number; optionA: LifeOpt; optionB: LifeOpt; optionC: LifeOpt }> = []

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

    const feAnnual = Math.round(feRate.monthlyPremium * 12)
    const termAnnual = Math.round(termRate.monthlyPremium * 12)
    const iulAnnual = Math.round(iulRate.monthlyPremium * 12)

    memberOptions.push({
      member: member.name,
      age: member.age,
      totalNeed: roundedFace,
      optionA: {
        label: 'Final Expense', description: 'Whole life policy covering final expenses. Guaranteed, permanent, builds cash value slowly.',
        faceAmount: feFace, monthlyPremium: feRate.monthlyPremium, annualPremium: feAnnual, termYears: null,
        carrier: feCarrier?.[0]?.carrier || 'Mutual of Omaha', product: feCarrier?.[0]?.product || 'Living Promise', livingBenefits: false,
        cashValueAt10Years: Math.round(feAnnual * 10 * 0.35), netOutlayAt10Years: Math.round(feAnnual * 10 * 0.65),
        pros: ['Guaranteed premiums for life', 'Builds cash value', 'No expiration'], cons: ['Lower face amount', 'Higher cost per dollar of coverage', 'Slow cash value growth'],
      },
      optionB: {
        label: 'Income Replacement', description: '20-year term covering income replacement need. Lowest cost, highest face amount, expires at term end.',
        faceAmount: roundedFace, monthlyPremium: termRate.monthlyPremium, annualPremium: termAnnual, termYears: 20,
        carrier: termCarrier?.[0]?.carrier || 'Protective', product: termCarrier?.[0]?.product || 'Classic Choice Term', livingBenefits: false,
        cashValueAt10Years: 0, netOutlayAt10Years: termAnnual * 10,
        pros: ['Lowest premium', 'Highest face amount per dollar', 'Convertible to permanent'], cons: ['Expires after 20 years', 'No cash value', 'No living benefits'],
      },
      optionC: {
        label: 'Swiss-Army IUL', description: 'Indexed universal life with living benefits. Death benefit + cash accumulation + chronic/terminal/critical illness access.',
        faceAmount: iulFace, monthlyPremium: iulRate.monthlyPremium, annualPremium: iulAnnual, termYears: null,
        carrier: iulCarrier?.[0]?.carrier || 'John Hancock', product: iulCarrier?.[0]?.product || 'Accumulation IUL', livingBenefits: true,
        cashValueAt10Years, netOutlayAt10Years: netOutlay.value.netOutlay,
        pros: ['Living benefits (chronic/terminal/critical)', 'Cash value accumulation', 'Flexible premiums', 'Tax-advantaged growth'], cons: ['Higher premium than term', 'Cash value depends on index performance', 'Requires ongoing funding'],
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
        totalOptionAMonthly: memberOptions.reduce((s, m) => s + m.optionA.monthlyPremium, 0),
        totalOptionBMonthly: memberOptions.reduce((s, m) => s + m.optionB.monthlyPremium, 0),
        totalOptionCMonthly: memberOptions.reduce((s, m) => s + m.optionC.monthlyPremium, 0),
      },
      details: { memberOptions },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
