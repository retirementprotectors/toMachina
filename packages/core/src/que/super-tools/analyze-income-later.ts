/**
 * ANALYZE_INCOME_LATER — Super Tool (TRK-13384)
 *
 * Models the advantage of deferring income rider activation for rollup growth.
 * Produces a 3-option framework per the GMIB-to-Life process.
 *
 * Calc tools used:
 *   1. calc-rollup             → Project benefit base growth by deferral year
 *   2. calc-gmib               → Payout at each future activation age
 *   3. calc-provisional-income  → Tax impact of future GMIB distributions
 *   4. calc-federal-tax        → Bracket impact of additional income
 *
 * Output: Roll-up advantage table, 3-option framework, tax math per option
 */

import type { SuperToolHousehold, SuperToolOutput, SuperToolAccount } from './types'
import { calcRollup } from '../tools/calc-rollup'
import { calcGmib } from '../tools/calc-gmib'
import { calcProvisionalIncome } from '../tools/calc-provisional-income'
import { calcFederalTax } from '../tools/calc-federal-tax'

interface RollupProjection {
  account: string
  carrier: string
  currentBase: number
  rollupRate: number
  method: 'simple' | 'compound'
  currentIncome: number
  projections: Array<{
    yearsDeferred: number
    futureBase: number
    futureIncome: number
    additionalIncome: number
  }>
}

