/**
 * ANALYZE_ESTATE — Super Tool (TRK-13385)
 *
 * Analyzes household for estate planning opportunities:
 * lapsing life policies, inadequate death benefits, 1035 candidates.
 *
 * Calc tools used:
 *   1. calc-va-depletion       → Project each policy forward (lapse detection)
 *   2. calc-income-multiplier  → Survivor needs calculation
 *   3. calc-college-funding    → If dependents exist
 *   4. lookup-fyc-rate         → Carrier comparison for replacements
 *
 * Output: Lapse warnings, DB erosion total, 1035 candidates, survivor gap
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcVaDepletion } from '../tools/calc-va-depletion'
import { calcIncomeMultiplier } from '../tools/calc-income-multiplier'
import { calcCollegeFunding } from '../tools/calc-college-funding'
import { lookupFycRate } from '../tools/lookup-fyc-rate'

interface LapseWarning {
  account: string
  carrier: string
  currentDb: number
  guaranteedLapseAge: number
  ownerAge: number
  yearsToLapse: number
}

interface SurvivorNeed {
  member: string
  age: number
  incomeMultiplier: number
  recommendedCoverage: number
  currentCoverage: number
  gap: number
}

export function analyzeEstate(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const allAccounts = household.members.flatMap((m) => m.accounts)
  const lifeAccounts = allAccounts.filter((a) => a.type === 'life')

  // 1. Lapse detection — check guaranteed lapse ages
  const lapseWarnings: LapseWarning[] = []
  let totalDbAtRisk = 0

  for (const member of household.members) {
    const memberLife = member.accounts.filter((a) => a.type === 'life')
    for (const acct of memberLife) {
      if (acct.guaranteedLapseAge && acct.guaranteedLapseAge > 0) {
        const yearsToLapse = acct.guaranteedLapseAge - member.age
        const lifeExpectancy = member.lifeExpectancy ?? (member.age < 70 ? 85 : 90)

        if (acct.guaranteedLapseAge < lifeExpectancy) {
          lapseWarnings.push({
            account: `${acct.carrier} ${acct.product} (${acct.id})`,
            carrier: acct.carrier,
            currentDb: acct.deathBenefit ?? 0,
            guaranteedLapseAge: acct.guaranteedLapseAge,
            ownerAge: member.age,
            yearsToLapse,
          })
          totalDbAtRisk += acct.deathBenefit ?? 0
          warnings.push(
            `${acct.carrier} ${acct.product}: Guaranteed lapse at age ${acct.guaranteedLapseAge} (${yearsToLapse} years). DB at risk: $${(acct.deathBenefit ?? 0).toLocaleString()}`
          )
        }
      }
    }
  }

  if (lapseWarnings.length > 0) {
    findings.push(
      `${lapseWarnings.length} life policy/policies approaching lapse. Total DB at risk: $${Math.round(totalDbAtRisk).toLocaleString()}`
    )
  }

  // 2. VA/annuity with death benefit — project depletion
  const vaAccounts = allAccounts.filter(
    (a) => a.type === 'va' && a.deathBenefit && a.deathBenefit > 0
  )
  const depletionDetails: Array<{
    account: string
    currentDb: number
    depletionYear: number | null
    finalValue: number
  }> = []

  for (const acct of vaAccounts) {
    if (acct.accountValue > 0 && acct.annualWithdrawal && acct.grossReturn !== undefined && acct.totalFeeRate !== undefined) {
      const depResult = calcVaDepletion({
        startingValue: acct.accountValue,
        annualWithdrawal: acct.annualWithdrawal,
        grossReturn: acct.grossReturn,
        totalFeeRate: acct.totalFeeRate,
        years: 30,
      })
      toolsUsed.push('calc-va-depletion')
      depletionDetails.push({
        account: `${acct.carrier} ${acct.product} (${acct.id})`,
        currentDb: acct.deathBenefit ?? 0,
        depletionYear: depResult.value.depletionYear,
        finalValue: depResult.value.finalValue,
      })
      if (depResult.value.depletionYear !== null) {
        findings.push(
          `${acct.carrier}: VA depletes in year ${depResult.value.depletionYear}, death benefit erodes`
        )
      }
    }
  }

  // 3. Survivor needs calculation
  const survivorNeeds: SurvivorNeed[] = []
  for (const member of household.members) {
    const multResult = calcIncomeMultiplier({
      age: member.age,
      annualIncome: member.annualIncome,
    })
    toolsUsed.push('calc-income-multiplier')

    const currentCoverage = member.accounts
      .filter((a) => a.type === 'life')
      .reduce((sum, a) => sum + (a.deathBenefit ?? 0), 0)

    let collegeFunding = 0
    if (member.dependents) {
      for (const dep of member.dependents) {
        if (dep.age < 18) {
          const collegeResult = calcCollegeFunding({ childAge: dep.age })
          toolsUsed.push('calc-college-funding')
          collegeFunding += collegeResult.value.totalCost
        }
      }
    }

    const totalNeed = multResult.value.recommendedCoverage + collegeFunding
    const gap = totalNeed - currentCoverage

    survivorNeeds.push({
      member: member.name,
      age: member.age,
      incomeMultiplier: multResult.value.multiplier,
      recommendedCoverage: totalNeed,
      currentCoverage,
      gap,
    })

    if (gap > 0) {
      findings.push(
        `${member.name}: Coverage gap of $${Math.round(gap).toLocaleString()} (need $${Math.round(totalNeed).toLocaleString()}, have $${Math.round(currentCoverage).toLocaleString()})`
      )
    }
  }

  // 4. FYC rate lookup for potential 1035 targets
  const fycComparisons: Array<{ carrier: string; targetPercent: number; excessPercent: number; preferred: boolean }> = []
  const preferredCarriers = ['CoF', 'JH', 'MOO', 'NAC']
  for (const code of preferredCarriers) {
    const fyc = lookupFycRate(code)
    if (fyc) {
      fycComparisons.push({
        carrier: fyc.carrier,
        targetPercent: fyc.targetPercent,
        excessPercent: fyc.excessPercent,
        preferred: fyc.preferred ?? false,
      })
    }
  }
  if (fycComparisons.length > 0) {
    toolsUsed.push('lookup-fyc-rate')
  }

  // Identify 1035 exchange candidates
  const candidates1035 = lapseWarnings.map((lw) => ({
    source: lw.account,
    currentDb: lw.currentDb,
    yearsToLapse: lw.yearsToLapse,
    recommendedTarget: 'COF Value 4 Life or NAC BenefitSolutions',
  }))

  const applicable = lapseWarnings.length > 0 || survivorNeeds.some((s) => s.gap > 0)
  const totalGap = survivorNeeds.reduce((sum, s) => sum + Math.max(0, s.gap), 0)

  return {
    success: true,
    result: {
      type: 'estate_max',
      applicable,
      summary: applicable
        ? `${lapseWarnings.length} policy/policies at lapse risk, $${Math.round(totalDbAtRisk).toLocaleString()} DB at risk. Survivor coverage gap: $${Math.round(totalGap).toLocaleString()}.`
        : 'No immediate estate planning concerns detected.',
      findings,
      recommendation: applicable
        ? 'Initiate 1035 exchange analysis for lapsing policies. Evaluate replacement products with guaranteed no-lapse provisions.'
        : 'Estate coverage appears adequate. Review annually.',
      metrics: {
        lapseWarningCount: lapseWarnings.length,
        totalDbAtRisk,
        totalSurvivorGap: totalGap,
        lifePolicyCount: lifeAccounts.length,
        candidates1035Count: candidates1035.length,
      },
      details: {
        lapseWarnings,
        depletionDetails,
        survivorNeeds,
        fycComparisons,
        candidates1035,
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
