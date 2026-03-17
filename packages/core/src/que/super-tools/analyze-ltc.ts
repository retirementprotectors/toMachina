/**
 * ANALYZE_LTC — Super Tool (TRK-13387)
 *
 * Maps all contracts to the proprietary RPI 4-Phase LTC Access Framework.
 * Calculates total LTC pool, annual fees, and break-even analysis.
 *
 * Calc tools used:
 *   1. calc-ltc-phase-access   → Map all contracts to Phase I/II/III/IV
 *   2. calc-gmib               → Base income x 2x multiplier (Phase II)
 *   3. calc-mgsv               → Floor protection values
 *   4. lookup-carrier-product   → Which contracts have which LTC features
 *
 * Output: 4-phase access table, total LTC pool, annual fee analysis, break-even
 */

import type { SuperToolHousehold, SuperToolOutput } from './types'
import { calcLtcPhaseAccess } from '../tools/calc-ltc-phase-access'
import { calcGmib } from '../tools/calc-gmib'
import { calcMgsv } from '../tools/calc-mgsv'
import { lookupCarrierProduct } from '../tools/lookup-carrier-product'
import type { LtcContract } from '../tools/types'

export function analyzeLtc(household: SuperToolHousehold): SuperToolOutput {
  const toolsUsed: string[] = []
  const warnings: string[] = []
  const findings: string[] = []

  const allAccounts = household.members.flatMap((m) => m.accounts)

  // Build LTC contract list from accounts that have LTC features
  const ltcContracts: LtcContract[] = allAccounts
    .filter(
      (a) =>
        a.hasEnhancedWithdrawal ||
        a.hasIncomeMultiplier ||
        a.hasEnhancedLiquidity ||
        a.hasTerminalWaiver
    )
    .map((a) => ({
      id: a.id,
      carrier: a.carrier,
      accountValue: a.accountValue,
      baseIncome: a.baseIncome ?? 0,
      hasEnhancedWithdrawal: a.hasEnhancedWithdrawal ?? false,
      enhancedWithdrawalPercent: a.enhancedWithdrawalPercent,
      hasIncomeMultiplier: a.hasIncomeMultiplier ?? false,
      incomeMultiplierFactor: a.incomeMultiplierFactor,
      hasEnhancedLiquidity: a.hasEnhancedLiquidity ?? false,
      hasTerminalWaiver: a.hasTerminalWaiver ?? false,
      annualFees: a.annualFees ?? 0,
    }))

  if (ltcContracts.length === 0) {
    return {
      success: true,
      result: {
        type: 'ltc_max',
        applicable: false,
        summary: 'No contracts with LTC access features detected.',
        findings: [],
        recommendation: 'No existing LTC access pool. Consider hybrid life/LTC products for future planning.',
        metrics: { contractCount: 0, totalLtcPool: 0 },
        details: {},
        warnings: [],
      },
      toolsUsed: [],
    }
  }

  // 1. Run 4-phase access mapping
  const phaseResult = calcLtcPhaseAccess(ltcContracts)
  toolsUsed.push('calc-ltc-phase-access')

  const { phases, totalAnnualFees, totalLtcPool } = phaseResult.value

  findings.push(`${ltcContracts.length} contract(s) with LTC access features`)
  findings.push(`Total LTC access pool: $${Math.round(totalLtcPool).toLocaleString()}`)
  findings.push(`Total annual rider fees: $${Math.round(totalAnnualFees).toLocaleString()}`)

  for (const phase of phases) {
    if (phase.contracts.length > 0) {
      findings.push(
        `Phase ${phase.phase}: $${Math.round(phase.annualAccess).toLocaleString()}/year — ${phase.description}`
      )
    }
  }

  // 2. GMIB income with 2x multiplier analysis (Phase II detail)
  const multiplierContracts = ltcContracts.filter((c) => c.hasIncomeMultiplier)
  const multiplierDetails: Array<{
    contract: string
    baseIncome: number
    multipliedIncome: number
    factor: number
  }> = []

  for (const contract of multiplierContracts) {
    if (contract.baseIncome > 0) {
      const factor = contract.incomeMultiplierFactor ?? 2
      const gmibResult = calcGmib({
        benefitBase: contract.baseIncome / 0.06, // Estimate benefit base from income
        payoutRate: 0.06 * factor,
      })
      toolsUsed.push('calc-gmib')

      multiplierDetails.push({
        contract: `${contract.carrier} (${contract.id})`,
        baseIncome: contract.baseIncome,
        multipliedIncome: contract.baseIncome * factor,
        factor,
      })
    }
  }

  // 3. MGSV floor protection values
  const mgsvDetails: Array<{
    contract: string
    mgsv: number
    accountValue: number
    floorProtection: boolean
  }> = []

  for (const contract of ltcContracts) {
    // Estimate premiums and years for MGSV
    const estimatedPremiums = contract.accountValue * 0.85 // Rough estimate
    const estimatedYears = 7 // Average holding period
    const mgsvResult = calcMgsv({
      totalPremiums: estimatedPremiums,
      yearsHeld: estimatedYears,
    })
    toolsUsed.push('calc-mgsv')

    mgsvDetails.push({
      contract: `${contract.carrier} (${contract.id})`,
      mgsv: mgsvResult.value.mgsv,
      accountValue: contract.accountValue,
      floorProtection: mgsvResult.value.mgsv <= contract.accountValue,
    })
  }

  // 4. Carrier product lookup for feature verification
  const carrierDetails: Array<{ carrier: string; products: unknown[] }> = []
  const uniqueCarriers = [...new Set(ltcContracts.map((c) => c.carrier))]
  for (const carrier of uniqueCarriers) {
    const products = lookupCarrierProduct({ carrier })
    if (products.length > 0) {
      carrierDetails.push({ carrier, products })
      toolsUsed.push('lookup-carrier-product')
    }
  }

  // Fee break-even analysis
  const phaseII = phases.find((p) => p.phase === 'II')
  const breakEvenMonths = phaseII && phaseII.annualAccess > 0 && totalAnnualFees > 0
    ? Math.round((totalAnnualFees / (phaseII.annualAccess / 12)) * 10) / 10
    : null

  if (breakEvenMonths !== null) {
    findings.push(
      `Phase II multiplier break-even: ${breakEvenMonths} months of care to justify annual fees of $${Math.round(totalAnnualFees).toLocaleString()}`
    )
  }

  if (totalAnnualFees > totalLtcPool * 0.03) {
    warnings.push(
      `Annual LTC fees ($${Math.round(totalAnnualFees).toLocaleString()}) exceed 3% of total LTC pool — evaluate fee efficiency`
    )
  }

  return {
    success: true,
    result: {
      type: 'ltc_max',
      applicable: true,
      summary: `${ltcContracts.length} contract(s) provide $${Math.round(totalLtcPool).toLocaleString()} in LTC access across 4 phases. Annual fees: $${Math.round(totalAnnualFees).toLocaleString()}.`,
      findings,
      recommendation:
        totalAnnualFees > 0
          ? `LTC access pool is mapped. Break-even on Phase II multiplier: ${breakEvenMonths ?? 'N/A'} months. Annual fees are ${totalAnnualFees > totalLtcPool * 0.02 ? 'significant' : 'reasonable'} relative to coverage.`
          : 'LTC access mapped at no additional cost (features included in existing contracts).',
      metrics: {
        contractCount: ltcContracts.length,
        totalLtcPool,
        totalAnnualFees,
        breakEvenMonths: breakEvenMonths ?? 0,
        phaseIAccess: phases[0].annualAccess,
        phaseIIAccess: phases[1].annualAccess,
        phaseIIIAccess: phases[2].annualAccess,
        phaseIVAccess: phases[3].annualAccess,
      },
      details: {
        phases,
        multiplierDetails,
        mgsvDetails,
        carrierDetails,
      },
      warnings,
    },
    toolsUsed: [...new Set(toolsUsed)],
  }
}
