/**
 * calc-ltc-phase-access
 * Map contracts to the 4-Phase LTC Access Framework (proprietary RPI).
 *
 * Phase I:   No qualification — Enhanced withdrawal (20% AV every-other-year)
 * Phase II:  ADL-triggered — Income multiplier (2x base income)
 * Phase III: ADL-triggered — Enhanced liquidity (full SV + enhanced income)
 * Phase IV:  Confinement/Terminal — Full account access (100% AV)
 *
 * Source: LTC Access Analysis (Connell), Claude.AI presentations
 */

import type { CalcResult, LtcContract, LtcPhaseRow, CalcLtcPhaseAccessResult } from './types'

export function calcLtcPhaseAccess(contracts: LtcContract[]): CalcResult<CalcLtcPhaseAccessResult> {
  const phases: LtcPhaseRow[] = []

  // Phase I: Enhanced Withdrawal (no qualification needed)
  const phaseIContracts = contracts.filter((c) => c.hasEnhancedWithdrawal)
  const phaseIAccess = phaseIContracts.reduce((sum, c) => {
    const pct = c.enhancedWithdrawalPercent ?? 0.20
    return sum + c.accountValue * pct
  }, 0)
  phases.push({
    phase: 'I',
    qualification: 'No qualification required',
    contracts: phaseIContracts.map((c) => c.id),
    annualAccess: Math.round(phaseIAccess * 100) / 100,
    description: 'Enhanced withdrawal (typically 20% of AV, every-other-year restriction)',
  })

  // Phase II: ADL-triggered income multiplier
  const phaseIIContracts = contracts.filter((c) => c.hasIncomeMultiplier)
  const phaseIIAccess = phaseIIContracts.reduce((sum, c) => {
    const factor = c.incomeMultiplierFactor ?? 2
    return sum + c.baseIncome * factor
  }, 0)
  phases.push({
    phase: 'II',
    qualification: 'ADL-triggered (2+ Activities of Daily Living)',
    contracts: phaseIIContracts.map((c) => c.id),
    annualAccess: Math.round(phaseIIAccess * 100) / 100,
    description: 'Income multiplier (typically 2x base income while ADL-qualified)',
  })

  // Phase III: ADL-triggered enhanced liquidity
  const phaseIIIContracts = contracts.filter((c) => c.hasEnhancedLiquidity)
  const phaseIIIAccess = phaseIIIContracts.reduce((sum, c) => sum + c.accountValue, 0)
  phases.push({
    phase: 'III',
    qualification: 'ADL-triggered (enhanced liquidity)',
    contracts: phaseIIIContracts.map((c) => c.id),
    annualAccess: Math.round(phaseIIIAccess * 100) / 100,
    description: 'Full surrender value + enhanced income (carrier-specific)',
  })

  // Phase IV: Terminal/confinement waiver
  const phaseIVContracts = contracts.filter((c) => c.hasTerminalWaiver)
  const phaseIVAccess = phaseIVContracts.reduce((sum, c) => sum + c.accountValue, 0)
  phases.push({
    phase: 'IV',
    qualification: 'Terminal illness or confinement waiver',
    contracts: phaseIVContracts.map((c) => c.id),
    annualAccess: Math.round(phaseIVAccess * 100) / 100,
    description: 'Full account value access (100% AV, no surrender charges)',
  })

  const totalAnnualFees = Math.round(contracts.reduce((sum, c) => sum + c.annualFees, 0) * 100) / 100
  const totalLtcPool = Math.round(
    phases.reduce((sum, p) => sum + p.annualAccess, 0) * 100
  ) / 100

  return {
    value: { phases, totalAnnualFees, totalLtcPool },
    breakdown: { contractCount: contracts.length, totalAnnualFees, totalLtcPool },
  }
}
