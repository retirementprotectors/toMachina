/**
 * ANALYZE_ROTH — Super Tool (TRK-13388)
 *
 * Models Roth conversion impact on tax brackets, SS taxation, and IRMAA.
 * Runs before/after comparison at multiple conversion amounts.
 *
 * Calc tools used:
 *   1. calc-provisional-income → Current MAGI without conversion
 *   2. calc-ss-taxation        → Current SS taxation bracket
 *   3. calc-federal-tax        → Current effective rate
 *   4. calc-irmaa              → Current IRMAA impact
 *   5. [simulate conversion amount]
 *   6. calc-provisional-income → MAGI WITH conversion added
 *   7. calc-federal-tax        → New effective rate + bracket jump
 *   8. calc-irmaa              → New IRMAA impact (2-year lag)
 *
 * Output: Before/after tax comparison, bracket jump warning, IRMAA cliff, break-even year
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcProvisionalIncome } from '../tools/calc-provisional-income'
import { calcSsTaxation } from '../tools/calc-ss-taxation'
import { calcFederalTax } from '../tools/calc-federal-tax'
import { calcIrmaa } from '../tools/calc-irmaa'

interface ConversionScenario {
  conversionAmount: number
  beforeTax: {
    provisionalIncome: number
    ssTaxablePercent: number
    federalTax: number
    marginalRate: number
    effectiveRate: number
    irmaaSurcharge: number
  }
  afterTax: {
    provisionalIncome: number
    ssTaxablePercent: number
    federalTax: number
    marginalRate: number
    effectiveRate: number
    irmaaSurcharge: number
  }
  additionalTax: number
  additionalIrmaa: number
  totalConversionCost: number
  effectiveConversionRate: number
  bracketJump: boolean
  irmaaCliff: boolean
}

export function analyzeRoth(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const allAccounts = household.members.flatMap((m) => m.accounts)
  const iraAccounts = allAccounts.filter((a) => a.taxStatus === 'ira')
  const totalIraBalance = iraAccounts.reduce((sum, a) => sum + a.accountValue, 0)

  if (totalIraBalance === 0) {
    return {
      success: true,
      result: {
        type: 'roth_conversion',
        applicable: false,
        summary: 'No traditional IRA balances available for Roth conversion.',
        findings: [],
        recommendation: 'No Roth conversion opportunity at this time.',
        metrics: { totalIraBalance: 0 },
        details: {},
        warnings: [],
      },
      toolsUsed: [],
    }
  }

  findings.push(`Total traditional IRA balance: $${Math.round(totalIraBalance).toLocaleString()}`)

  // Use primary member (or highest income member) for tax analysis
  const primaryMember = household.members.reduce((a, b) =>
    a.annualIncome >= b.annualIncome ? a : b
  )

  // BEFORE conversion analysis
  const beforeProv = calcProvisionalIncome({
    ssBenefits: primaryMember.ssBenefits ?? 0,
    taxablePensions: primaryMember.taxablePensions ?? 0,
    wages: primaryMember.wages ?? 0,
    interestDividends: primaryMember.interestDividends ?? 0,
    iraDistributions: primaryMember.iraDistributions ?? 0,
  })
  toolsUsed.push('calc-provisional-income')

  const beforeSsTax = calcSsTaxation({
    ssBenefits: primaryMember.ssBenefits ?? 0,
    provisionalIncome: beforeProv.value.provisionalIncome,
    filingStatus: household.filingStatus,
  })
  toolsUsed.push('calc-ss-taxation')

  const beforeFedTax = calcFederalTax({
    grossIncome: primaryMember.annualIncome,
    filingStatus: household.filingStatus,
  })
  toolsUsed.push('calc-federal-tax')

  const beforeIrmaa = calcIrmaa({
    magi: primaryMember.annualIncome,
    filingStatus: household.filingStatus,
  })
  toolsUsed.push('calc-irmaa')

  // Model multiple conversion scenarios
  const conversionAmounts = [25_000, 50_000, 75_000, 100_000, 150_000]
    .filter((amt) => amt <= totalIraBalance)

  if (conversionAmounts.length === 0) {
    conversionAmounts.push(totalIraBalance)
  }

  const scenarios: ConversionScenario[] = []

  for (const amount of conversionAmounts) {
    // AFTER conversion analysis
    const afterProv = calcProvisionalIncome({
      ssBenefits: primaryMember.ssBenefits ?? 0,
      taxablePensions: primaryMember.taxablePensions ?? 0,
      wages: primaryMember.wages ?? 0,
      interestDividends: primaryMember.interestDividends ?? 0,
      iraDistributions: (primaryMember.iraDistributions ?? 0) + amount,
    })

    const afterSsTax = calcSsTaxation({
      ssBenefits: primaryMember.ssBenefits ?? 0,
      provisionalIncome: afterProv.value.provisionalIncome,
      filingStatus: household.filingStatus,
    })

    const afterFedTax = calcFederalTax({
      grossIncome: primaryMember.annualIncome + amount,
      filingStatus: household.filingStatus,
    })

    const afterIrmaa = calcIrmaa({
      magi: primaryMember.annualIncome + amount,
      filingStatus: household.filingStatus,
    })

    const additionalTax = afterFedTax.value.federalTax - beforeFedTax.value.federalTax
    const additionalIrmaa = afterIrmaa.value.annualSurcharge - beforeIrmaa.value.annualSurcharge
    const totalCost = additionalTax + additionalIrmaa
    const effectiveRate = amount > 0 ? Math.round((totalCost / amount) * 10000) / 100 : 0
    const bracketJump = afterFedTax.value.marginalRate > beforeFedTax.value.marginalRate
    const irmaaCliff = afterIrmaa.value.tier !== beforeIrmaa.value.tier

    scenarios.push({
      conversionAmount: amount,
      beforeTax: {
        provisionalIncome: beforeProv.value.provisionalIncome,
        ssTaxablePercent: beforeSsTax.value.taxablePercent,
        federalTax: beforeFedTax.value.federalTax,
        marginalRate: beforeFedTax.value.marginalRate,
        effectiveRate: beforeFedTax.value.effectiveRate,
        irmaaSurcharge: beforeIrmaa.value.annualSurcharge,
      },
      afterTax: {
        provisionalIncome: afterProv.value.provisionalIncome,
        ssTaxablePercent: afterSsTax.value.taxablePercent,
        federalTax: afterFedTax.value.federalTax,
        marginalRate: afterFedTax.value.marginalRate,
        effectiveRate: afterFedTax.value.effectiveRate,
        irmaaSurcharge: afterIrmaa.value.annualSurcharge,
      },
      additionalTax,
      additionalIrmaa,
      totalConversionCost: totalCost,
      effectiveConversionRate: effectiveRate,
      bracketJump,
      irmaaCliff,
    })

    if (bracketJump) {
      warnings.push(
        `$${amount.toLocaleString()} conversion jumps from ${(beforeFedTax.value.marginalRate * 100).toFixed(0)}% to ${(afterFedTax.value.marginalRate * 100).toFixed(0)}% bracket`
      )
    }
    if (irmaaCliff) {
      warnings.push(
        `$${amount.toLocaleString()} conversion triggers IRMAA cliff: +$${Math.round(additionalIrmaa).toLocaleString()}/year surcharge (2-year lag)`
      )
    }
  }

  // Find optimal conversion (highest amount before bracket jump or IRMAA cliff)
  const safeScenarios = scenarios.filter((s) => !s.bracketJump && !s.irmaaCliff)
  const optimalScenario = safeScenarios.length > 0
    ? safeScenarios[safeScenarios.length - 1]
    : scenarios[0]

  findings.push(
    `Current marginal bracket: ${(beforeFedTax.value.marginalRate * 100).toFixed(0)}%`
  )
  findings.push(
    `Current SS taxation: ${beforeSsTax.value.taxablePercent}% of benefits taxable`
  )
  findings.push(
    `Current IRMAA tier: ${beforeIrmaa.value.tier} ($${Math.round(beforeIrmaa.value.annualSurcharge).toLocaleString()}/year)`
  )
  if (optimalScenario) {
    findings.push(
      `Optimal conversion: $${optimalScenario.conversionAmount.toLocaleString()} at ${optimalScenario.effectiveConversionRate}% effective tax rate`
    )
  }

  // Break-even estimation: years for tax-free growth to offset conversion cost
  const avgGrowthRate = 0.06
  const breakEvenYears = optimalScenario
    ? Math.ceil(
        Math.log(optimalScenario.conversionAmount / (optimalScenario.conversionAmount - optimalScenario.totalConversionCost)) /
        Math.log(1 + avgGrowthRate)
      )
    : 0

  if (breakEvenYears > 0) {
    findings.push(`Estimated break-even: ${breakEvenYears} years of tax-free Roth growth`)
  }

  return {
    success: true,
    result: {
      type: 'roth_conversion',
      applicable: true,
      summary: `$${Math.round(totalIraBalance).toLocaleString()} in traditional IRA balances. Optimal conversion of $${optimalScenario.conversionAmount.toLocaleString()} at ${optimalScenario.effectiveConversionRate}% effective rate.`,
      findings,
      recommendation:
        safeScenarios.length > 0
          ? `Convert up to $${optimalScenario.conversionAmount.toLocaleString()} without triggering bracket jump or IRMAA cliff. Break-even in ~${breakEvenYears} years.`
          : `Any conversion triggers bracket jump or IRMAA cliff. Smallest tested amount ($${scenarios[0].conversionAmount.toLocaleString()}) costs ${scenarios[0].effectiveConversionRate}% effective rate. Evaluate if long-term Roth benefits justify the upfront cost.`,
      metrics: {
        totalIraBalance,
        currentMarginalRate: beforeFedTax.value.marginalRate,
        currentIrmaaTier: beforeIrmaa.value.tier,
        optimalConversion: optimalScenario.conversionAmount,
        optimalEffectiveRate: optimalScenario.effectiveConversionRate,
        breakEvenYears,
        scenarioCount: scenarios.length,
      },
      details: {
        scenarios,
        currentTaxProfile: {
          provisionalIncome: beforeProv.value.provisionalIncome,
          ssTaxation: beforeSsTax.value,
          federalTax: beforeFedTax.value,
          irmaa: beforeIrmaa.value,
        },
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
