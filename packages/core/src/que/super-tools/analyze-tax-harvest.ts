/**
 * ANALYZE_TAX_HARVEST — Super Tool (TRK-13389)
 *
 * Models optimal tax lot liquidation for a target amount.
 * Calculates effective tax rate, loss carryforward, and SS impact.
 *
 * Calc tools used:
 *   1. calc-lot-selection       → Sort all lots by gain%, select for target
 *   2. calc-ltcg                → Tax on selected lots
 *   3. calc-ss-earnings-limit   → If pre-FRA, impact on SS benefits
 *   4. calc-provisional-income  → Impact on SS taxation
 *
 * Output: Lot selection table, effective tax rate, net proceeds, loss carryforward
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcLotSelection } from '../tools/calc-lot-selection'
import { calcLtcg } from '../tools/calc-ltcg'
import { calcSsEarningsLimit } from '../tools/calc-ss-earnings-limit'
import { calcProvisionalIncome } from '../tools/calc-provisional-income'
import type { TaxLot } from '../tools/types'

export function analyzeTaxHarvest(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const allAccounts = household.members.flatMap((m) => m.accounts)

  // Find NQ (non-qualified) accounts with positions
  const nqAccounts = allAccounts.filter(
    (a) => a.taxStatus === 'nq' && a.accountValue > 0 && a.costBasis !== undefined
  )

  // Find IRA accounts for IRA-specific liquidation strategy
  const iraAccounts = allAccounts.filter(
    (a) => a.taxStatus === 'ira' && a.accountValue > 0
  )

  if (nqAccounts.length === 0 && iraAccounts.length === 0) {
    return {
      success: true,
      result: {
        type: 'tax_harvesting',
        applicable: false,
        summary: 'No non-qualified or IRA accounts available for tax-efficient liquidation.',
        findings: [],
        recommendation: 'No tax harvesting opportunities at this time.',
        metrics: { nqAccountCount: 0, iraAccountCount: 0 },
        details: {},
        warnings: [],
      },
      toolsUsed: [],
    }
  }

  // Build tax lot list from NQ accounts
  const taxLots: TaxLot[] = nqAccounts.map((a) => ({
    id: a.id,
    marketValue: a.accountValue,
    costBasis: a.costBasis ?? a.accountValue,
    description: `${a.carrier} ${a.product}`,
  }))

  // Total NQ portfolio
  const totalNqValue = nqAccounts.reduce((sum, a) => sum + a.accountValue, 0)
  const totalCostBasis = nqAccounts.reduce((sum, a) => sum + (a.costBasis ?? a.accountValue), 0)
  const unrealizedGain = totalNqValue - totalCostBasis

  findings.push(`NQ portfolio: $${Math.round(totalNqValue).toLocaleString()} market value`)
  findings.push(`Total unrealized gain: $${Math.round(unrealizedGain).toLocaleString()}`)

  // Run lot selection for multiple target amounts
  const targetAmounts = [50_000, 100_000, 150_000, totalNqValue]
    .filter((amt) => amt <= totalNqValue)
    .filter((v, i, arr) => arr.indexOf(v) === i) // Dedupe

  const lotAnalyses: Array<{
    targetAmount: number
    totalProceeds: number
    totalGain: number
    totalTax: number
    effectiveTaxRate: number
    shortfall: number
    selectedLotCount: number
  }> = []

  let fullLiquidationResult = null

  for (const target of targetAmounts) {
    const lotResult = calcLotSelection({
      lots: taxLots,
      targetAmount: target,
      strategy: 'nq',
    })
    toolsUsed.push('calc-lot-selection')

    lotAnalyses.push({
      targetAmount: target,
      totalProceeds: lotResult.value.totalProceeds,
      totalGain: lotResult.value.totalGain,
      totalTax: lotResult.value.totalTax,
      effectiveTaxRate: lotResult.value.effectiveTaxRate,
      shortfall: lotResult.value.shortfall,
      selectedLotCount: lotResult.value.selectedLots.length,
    })

    if (target === totalNqValue) {
      fullLiquidationResult = lotResult.value
    }
  }

  // Overall LTCG on the full portfolio
  const portfolioLtcg = calcLtcg({
    marketValue: totalNqValue,
    costBasis: totalCostBasis,
  })
  toolsUsed.push('calc-ltcg')

  findings.push(
    `Full liquidation tax: $${Math.round(portfolioLtcg.value.tax).toLocaleString()} (${((portfolioLtcg.value.tax / totalNqValue) * 100).toFixed(1)}% effective)`
  )

  // Loss carryforward
  const losses = nqAccounts.filter((a) => (a.costBasis ?? a.accountValue) > a.accountValue)
  const totalLoss = losses.reduce(
    (sum, a) => sum + ((a.costBasis ?? a.accountValue) - a.accountValue),
    0
  )
  if (totalLoss > 0) {
    const ordinaryDeduction = Math.min(totalLoss, 3_000)
    const carryforward = Math.max(0, totalLoss - 3_000)
    findings.push(
      `Tax loss positions: $${Math.round(totalLoss).toLocaleString()} (offsets gains, then $${ordinaryDeduction.toLocaleString()} ordinary deduction, $${Math.round(carryforward).toLocaleString()} carryforward)`
    )
  }

  // SS impact analysis for pre-FRA members
  const primaryMember = household.members.reduce((a, b) =>
    a.annualIncome >= b.annualIncome ? a : b
  )

  let ssImpact: Record<string, unknown> = {}
  if (primaryMember.age < 67 && primaryMember.ssBenefits && primaryMember.ssBenefits > 0) {
    const earningsResult = calcSsEarningsLimit({
      annualEarnings: primaryMember.annualIncome + (portfolioLtcg.value.gain > 0 ? portfolioLtcg.value.gain : 0),
      annualBenefit: primaryMember.ssBenefits,
    })
    toolsUsed.push('calc-ss-earnings-limit')
    ssImpact = {
      excessEarnings: earningsResult.value.excessEarnings,
      amountWithheld: earningsResult.value.amountWithheld,
      netBenefit: earningsResult.value.netBenefit,
    }
    if (earningsResult.value.amountWithheld > 0) {
      warnings.push(
        `Capital gains add to earnings: $${Math.round(earningsResult.value.amountWithheld).toLocaleString()} SS withheld`
      )
    }
  }

  // Provisional income impact
  const provResult = calcProvisionalIncome({
    ssBenefits: primaryMember.ssBenefits ?? 0,
    taxablePensions: primaryMember.taxablePensions ?? 0,
    wages: primaryMember.wages ?? 0,
    interestDividends: (primaryMember.interestDividends ?? 0) + (portfolioLtcg.value.gain > 0 ? portfolioLtcg.value.gain : 0),
    iraDistributions: primaryMember.iraDistributions ?? 0,
  })
  toolsUsed.push('calc-provisional-income')

  const applicable = nqAccounts.length > 0

  return {
    success: true,
    result: {
      type: 'tax_harvesting',
      applicable,
      summary: `$${Math.round(totalNqValue).toLocaleString()} NQ portfolio with $${Math.round(unrealizedGain).toLocaleString()} unrealized gain. Optimal lot selection minimizes tax to ${lotAnalyses[0]?.effectiveTaxRate ?? 0}%.`,
      findings,
      recommendation:
        totalLoss > 0
          ? `Harvest $${Math.round(totalLoss).toLocaleString()} in losses first to offset gains. Then sell lowest-gain lots to reach target. $3,000 ordinary deduction applies.`
          : `Sell lowest-gain lots first to minimize tax. Full liquidation at ${((portfolioLtcg.value.tax / totalNqValue) * 100).toFixed(1)}% effective rate.`,
      metrics: {
        nqAccountCount: nqAccounts.length,
        iraAccountCount: iraAccounts.length,
        totalNqValue,
        totalCostBasis,
        unrealizedGain,
        totalLossPositions: totalLoss,
        fullLiquidationTax: portfolioLtcg.value.tax,
        fullLiquidationRate: totalNqValue > 0 ? Math.round((portfolioLtcg.value.tax / totalNqValue) * 10000) / 100 : 0,
      },
      details: {
        lotAnalyses,
        fullLiquidation: fullLiquidationResult,
        ssImpact,
        provisionalIncome: provResult.value.provisionalIncome,
        lossPositions: losses.map((a) => ({
          account: `${a.carrier} ${a.product} (${a.id})`,
          marketValue: a.accountValue,
          costBasis: a.costBasis ?? a.accountValue,
          loss: (a.costBasis ?? a.accountValue) - a.accountValue,
        })),
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
