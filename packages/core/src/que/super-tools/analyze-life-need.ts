/**
 * analyze-life-need — ANALYZE_LIFE_NEED super tool
 * Full life insurance needs calculation with face amount targets per member
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcIncomeNeed } from '../tools/calc-income-need'
import { calcDebtNeed } from '../tools/calc-debt-need'
import { calcCollegeFunding } from '../tools/calc-college-funding'
import { calcMiscCashNeed } from '../tools/calc-misc-cash-need'
import { calcExistingCoverageOffset } from '../tools/calc-existing-coverage-offset'
import { calcSurvivorCashNeed } from '../tools/calc-survivor-cash-need'
import { calcSurvivorIncomeNeed } from '../tools/calc-survivor-income-need'
import { calcTotalLifeNeed } from '../tools/calc-total-life-need'
import { lookupLifeRate } from '../tools/lookup-life-rate'

export function analyzeLifeNeed(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  // BUG 3b FIX: Output memberBreakdowns matching template contract
  const memberBreakdowns: Array<{
    member: string; age: number; incomeNeed: number; debtNeed: number
    collegeFunding: number; miscCashNeed: number; survivorCashNeed: number
    survivorIncomeNeed: number; grossNeed: number; existingCoverage: number
    netNeed: number; monthlyPremiumEstimate: number
  }> = []

  let householdNetNeed = 0

  for (const member of household.members) {
    const yearsNeeded = Math.max(5, 65 - member.age)

    const income = calcIncomeNeed({ annualIncome: member.annualIncome, yearsNeeded })
    toolsUsed.push('calc-income-need')

    const debt = calcDebtNeed({})
    toolsUsed.push('calc-debt-need')

    const college = calcCollegeFunding({ childAge: 10 })
    toolsUsed.push('calc-college-funding')

    const misc = calcMiscCashNeed({ monthlyExpenses: member.annualIncome / 12 })
    toolsUsed.push('calc-misc-cash-need')

    // BUG 1b FIX: Individual = has cashValue/annualPremium, group = doesn't
    const groupAccounts = member.accounts.filter(a => a.type === 'life' && !a.cashValue && !a.annualPremium)
    const individualAccounts = member.accounts.filter(a => a.type === 'life' && (a.cashValue != null || a.annualPremium != null))
    const offset = calcExistingCoverageOffset({
      groupLife: groupAccounts.reduce((s, a) => s + (a.deathBenefit || a.accountValue || 0), 0),
      individualPolicies: individualAccounts.reduce((s, a) => s + (a.deathBenefit || a.accountValue || 0), 0),
    })
    toolsUsed.push('calc-existing-coverage-offset')

    const survivorCash = calcSurvivorCashNeed({ debtTotal: debt.value.totalDebt, emergencyFund: misc.value.emergencyFund })
    toolsUsed.push('calc-survivor-cash-need')

    const survivorIncome = calcSurvivorIncomeNeed({
      survivorMonthlyExpenses: member.annualIncome / 12 * 0.8,
      survivorMonthlyIncome: member.annualIncome / 12 * 0.5,
      yearsNeeded,
    })
    toolsUsed.push('calc-survivor-income-need')

    const total = calcTotalLifeNeed({
      incomeNeed: income.value.totalNeed,
      debtNeed: debt.value.totalDebt,
      collegeFundingNeed: college.value.totalCost,
      miscCashNeed: misc.value.totalMiscNeed,
      survivorCashNeed: survivorCash.value.totalCashNeed,
      survivorIncomeNeed: survivorIncome.value.totalIncomeNeed,
      existingCoverageOffset: offset.value.totalOffset,
    })
    toolsUsed.push('calc-total-life-need')

    // Estimate monthly premium for the gap amount (20-year term, preferred)
    const rateResult = lookupLifeRate({ productType: 'term-20', age: member.age, gender: 'male', rateClass: 'Preferred', faceAmount: Math.max(100000, total.value.netNeed) })
    toolsUsed.push('lookup-life-rate')

    memberBreakdowns.push({
      member: member.name,
      age: member.age,
      incomeNeed: income.value.totalNeed,
      debtNeed: debt.value.totalDebt,
      collegeFunding: college.value.totalCost,
      miscCashNeed: misc.value.totalMiscNeed,
      survivorCashNeed: survivorCash.value.totalCashNeed,
      survivorIncomeNeed: survivorIncome.value.totalIncomeNeed,
      grossNeed: total.value.grossNeed,
      existingCoverage: offset.value.totalOffset,
      netNeed: total.value.netNeed,
      monthlyPremiumEstimate: rateResult.monthlyPremium,
    })

    householdNetNeed += total.value.netNeed
    findings.push(`${member.name}: Gross $${total.value.grossNeed.toLocaleString()} − Existing $${offset.value.totalOffset.toLocaleString()} = Gap $${total.value.netNeed.toLocaleString()} (~$${rateResult.monthlyPremium}/mo term)`)
    if (total.value.netNeed > 0) warnings.push(`${member.name} is underinsured by $${total.value.netNeed.toLocaleString()}`)
  }

  return {
    success: true,
    result: {
      type: 'life_needs',
      applicable: householdNetNeed > 0,
      summary: `Household life insurance gap: $${householdNetNeed.toLocaleString()} across ${memberBreakdowns.length} member(s)`,
      findings,
      recommendation: householdNetNeed > 0 ? `Total gap of $${householdNetNeed.toLocaleString()}. Run WIRE_LIFE_OPTIONS for product comparison.` : 'Current coverage meets estimated needs.',
      metrics: { memberCount: memberBreakdowns.length, householdNetNeed, avgNeedPerMember: memberBreakdowns.length > 0 ? Math.round(householdNetNeed / memberBreakdowns.length) : 0, totalHouseholdNeed: memberBreakdowns.reduce((s, m) => s + m.grossNeed, 0), totalExistingCoverage: memberBreakdowns.reduce((s, m) => s + m.existingCoverage, 0), totalNetNeed: householdNetNeed, coverageRatio: memberBreakdowns.length > 0 ? Math.round(memberBreakdowns.reduce((s, m) => s + m.existingCoverage, 0) / Math.max(1, memberBreakdowns.reduce((s, m) => s + m.grossNeed, 0)) * 100) : 0 },
      details: { memberBreakdowns },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
