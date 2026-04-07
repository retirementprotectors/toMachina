/**
 * analyze-life-options — ANALYZE_LIFE_OPTIONS super tool
 * 3-option comparison: Final Expenses / Income Replacement / Swiss-Army IUL
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcTotalLifeNeed } from '../tools/calc-total-life-need'
import { lookupLifeRate } from '../tools/lookup-life-rate'
import { calcNetOutlay } from '../tools/calc-net-outlay'

interface LifeOption {
  optionNumber: number
  label: string
  description: string
  productType: string
  faceAmount: number
  monthlyPremium: number
  annualPremium: number
  keyBenefit: string
}

export function analyzeLifeOptions(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []
  const options: LifeOption[] = []

  const primaryMember = household.members[0]
  if (!primaryMember) {
    return {
      success: false,
      result: {
        type: 'life_options',
        applicable: false,
        summary: 'No household members to analyze',
        findings: [],
        recommendation: '',
        metrics: {},
        details: {},
        warnings: [],
      },
      toolsUsed: [],
    }
  }

  // Face amount baseline: 10x income minus existing coverage
  const existingCoverage = primaryMember.accounts
    .filter(a => a.type === 'life')
    .reduce((s, a) => s + (a.accountValue || 0), 0)

  const needResult = calcTotalLifeNeed({
    incomeNeed: primaryMember.annualIncome * 10,
    existingCoverageOffset: existingCoverage,
  })
  toolsUsed.push('calc-total-life-need')

  const targetFace = Math.max(100000, needResult.value.netNeed)
  const roundedFace = Math.ceil(targetFace / 100000) * 100000

  // OPTION A: Final Expense (Whole Life)
  const feFace = Math.min(50000, roundedFace)
  const feRate = lookupLifeRate({ productType: 'whole-life', age: primaryMember.age, gender: 'male', rateClass: 'Standard', faceAmount: feFace })
  toolsUsed.push('lookup-life-rate')
  options.push({
    optionNumber: 1,
    label: 'Final Expense',
    description: 'Whole life — guaranteed issue, covers funeral + final expenses',
    productType: 'whole-life',
    faceAmount: feFace,
    monthlyPremium: feRate.monthlyPremium,
    annualPremium: feRate.annualPremium,
    keyBenefit: 'Guaranteed acceptance, permanent coverage, builds cash value',
  })

  // OPTION B: Income Replacement (20-Year Term)
  const termRate = lookupLifeRate({ productType: 'term-20', age: primaryMember.age, gender: 'male', rateClass: 'Preferred', faceAmount: roundedFace })
  toolsUsed.push('lookup-life-rate')
  options.push({
    optionNumber: 2,
    label: 'Income Replacement',
    description: '20-year term — maximum coverage at lowest cost',
    productType: 'term-20',
    faceAmount: roundedFace,
    monthlyPremium: termRate.monthlyPremium,
    annualPremium: termRate.annualPremium,
    keyBenefit: 'Lowest premium, full income replacement for 20 years',
  })

  // OPTION C: Swiss-Army IUL
  const iulFace = Math.round(roundedFace * 0.75)
  const iulRate = lookupLifeRate({ productType: 'iul', age: primaryMember.age, gender: 'male', rateClass: 'Preferred', faceAmount: iulFace })
  toolsUsed.push('lookup-life-rate')

  const netOutlay = calcNetOutlay({
    premiumOutlay: iulRate.annualPremium * 10,
    cashValue: iulRate.annualPremium * 10 * 0.6,
  })
  toolsUsed.push('calc-net-outlay')

  options.push({
    optionNumber: 3,
    label: 'Swiss-Army IUL',
    description: 'Indexed UL — permanent death benefit + LTC rider + cash accumulation',
    productType: 'iul',
    faceAmount: iulFace,
    monthlyPremium: iulRate.monthlyPremium,
    annualPremium: iulRate.annualPremium,
    keyBenefit: 'Three benefits in one: death benefit + LTC access + tax-deferred growth',
  })

  for (const opt of options) {
    findings.push(`Option ${opt.optionNumber} (${opt.label}): $${opt.faceAmount.toLocaleString()} face at $${opt.monthlyPremium}/mo — ${opt.keyBenefit}`)
  }

  warnings.push('Premiums are planning estimates. Carrier illustration required for actual quotes.')

  return {
    success: true,
    result: {
      type: 'life_options',
      applicable: true,
      summary: `3-option comparison for ${primaryMember.name}: $${feFace.toLocaleString()} WL / $${roundedFace.toLocaleString()} Term / $${iulFace.toLocaleString()} IUL`,
      findings,
      recommendation: `Option B (Term) is most cost-effective at $${termRate.monthlyPremium}/mo. Option C (IUL) adds living benefits for $${iulRate.monthlyPremium}/mo.`,
      metrics: {
        targetFace: roundedFace,
        optionAMonthly: options[0].monthlyPremium,
        optionBMonthly: options[1].monthlyPremium,
        optionCMonthly: options[2].monthlyPremium,
        netOutlay10YearIul: netOutlay.value.netOutlay,
      },
      details: { options },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