export function analyzeIncomeLater(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  // Find accounts with rollup opportunities (dormant riders with rollup rate)
  const allAccounts = household.members.flatMap((m) => m.accounts)
  const rollupAccounts = allAccounts.filter(
    (a) =>
      a.benefitBase &&
      a.payoutRate &&
      a.rollupRate &&
      a.rollupRate > 0 &&
      !a.riderActivated &&
      (a.rollupYearsRemaining === undefined || a.rollupYearsRemaining > 0)
  )

  if (rollupAccounts.length === 0) {
    return {
      success: true,
      result: {
        type: 'income_later',
        applicable: false,
        summary: 'No deferred income rider rollup opportunities detected.',
        findings: ['All income riders are either activated or have no remaining rollup period.'],
        recommendation: 'Consider INCOME NOW analysis for immediate activation.',
        metrics: { rollupAccountCount: 0 },
        details: {},
        warnings: [],
      },
      toolsUsed: [],
    }
  }

  // Build rollup projections for each account
  const projections: RollupProjection[] = []
  let totalCurrentIncome = 0
  let bestAdditionalIncome = 0

  for (const acct of rollupAccounts) {
    const maxYears = acct.rollupYearsRemaining ?? 5
    const rollupResult = calcRollup({
      startingBase: acct.benefitBase!,
      rollupRate: acct.rollupRate!,
      years: maxYears,
      method: acct.rollupMethod ?? 'simple',
    })
    toolsUsed.push('calc-rollup')

    // Current income if activated now
    const currentGmib = calcGmib({ benefitBase: acct.benefitBase!, payoutRate: acct.payoutRate! })
    toolsUsed.push('calc-gmib')
    totalCurrentIncome += currentGmib.value.annualIncome

    // Future income at each deferral year
    const yearProjections: RollupProjection['projections'] = []
    for (const row of rollupResult.value.schedule) {
      const futureGmib = calcGmib({ benefitBase: row.benefitBase, payoutRate: acct.payoutRate! })
      const additional = futureGmib.value.annualIncome - currentGmib.value.annualIncome
      yearProjections.push({
        yearsDeferred: row.year,
        futureBase: row.benefitBase,
        futureIncome: futureGmib.value.annualIncome,
        additionalIncome: additional,
      })
      if (additional > bestAdditionalIncome) {
        bestAdditionalIncome = additional
      }
    }

    projections.push({
      account: `${acct.carrier} ${acct.product} (${acct.id})`,
      carrier: acct.carrier,
      currentBase: acct.benefitBase!,
      rollupRate: acct.rollupRate!,
      method: acct.rollupMethod ?? 'simple',
      currentIncome: currentGmib.value.annualIncome,
      projections: yearProjections,
    })
  }

  findings.push(
    `${rollupAccounts.length} account(s) with active rollup opportunity`
  )
  findings.push(
    `Current guaranteed income if activated now: $${Math.round(totalCurrentIncome).toLocaleString()}/year`
  )
  if (bestAdditionalIncome > 0) {
    findings.push(
      `Maximum additional income from deferral: $${Math.round(bestAdditionalIncome).toLocaleString()}/year`
    )
  }

  // Tax analysis for the primary member with the rollup accounts
  const primaryMember = household.members.find((m) =>
    m.accounts.some((a) => rollupAccounts.includes(a))
  )

  let taxAnalysis: Record<string, unknown> = {}
  if (primaryMember) {
    // Current provisional income without GMIB
    const currentProv = calcProvisionalIncome({
      ssBenefits: primaryMember.ssBenefits ?? 0,
      taxablePensions: primaryMember.taxablePensions ?? 0,
      wages: primaryMember.wages ?? 0,
      interestDividends: primaryMember.interestDividends ?? 0,
      iraDistributions: primaryMember.iraDistributions ?? 0,
    })
    toolsUsed.push('calc-provisional-income')

    // Provisional income WITH GMIB added as IRA distribution
    const withGmibProv = calcProvisionalIncome({
      ssBenefits: primaryMember.ssBenefits ?? 0,
      taxablePensions: primaryMember.taxablePensions ?? 0,
      wages: primaryMember.wages ?? 0,
      interestDividends: primaryMember.interestDividends ?? 0,
      iraDistributions: (primaryMember.iraDistributions ?? 0) + totalCurrentIncome,
    })

    // Federal tax comparison
    const currentTax = calcFederalTax({
      grossIncome: primaryMember.annualIncome,
      filingStatus: household.filingStatus,
    })
    toolsUsed.push('calc-federal-tax')

    const withGmibTax = calcFederalTax({
      grossIncome: primaryMember.annualIncome + totalCurrentIncome,
      filingStatus: household.filingStatus,
    })

    const additionalTax = withGmibTax.value.federalTax - currentTax.value.federalTax
    const netAfterTax = totalCurrentIncome - additionalTax

    taxAnalysis = {
      currentProvisionalIncome: currentProv.value.provisionalIncome,
      withGmibProvisionalIncome: withGmibProv.value.provisionalIncome,
      currentMarginalRate: currentTax.value.marginalRate,
      withGmibMarginalRate: withGmibTax.value.marginalRate,
      additionalFederalTax: additionalTax,
      netIncomeAfterTax: netAfterTax,
      bracketJump: withGmibTax.value.marginalRate > currentTax.value.marginalRate,
    }

    if (withGmibTax.value.marginalRate > currentTax.value.marginalRate) {
      warnings.push(
        `GMIB activation would push from ${(currentTax.value.marginalRate * 100).toFixed(0)}% to ${(withGmibTax.value.marginalRate * 100).toFixed(0)}% marginal bracket`
      )
    }

    findings.push(
      `Net income after tax: $${Math.round(netAfterTax).toLocaleString()}/year (${((additionalTax / totalCurrentIncome) * 100).toFixed(1)}% effective tax on GMIB)`
    )
  }

  // Build 3-option framework
  const bestProjection = projections[0]
  const oneYearDeferred = bestProjection?.projections[0]
  const threeOptions = {
    optionA: {
      strategy: 'Activate Now',
      annualIncome: totalCurrentIncome,
      description: 'Start guaranteed income immediately. Taxes from bank reserves.',
    },
    optionB: {
      strategy: 'Wait + Net of Taxes',
      annualIncome: oneYearDeferred ? oneYearDeferred.futureIncome : totalCurrentIncome,
      description: 'Defer 1+ years for rollup growth. GMIB net of taxes funds premium or spending.',
    },
    optionC: {
      strategy: 'Wait + Full GMIB',
      annualIncome: oneYearDeferred ? oneYearDeferred.futureIncome : totalCurrentIncome,
      description: 'Defer 1+ years. Full GMIB to premium or spending, taxes from bank reserves.',
    },
  }

  return {
    success: true,
    result: {
      type: 'income_later',
      applicable: true,
      summary: `${rollupAccounts.length} account(s) can gain $${Math.round(bestAdditionalIncome).toLocaleString()}/year in additional guaranteed income by deferring activation.`,
      findings,
      recommendation:
        bestAdditionalIncome > 5000
          ? 'Strong rollup opportunity. Recommend deferring activation for at least 1 year to capture additional guaranteed income.'
          : 'Modest rollup benefit. Evaluate whether deferral advantage justifies waiting vs. immediate income need.',
      metrics: {
        rollupAccountCount: rollupAccounts.length,
        currentGuaranteedIncome: totalCurrentIncome,
        bestAdditionalIncome,
        maxDeferralYears: Math.max(...rollupAccounts.map((a) => a.rollupYearsRemaining ?? 5)),
      },
      details: {
        projections,
        taxAnalysis,
        threeOptions,
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
