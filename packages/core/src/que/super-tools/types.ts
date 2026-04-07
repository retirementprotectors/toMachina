/**
 * QUE Super Tool Types
 *
 * Super tools compose calc-* and lookup-* tools from the QUE tool library.
 * Each ANALYZE_* super tool takes household + account data and returns
 * a structured AnalysisResult with findings and recommendations.
 *
 * All super tools are PURE — no Firestore, no API calls, no async.
 */

import type { CalcResult, HouseholdMember, FilingStatus } from '../tools/types'

// ---------------------------------------------------------------------------
// Input types for super tools
// ---------------------------------------------------------------------------

export interface SuperToolAccount {
  id: string
  type: 'fia' | 'va' | 'ira' | 'roth' | 'nq' | 'life' | 'cd' | 'bank' | 'advisory' | 'pension' | 'annuity' | 'other'
  carrier: string
  product: string
  accountValue: number
  surrenderValue?: number
  costBasis?: number
  taxStatus: 'ira' | 'roth' | 'nq' | 'inherited'
  /** Owner reference */
  owner: string
  /** Benefit base (GMIB/GLWB) */
  benefitBase?: number
  /** Payout rate for income rider */
  payoutRate?: number
  /** Rollup rate for deferred rider */
  rollupRate?: number
  /** Rollup method */
  rollupMethod?: 'simple' | 'compound'
  /** Years remaining on rollup */
  rollupYearsRemaining?: number
  /** Whether income rider is activated */
  riderActivated?: boolean
  /** Death benefit amount */
  deathBenefit?: number
  /** Cash value (life insurance) */
  cashValue?: number
  /** Annual premium (life insurance) */
  annualPremium?: number
  /** Guaranteed lapse age */
  guaranteedLapseAge?: number
  /** Total all-in fee rate (M+E+A + rider fees) */
  totalFeeRate?: number
  /** Gross return assumption */
  grossReturn?: number
  /** Annual withdrawal amount */
  annualWithdrawal?: number
  /** First year bonus rate */
  firstYearBonus?: number
  /** Surrender charge percent (current year) */
  surrenderChargePercent?: number
  /** Carrier bonus rate for new money */
  bonusRate?: number
  /** LTC features */
  hasEnhancedWithdrawal?: boolean
  enhancedWithdrawalPercent?: number
  hasIncomeMultiplier?: boolean
  incomeMultiplierFactor?: number
  hasEnhancedLiquidity?: boolean
  hasTerminalWaiver?: boolean
  /** Annual rider fees */
  annualFees?: number
  /** Base income for LTC/GMIB */
  baseIncome?: number
  /** Hypothetical growth rate for FIA projection */
  hypoGrowthRate?: number
}

export interface SuperToolHousehold {
  id: string
  members: SuperToolMember[]
  filingStatus: FilingStatus
  state: string
}

export interface SuperToolMember {
  name: string
  age: number
  annualIncome: number
  investableAssets: number
  totalNetWorth: number
  ssBenefits?: number
  taxablePensions?: number
  wages?: number
  interestDividends?: number
  iraDistributions?: number
  lifeExpectancy?: number
  dependents?: Dependent[]
  accounts: SuperToolAccount[]
}

export interface Dependent {
  name: string
  age: number
  relationship: 'child' | 'spouse' | 'other'
}

// ---------------------------------------------------------------------------
// Output types for super tools
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  type: CaseworkType
  applicable: boolean
  /** Short summary sentence for Tier 1 output */
  summary: string
  /** Key findings (bullet points) */
  findings: string[]
  /** Recommendation text */
  recommendation: string
  /** Structured metric data for templates */
  metrics: Record<string, number | string | boolean>
  /** Detailed breakdown data for Tier 2/3 templates */
  details: Record<string, unknown>
  /** Any warnings or caveats */
  warnings: string[]
}

export type CaseworkType =
  | 'life_discovery'
  | 'life_needs'
  | 'life_options'
  | 'life_presentation' | 'life_underwriting'
  // original types:
  | 'income_now'
  | 'income_later'
  | 'estate_max'
  | 'growth_max'
  | 'ltc_max'
  | 'mge_detailed'
  | 'roth_conversion'
  | 'tax_harvesting'

export interface SuperToolOutput {
  success: boolean
  result: AnalysisResult
  toolsUsed: string[]
  notes?: string[]
}

export interface MgeAnalysisOutput {
  success: boolean
  householdSummary: {
    totalIncome: number
    totalInvestable: number
    totalNetWorth: number
    totalAccounts: number
    memberCount: number
  }
  applicableTypes: CaseworkType[]
  analyses: AnalysisResult[]
  notes?: string[]
}
