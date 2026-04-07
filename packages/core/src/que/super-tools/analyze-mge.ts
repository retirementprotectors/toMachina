/**
 * ANALYZE_MGE — Super Tool (TRK-13390)
 *
 * Master Gateway Evaluation: the orchestrator that runs all 7 ANALYZE_*
 * super tools and determines which casework types are applicable.
 *
 * Calc tools used:
 *   1. calc-household-aggregate → Full household financial snapshot
 *   2. [detect applicable types] → Which of the 8 types are relevant?
 *   3. [call relevant ANALYZE_*] → Run each applicable analysis
 *
 * Output: Household summary + list of applicable casework types with preliminary findings
 */

import type { SuperToolHousehold, MgeAnalysisOutput, CaseworkType, AnalysisResult } from './types'
import { calcHouseholdAggregate } from '../tools/calc-household-aggregate'
import type { HouseholdMember } from '../tools/types'
import { analyzeIncomeNow } from './analyze-income-now'
import { analyzeIncomeLater } from './analyze-income-later'
import { analyzeEstate } from './analyze-estate'
import { analyzeGrowth } from './analyze-growth'
import { analyzeLtc } from './analyze-ltc'
import { analyzeRoth } from './analyze-roth'
import { analyzeTaxHarvest } from './analyze-tax-harvest'

/**
 * Detect which casework types are applicable based on household data.
 * Returns types sorted by priority (most impactful first).
 */
function detectApplicableTypes(household: SuperToolHousehold): CaseworkType[] {
  const types: CaseworkType[] = []
  const allAccounts = household.members.flatMap((m) => m.accounts)

  // Income NOW: dormant income riders
  const hasDormantRiders = allAccounts.some(
    (a) => a.benefitBase && a.payoutRate && !a.riderActivated
  )
  if (hasDormantRiders) types.push('income_now')

  // Income LATER: rollup opportunities
  const hasRollup = allAccounts.some(
    (a) => a.rollupRate && a.rollupRate > 0 && !a.riderActivated
  )
  if (hasRollup) types.push('income_later')

  // Estate MAX: life policies or VA with death benefit
  const hasLifePolicies = allAccounts.some((a) => a.type === 'life')
  const hasVaDb = allAccounts.some((a) => a.type === 'va' && a.deathBenefit && a.deathBenefit > 0)
  if (hasLifePolicies || hasVaDb) types.push('estate_max')

  // Growth MAX: VA accounts or idle CDs/bank
  const hasVa = allAccounts.some((a) => a.type === 'va' && a.accountValue > 0)
  const hasIdleCash = allAccounts.some(
    (a) => (a.type === 'cd' || a.type === 'bank') && a.accountValue > 10_000
  )
  if (hasVa || hasIdleCash) types.push('growth_max')

  // LTC MAX: contracts with LTC features
  const hasLtcFeatures = allAccounts.some(
    (a) => a.hasEnhancedWithdrawal || a.hasIncomeMultiplier || a.hasEnhancedLiquidity || a.hasTerminalWaiver
  )
  if (hasLtcFeatures) types.push('ltc_max')

  // Roth Conversion: traditional IRA balances
  const hasTraditionalIra = allAccounts.some(
    (a) => a.taxStatus === 'ira' && a.accountValue > 0
  )
  if (hasTraditionalIra) types.push('roth_conversion')

  // Tax Harvesting: NQ accounts with cost basis
  const hasNqPositions = allAccounts.some(
    (a) => a.taxStatus === 'nq' && a.accountValue > 0 && a.costBasis !== undefined
  )
  if (hasNqPositions) types.push('tax_harvesting')

  return types
}

export function analyzeMge(household: SuperToolHousehold): MgeAnalysisOutput {
  const notes: string[] = []

  // 1. Aggregate household financials
  const members: HouseholdMember[] = household.members.map((m) => ({
    name: m.name,
    annualIncome: m.annualIncome,
    investableAssets: m.investableAssets,
    totalNetWorth: m.totalNetWorth,
    accountCount: m.accounts.length,
  }))
  const aggResult = calcHouseholdAggregate(members)
  const agg = aggResult.value

  // 2. Detect applicable types
  const applicableTypes = detectApplicableTypes(household)

  if (applicableTypes.length === 0) {
    notes.push('No casework types detected as applicable based on household portfolio data.')
  } else {
    notes.push(`${applicableTypes.length} casework type(s) detected: ${applicableTypes.join(', ')}`)
  }

  // 3. Run each applicable analysis
  const analyses: AnalysisResult[] = []
  const typeRunners: Record<CaseworkType, (h: SuperToolHousehold) => { result: AnalysisResult }> = {
    income_now: analyzeIncomeNow,
    income_later: analyzeIncomeLater,
    estate_max: analyzeEstate,
    growth_max: analyzeGrowth,
    ltc_max: analyzeLtc,
    roth_conversion: analyzeRoth,
    tax_harvesting: analyzeTaxHarvest,
    life_discovery: (h: SuperToolHousehold) => ({ result: { type: 'life_discovery' as const, applicable: false, summary: 'Life discovery — run via WIRE_LIFE_DISCOVERY', findings: [], recommendation: ''  , metrics: {}, details: {}, warnings: [] } }),
    life_needs: (h: SuperToolHousehold) => ({ result: { type: 'life_needs' as const, applicable: false, summary: 'Life needs — run via WIRE_LIFE_NEEDS', findings: [], recommendation: ''  , metrics: {}, details: {}, warnings: [] } }),
    life_options: (h: SuperToolHousehold) => ({ result: { type: 'life_options' as const, applicable: false, summary: 'Life options — run via WIRE_LIFE_OPTIONS', findings: [], recommendation: ''  , metrics: {}, details: {}, warnings: [] } }),
    life_presentation: (h: SuperToolHousehold) => ({ result: { type: 'life_presentation' as const, applicable: false, summary: 'Life presentation — run via WIRE_LIFE_PRESENTATION', findings: [], recommendation: ''  , metrics: {}, details: {}, warnings: [] } }),
    mge_detailed: () => ({
      result: {
        type: 'mge_detailed' as const,
        applicable: true,
        summary: 'Full MGE analysis — see individual type analyses.',
        findings: [],
        recommendation: 'Review all applicable casework types.',
        metrics: {},
        details: {},
        warnings: [],
      },
    }),
  }

  for (const type of applicableTypes) {
    const runner = typeRunners[type]
    if (runner) {
      const output = runner(household)
      analyses.push(output.result)
    }
  }

  return {
    success: true,
    householdSummary: {
      totalIncome: agg.totalIncome,
      totalInvestable: agg.totalInvestable,
      totalNetWorth: agg.totalNetWorth,
      totalAccounts: agg.totalAccounts,
      memberCount: agg.memberCount,
    },
    applicableTypes,
    analyses,
    notes,
  }
}
