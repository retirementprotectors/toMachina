/**
 * ANALYZE_GROWTH — Super Tool (TRK-13386)
 *
 * Compares existing VA sustainability vs proposed FIA.
 * Calculates consolidation cost/bonus offset and year-by-year delta.
 *
 * Calc tools used:
 *   1. calc-va-depletion     → Existing VA burn-rate (with actual fund returns)
 *   2. calc-fia-projection   → Proposed FIA sustainability (with bonus)
 *   3. calc-delta            → Year-by-year advantage
 *   4. calc-surrender-charge → Cost to exit existing product
 *   5. calc-ltcg             → Tax on gains realized
 *   6. calc-bonus-offset     → Carrier bonus covers costs?
 *
 * Output: Depletion age, delta table, net cost (often negative), consolidation math
 */

import type { SuperToolHousehold, SuperToolOutput, SuperToolAccount } from './types'
import { calcVaDepletion } from '../tools/calc-va-depletion'
import { calcFiaProjection } from '../tools/calc-fia-projection'
import { calcDelta } from '../tools/calc-delta'
import { calcSurrenderCharge } from '../tools/calc-surrender-charge'
import { calcLtcg } from '../tools/calc-ltcg'
import { calcBonusOffset } from '../tools/calc-bonus-offset'

interface ConsolidationCandidate {
  account: string
  carrier: string
  accountValue: number
  surrenderCost: number
  ltcgCost: number
  bonusCredit: number
  netCost: number
  isNetGain: boolean
}

