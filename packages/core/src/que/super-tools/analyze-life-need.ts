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

export function analyzeLifeNeed(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const memberResults: Array<{
    member: string
    incomeNeed: number
    debtNeed: number
    collegeFundingNeed: number
    miscCashNeed: number
    survivorCashNeed: number
    survivorIncomeNeed: number
    existingOffset: number
    netNeed: number
  }> = []

  let householdNetNeed = 0

  for (const member of household.members) {
    // 1. Income need (20 years default, 3% inflation)
    const yearsNeeded = Math.max(5, 65 - member.age)
    const income = calcIncomeNeed({ annualIncome: member.annualIncome, yearsNeeded })
    toolsUsed.push('calc-income-need')

    // 2. Debt need
    const debt = calcDebtNeed({})
    toolsUsed.push('calc-debt-need')

    // 3. College funding (if member has children — assume 0 for now, advisor fills in)
    const college = calcCollegeFunding({ childAge: 10 })
    toolsUsed.push('calc-college-funding')

    // 4. Misc cash need
    const misc = calcMiscCashNeed({ monthlyExpenses: member.annualIncome / 12 })
    toolsUsed.push('calc-misc-cash-need')

    // 5. Existing coverage offset
    const groupAccounts = member.accounts.filter(a => a.type === 'life')
    const individualAccounts = member.accounts.filter(a => a.type === 'life')
    const offset = calcExistingCoverageOffset({
      groupLife: groupAccounts.reduce((s, a) => s + (a.accountValue || 0), 0),
      individualPolicies: individualAccounts.reduce((s, a) => s + (a.accountValue || 0), 0),
    })
    toolsUsed.push('calc-existing-coverage-offset')

    // 6. Survivor cash need
    const survivorCash = calcSurvivorCashNeed({
      debtTotal: debt.value.totalDebt,
      emergencyFund: misc.value.emergencyFund,
    })
    toolsUsed.push('calc-survivor-cash-need')

    // 7. Survivor income need (spouse earns 50% heuristic)
    const survivorIncome = calcSurvivorIncomeNeed({
      survivorMonthlyExpenses: member.annualIncome / 12 * 0.8,
      survivorMonthlyIncome: member.annualIncome / 12 * 0.5,
      yearsNeeded,
    })
    toolsUsed.push('calc-survivor-income-need')

    // 8. Total life need
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

    memberResults.push({
      member: member.name,
      incomeNeed: income.value.totalNeed,
      debtNeed: debt.value.totalDebt,
      collegeFundingNeed: college.value.totalCost,
      miscCashNeed: misc.value.totalMiscNeed,
      survivorCashNeed: survivorCash.value.totalCashNeed,
      survivorIncomeNeed: survivorIncome.value.totalIncomeNeed,
      existingOffset: offset.value.totalOffset,
      netNeed: total.value.netNeed,
    })

    householdNetNeed += total.value.netNeed

    findings.push(`${member.name}: Gross need $${total.value.grossNeed.toLocaleString()} − Existing $${offset.value.totalOffset.toLocaleString()} = Gap $${total.value.netNeed.toLocaleString()}`)

    if (total.value.netNeed > 0) {
      warnings.push(`${member.name} is underinsured by $${total.value.netNeed.toLocaleString()}`)
    }
  }

  return {
    success: true,
    result: {
      type: 'life_needs',
      applicable: householdNetNeed > 0,
      summary: `Household life insurance gap: $${householdNetNeed.toLocaleString()} across ${memberResults.length} member(s)`,
      findings,
      recommendation: householdNetNeed > 0
        ? `Total coverage gap of $${householdNetNeed.toLocaleString()} identified. Run WIRE_LIFE_OPTIONS for product comparison.`
        : 'Current coverage meets estimated needs.',
      metrics: {
        memberCount: memberResults.length,
        householdNetNeed,
        avgNeedPerMember: memberResults.length > 0 ? Math.round(householdNetNeed / memberResults.length) : 0,
      },
      details: { memberResults },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