export function analyzeGrowth(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const allAccounts = household.members.flatMap((m) => m.accounts)

  // Find VA accounts (fee-heavy, potential depletion)
  const vaAccounts = allAccounts.filter(
    (a) =>
      a.type === 'va' &&
      a.accountValue > 0 &&
      a.grossReturn !== undefined &&
      a.totalFeeRate !== undefined
  )

  // Find CD/bank accounts (idle money)
  const idleAccounts = allAccounts.filter(
    (a) => (a.type === 'cd' || a.type === 'bank') && a.accountValue > 10_000
  )

  if (vaAccounts.length === 0 && idleAccounts.length === 0) {
    return {
      success: true,
      result: {
        type: 'growth_max',
        applicable: false,
        summary: 'No VA accounts or idle assets detected for growth repositioning.',
        findings: [],
        recommendation: 'No growth repositioning opportunities at this time.',
        metrics: { vaAccountCount: 0, idleAccountCount: 0 },
        details: {},
        warnings: [],
      },
      toolsUsed: [],
    }
  }

  const projectionYears = 30
  const consolidationCandidates: ConsolidationCandidate[] = []
  let totalVaValue = 0
  let earliestDepletion: number | null = null
  let totalNetCost = 0

  // Analyze each VA
  const vaAnalyses: Array<{
    account: string
    depletionYear: number | null
    finalValue: number
    schedule: unknown[]
  }> = []

  for (const acct of vaAccounts) {
    totalVaValue += acct.accountValue
    const vaResult = calcVaDepletion({
      startingValue: acct.accountValue,
      annualWithdrawal: acct.annualWithdrawal ?? 0,
      grossReturn: acct.grossReturn!,
      totalFeeRate: acct.totalFeeRate!,
      years: projectionYears,
    })
    toolsUsed.push('calc-va-depletion')

    vaAnalyses.push({
      account: `${acct.carrier} ${acct.product} (${acct.id})`,
      depletionYear: vaResult.value.depletionYear,
      finalValue: vaResult.value.finalValue,
      schedule: vaResult.value.schedule,
    })

    if (vaResult.value.depletionYear !== null) {
      if (earliestDepletion === null || vaResult.value.depletionYear < earliestDepletion) {
        earliestDepletion = vaResult.value.depletionYear
      }
      findings.push(
        `${acct.carrier} ${acct.product}: Depletes in year ${vaResult.value.depletionYear} (fee drag: ${((acct.totalFeeRate ?? 0) * 100).toFixed(2)}%)`
      )
    }

    // Consolidation cost analysis
    if (acct.surrenderChargePercent !== undefined && acct.surrenderChargePercent > 0) {
      const surrenderResult = calcSurrenderCharge({
        accountValue: acct.accountValue,
        chargePercent: acct.surrenderChargePercent,
      })
      toolsUsed.push('calc-surrender-charge')

      const ltcgResult = calcLtcg({
        marketValue: acct.accountValue,
        costBasis: acct.costBasis ?? acct.accountValue,
      })
      toolsUsed.push('calc-ltcg')

      const bonusResult = calcBonusOffset({
        surrenderCost: surrenderResult.value.netCharge,
        ltcgCost: ltcgResult.value.tax,
        deposits: acct.accountValue - surrenderResult.value.netCharge,
        bonusRate: acct.bonusRate ?? 0.07,
      })
      toolsUsed.push('calc-bonus-offset')

      consolidationCandidates.push({
        account: `${acct.carrier} ${acct.product} (${acct.id})`,
        carrier: acct.carrier,
        accountValue: acct.accountValue,
        surrenderCost: surrenderResult.value.netCharge,
        ltcgCost: ltcgResult.value.tax,
        bonusCredit: bonusResult.value.bonusCredit,
        netCost: bonusResult.value.netCost,
        isNetGain: bonusResult.value.isNetGain,
      })

      totalNetCost += bonusResult.value.netCost

      if (bonusResult.value.isNetGain) {
        findings.push(
          `${acct.carrier}: Carrier bonus produces net GAIN of $${Math.abs(bonusResult.value.netCost).toLocaleString()} on consolidation`
        )
      }
    }
  }

  // Build proposed FIA projection (using typical FIA assumptions)
  const totalDeposits = totalVaValue - Math.max(0, totalNetCost)
  const totalAnnualWithdrawal = vaAccounts.reduce((sum, a) => sum + (a.annualWithdrawal ?? 0), 0)
  const fiaResult = calcFiaProjection({
    deposits: totalDeposits,
    firstYearBonus: 0.07,
    hypoGrowthRate: 0.05,
    years: projectionYears,
    annualWithdrawal: totalAnnualWithdrawal,
    annualFeeRate: 0,
  })
  toolsUsed.push('calc-fia-projection')

  // Delta comparison
  const vaValues = vaAnalyses.length > 0
    ? (vaAnalyses[0].schedule as Array<{ endingValue: number }>).map((r) => r.endingValue)
    : []
  const fiaValues = fiaResult.value.schedule.map((r) => r.endingValue)

  let deltaResult = null
  if (vaValues.length > 0 && fiaValues.length > 0) {
    deltaResult = calcDelta({ proposedValues: fiaValues, currentValues: vaValues })
    toolsUsed.push('calc-delta')

    if (deltaResult.value.crossoverYear) {
      findings.push(
        `FIA surpasses VA in year ${deltaResult.value.crossoverYear}. Total 30-year delta: $${Math.round(deltaResult.value.totalDelta).toLocaleString()}`
      )
    }
  }

  if (earliestDepletion !== null) {
    warnings.push(`Earliest VA depletion: year ${earliestDepletion}`)
  }

  const applicable = vaAccounts.length > 0 || idleAccounts.length > 0

  return {
    success: true,
    result: {
      type: 'growth_max',
      applicable,
      summary: earliestDepletion
        ? `VA account(s) deplete in year ${earliestDepletion}. FIA repositioning saves $${Math.round(deltaResult?.value.totalDelta ?? 0).toLocaleString()} over 30 years.`
        : `${vaAccounts.length} VA account(s) with $${Math.round(totalVaValue).toLocaleString()} available for growth repositioning.`,
      findings,
      recommendation: earliestDepletion
        ? 'VA depletion detected. Recommend consolidation to FIA with guaranteed principal protection and zero M+E fees.'
        : vaAccounts.length > 0
          ? 'VA fee drag is eroding growth. Evaluate FIA repositioning to eliminate fees and add principal guarantees.'
          : 'Idle bank/CD money could grow faster in an FIA with first-year bonus.',
      metrics: {
        vaAccountCount: vaAccounts.length,
        idleAccountCount: idleAccounts.length,
        totalVaValue,
        earliestDepletion: earliestDepletion ?? 0,
        totalNetConsolidationCost: totalNetCost,
        fiaFinalValue: fiaResult.value.finalValue,
        totalDelta: deltaResult?.value.totalDelta ?? 0,
        crossoverYear: deltaResult?.value.crossoverYear ?? 0,
      },
      details: {
        vaAnalyses,
        fiaProjection: {
          deposits: totalDeposits,
          finalValue: fiaResult.value.finalValue,
          schedule: fiaResult.value.schedule,
        },
        deltaSchedule: deltaResult?.value.schedule ?? [],
        consolidationCandidates,
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
