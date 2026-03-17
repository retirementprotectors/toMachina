/**
 * QUE Calc + Lookup Tool Library — Shared Types
 *
 * Every calc tool returns CalcResult<T> wrapping a typed result.
 * Every lookup tool returns typed data or undefined.
 * All functions are PURE — no Firestore, no API, no async.
 */

// ---------------------------------------------------------------------------
// Generic wrapper
// ---------------------------------------------------------------------------

export interface CalcResult<T> {
  value: T
  breakdown?: Record<string, number>
  notes?: string[]
}

// ---------------------------------------------------------------------------
// Filing / Tax enums
// ---------------------------------------------------------------------------

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'widow'

export interface TaxBracket {
  /** Lower bound (inclusive) */
  min: number
  /** Upper bound (exclusive, Infinity for top bracket) */
  max: number
  /** Marginal rate as decimal (e.g. 0.22) */
  rate: number
}

// ---------------------------------------------------------------------------
// Calc-RMD
// ---------------------------------------------------------------------------

export interface CalcRmdInput {
  /** Owner age as of Dec 31 of RMD year */
  age: number
  /** Fair market value of account as of Dec 31 of prior year */
  priorYearValue: number
}

export interface CalcRmdResult {
  rmd: number
  factor: number
}

// ---------------------------------------------------------------------------
// Calc-GMIB
// ---------------------------------------------------------------------------

export interface CalcGmibInput {
  /** Current benefit base */
  benefitBase: number
  /** Payout rate as decimal (e.g. 0.0658 for 6.58%) */
  payoutRate: number
}

export interface CalcGmibResult {
  annualIncome: number
  monthlyIncome: number
}

// ---------------------------------------------------------------------------
// Calc-Rollup
// ---------------------------------------------------------------------------

export interface CalcRollupInput {
  /** Starting benefit base */
  startingBase: number
  /** Annual rollup rate as decimal */
  rollupRate: number
  /** Number of years to project */
  years: number
  /** 'simple' or 'compound' (default: simple) */
  method?: 'simple' | 'compound'
}

export interface CalcRollupYearRow {
  year: number
  benefitBase: number
  growth: number
}

export interface CalcRollupResult {
  finalBase: number
  totalGrowth: number
  schedule: CalcRollupYearRow[]
}

// ---------------------------------------------------------------------------
// Calc-Surrender-Charge
// ---------------------------------------------------------------------------

export interface CalcSurrenderChargeInput {
  /** Current account value */
  accountValue: number
  /** Surrender charge percentage as decimal */
  chargePercent: number
  /** Optional: free withdrawal percentage (default 10%) */
  freeWithdrawalPercent?: number
}

export interface CalcSurrenderChargeResult {
  grossCharge: number
  freeWithdrawal: number
  netCharge: number
  netSurrenderValue: number
}

// ---------------------------------------------------------------------------
// Calc-LTCG
// ---------------------------------------------------------------------------

export interface CalcLtcgInput {
  /** Current market value */
  marketValue: number
  /** Original cost basis */
  costBasis: number
  /** Tax rate as decimal (default: 0.15 for most filers) */
  taxRate?: number
}

export interface CalcLtcgResult {
  gain: number
  tax: number
  netProceeds: number
}

// ---------------------------------------------------------------------------
// Calc-Bonus-Offset
// ---------------------------------------------------------------------------

export interface CalcBonusOffsetInput {
  /** Surrender charge cost */
  surrenderCost: number
  /** LTCG tax cost */
  ltcgCost: number
  /** Total deposits being moved */
  deposits: number
  /** Carrier bonus rate as decimal (e.g. 0.07 for 7%) */
  bonusRate: number
}

export interface CalcBonusOffsetResult {
  grossCost: number
  bonusCredit: number
  netCost: number
  /** True if bonus exceeds costs (net gain to client) */
  isNetGain: boolean
}

// ---------------------------------------------------------------------------
// Calc-Provisional-Income
// ---------------------------------------------------------------------------

export interface CalcProvisionalIncomeInput {
  /** Annual Social Security benefits */
  ssBenefits: number
  /** Taxable pensions */
  taxablePensions?: number
  /** Wages */
  wages?: number
  /** Interest and dividends */
  interestDividends?: number
  /** IRA distributions / conversions */
  iraDistributions?: number
  /** Tax-exempt income */
  taxExemptIncome?: number
}

export interface CalcProvisionalIncomeResult {
  provisionalIncome: number
  halfSS: number
  otherIncome: number
}

// ---------------------------------------------------------------------------
// Calc-SS-Taxation
// ---------------------------------------------------------------------------

export interface CalcSsTaxationInput {
  /** Annual Social Security benefits */
  ssBenefits: number
  /** Provisional income (from calc-provisional-income) */
  provisionalIncome: number
  /** Filing status (default: mfj) */
  filingStatus?: FilingStatus
}

export interface CalcSsTaxationResult {
  /** Dollar amount of SS that is taxable */
  taxableAmount: number
  /** Percentage of SS that is taxable (0, 50, or 85) */
  taxablePercent: number
  /** Bracket tier: 'exempt' | 'partial' | 'max' */
  tier: 'exempt' | 'partial' | 'max'
}

// ---------------------------------------------------------------------------
// Calc-Federal-Tax
// ---------------------------------------------------------------------------

export interface CalcFederalTaxInput {
  /** Gross taxable income (before standard deduction) */
  grossIncome: number
  /** Filing status (default: mfj) */
  filingStatus?: FilingStatus
  /** Custom standard deduction override */
  standardDeduction?: number
}

export interface CalcFederalTaxResult {
  taxableIncome: number
  federalTax: number
  effectiveRate: number
  marginalRate: number
  standardDeduction: number
}

// ---------------------------------------------------------------------------
// Calc-State-Tax
// ---------------------------------------------------------------------------

export interface CalcStateTaxInput {
  /** Taxable income */
  taxableIncome: number
  /** Two-letter state code (e.g. 'IA', 'CA') */
  state: string
  /** Whether income is from retirement distributions (IRA, pension, annuity, SS) */
  isRetirementIncome?: boolean
}

export interface CalcStateTaxResult {
  stateTax: number
  effectiveRate: number
  /** Note about state-specific rule (e.g. Iowa exemption) */
  note?: string
}

// ---------------------------------------------------------------------------
// Calc-IRMAA
// ---------------------------------------------------------------------------

export interface CalcIrmaaInput {
  /** Modified Adjusted Gross Income (MAGI) — 2 years prior */
  magi: number
  /** Filing status (default: mfj) */
  filingStatus?: FilingStatus
  /** Tax year for IRMAA brackets (default: 2025) */
  taxYear?: number
}

export interface CalcIrmaaResult {
  /** Monthly Part B surcharge */
  partBSurcharge: number
  /** Monthly Part D surcharge */
  partDSurcharge: number
  /** Annual total surcharge (both parts, per person) */
  annualSurcharge: number
  /** Tier label */
  tier: string
}

// ---------------------------------------------------------------------------
// Calc-SS-Earnings-Limit
// ---------------------------------------------------------------------------

export interface CalcSsEarningsLimitInput {
  /** Annual earnings */
  annualEarnings: number
  /** Annual SS benefit */
  annualBenefit: number
  /** Earnings limit (default: $22,320 for 2024 / $23,400 for 2025) */
  earningsLimit?: number
}

export interface CalcSsEarningsLimitResult {
  /** Amount withheld from SS */
  amountWithheld: number
  /** Amount above the limit */
  excessEarnings: number
  /** Net SS benefit after withholding */
  netBenefit: number
  /** Max earnings before any SS is withheld */
  maxEarningsNoWithhold: number
}

// ---------------------------------------------------------------------------
// Calc-Income-Multiplier
// ---------------------------------------------------------------------------

export interface CalcIncomeMultiplierInput {
  /** Age of the insured */
  age: number
  /** Annual income to insure */
  annualIncome: number
}

export interface CalcIncomeMultiplierResult {
  multiplier: number
  recommendedCoverage: number
}

// ---------------------------------------------------------------------------
// Calc-College-Funding
// ---------------------------------------------------------------------------

export interface CalcCollegeFundingInput {
  /** Current age of child */
  childAge: number
  /** Annual cost of college today (default: $35,331) */
  annualCostToday?: number
  /** Annual inflation rate (default: 0.068 = 6.80%) */
  inflationRate?: number
  /** Number of college years (default: 4) */
  collegeYears?: number
}

export interface CalcCollegeFundingResult {
  /** Total projected cost */
  totalCost: number
  /** Annual cost at college entry */
  annualCostAtEntry: number
  /** Years until college */
  yearsUntilCollege: number
}

// ---------------------------------------------------------------------------
// Calc-Net-Outlay
// ---------------------------------------------------------------------------

export interface CalcNetOutlayInput {
  /** Cumulative premium outlay */
  premiumOutlay: number
  /** Current cash value */
  cashValue: number
}

export interface CalcNetOutlayResult {
  netOutlay: number
  /** True if cash value exceeds premiums */
  isNetGain: boolean
}

// ---------------------------------------------------------------------------
// Calc-Breakeven-Equity
// ---------------------------------------------------------------------------

export interface CalcBreakevenEquityInput {
  /** Annual withdrawals */
  annualWithdrawals: number
  /** Annual fees */
  annualFees: number
  /** Annual income credits / growth */
  annualIncome: number
  /** Total portfolio value */
  portfolioValue: number
}

export interface CalcBreakevenEquityResult {
  /** Return rate needed to break even (as decimal) */
  breakevenRate: number
  /** Same as percentage */
  breakevenPercent: number
  /** Whether the required return is dangerously high (>7%) */
  isUnsustainable: boolean
}

// ---------------------------------------------------------------------------
// Calc-MVA
// ---------------------------------------------------------------------------

export interface CalcMvaInput {
  /** Account value */
  accountValue: number
  /** Surrender value */
  surrenderValue: number
  /** Free withdrawal percentage (default: 0.10) */
  freeWithdrawalPercent?: number
  /** Known surrender charge percentage (optional) */
  surrenderChargePercent?: number
}

export interface CalcMvaResult {
  /** Total penalty as percentage of AV */
  totalPenaltyPercent: number
  /** Dollar penalty */
  totalPenaltyDollar: number
  /** Free withdrawal available */
  freeWithdrawal: number
  /** Surrender charge component */
  surrenderChargeDollar: number
  /** Hidden MVA component (residual after free withdrawal + surrender charge) */
  hiddenMvaDollar: number
  hiddenMvaPercent: number
}

// ---------------------------------------------------------------------------
// Calc-MGSV
// ---------------------------------------------------------------------------

export interface CalcMgsvInput {
  /** Total premiums paid */
  totalPremiums: number
  /** Number of years held */
  yearsHeld: number
  /** Guaranteed interest rate (default: 0.03 = 3%) */
  guaranteedRate?: number
  /** MGSV percentage (default: 0.875 = 87.5%) */
  mgsvPercent?: number
}

export interface CalcMgsvResult {
  /** Minimum guaranteed surrender value */
  mgsv: number
  /** Accumulated value at guaranteed rate */
  accumulatedValue: number
}

// ---------------------------------------------------------------------------
// Calc-VA-Depletion
// ---------------------------------------------------------------------------

export interface CalcVaDepletionInput {
  /** Starting account value */
  startingValue: number
  /** Annual withdrawal amount */
  annualWithdrawal: number
  /** Gross return rate as decimal */
  grossReturn: number
  /** All-in fee rate as decimal (M+E+A + GMIB + GMDB) */
  totalFeeRate: number
  /** Number of years to project */
  years: number
}

export interface CalcVaDepletionYearRow {
  year: number
  startingValue: number
  withdrawal: number
  fees: number
  growth: number
  endingValue: number
}

export interface CalcVaDepletionResult {
  schedule: CalcVaDepletionYearRow[]
  /** Year account hits $0 (null if it doesn't deplete) */
  depletionYear: number | null
  finalValue: number
}

// ---------------------------------------------------------------------------
// Calc-FIA-Projection
// ---------------------------------------------------------------------------

export interface CalcFiaProjectionInput {
  /** Total deposits */
  deposits: number
  /** First year bonus as decimal (e.g. 0.07 for 7%) */
  firstYearBonus: number
  /** Hypothetical annual growth rate as decimal */
  hypoGrowthRate: number
  /** Number of years to project */
  years: number
  /** Annual withdrawal (default: 0) */
  annualWithdrawal?: number
  /** Annual fee rate as decimal (default: 0 for FIA) */
  annualFeeRate?: number
}

export interface CalcFiaProjectionYearRow {
  year: number
  startingValue: number
  withdrawal: number
  fees: number
  growth: number
  endingValue: number
}

export interface CalcFiaProjectionResult {
  schedule: CalcFiaProjectionYearRow[]
  finalValue: number
  totalGrowth: number
}

// ---------------------------------------------------------------------------
// Calc-Delta
// ---------------------------------------------------------------------------

export interface CalcDeltaInput {
  /** Year-by-year proposed values (e.g. FIA) */
  proposedValues: number[]
  /** Year-by-year current values (e.g. VA) */
  currentValues: number[]
}

export interface CalcDeltaYearRow {
  year: number
  proposedValue: number
  currentValue: number
  delta: number
  cumulativeDelta: number
}

export interface CalcDeltaResult {
  schedule: CalcDeltaYearRow[]
  totalDelta: number
  /** Year when proposed first exceeds current (1-indexed, null if never) */
  crossoverYear: number | null
}

// ---------------------------------------------------------------------------
// Calc-Lot-Selection
// ---------------------------------------------------------------------------

export interface TaxLot {
  /** Identifier for the lot */
  id: string
  /** Current market value */
  marketValue: number
  /** Cost basis */
  costBasis: number
  /** Optional: description */
  description?: string
}

export interface CalcLotSelectionInput {
  /** All available tax lots */
  lots: TaxLot[]
  /** Target liquidation amount */
  targetAmount: number
  /** Strategy: 'nq' (lowest gain first) or 'ira' (underperformers first) */
  strategy?: 'nq' | 'ira'
}

export interface SelectedLot extends TaxLot {
  gain: number
  gainPercent: number
  /** Amount to sell from this lot (may be partial) */
  sellAmount: number
  /** Tax on this lot's sale */
  estimatedTax: number
}

export interface CalcLotSelectionResult {
  selectedLots: SelectedLot[]
  totalProceeds: number
  totalGain: number
  totalTax: number
  effectiveTaxRate: number
  /** Remaining target not met (0 if fully met) */
  shortfall: number
}

// ---------------------------------------------------------------------------
// Calc-LTC-Phase-Access
// ---------------------------------------------------------------------------

export interface LtcContract {
  /** Contract identifier */
  id: string
  /** Carrier name */
  carrier: string
  /** Account value */
  accountValue: number
  /** Base income (GMIB or equivalent) */
  baseIncome: number
  /** Whether contract has enhanced withdrawal feature */
  hasEnhancedWithdrawal: boolean
  /** Enhanced withdrawal percent (default: 0.20) */
  enhancedWithdrawalPercent?: number
  /** Whether contract has income multiplier (e.g. 2x) */
  hasIncomeMultiplier: boolean
  /** Income multiplier factor (default: 2) */
  incomeMultiplierFactor?: number
  /** Whether contract has enhanced liquidity on ADL trigger */
  hasEnhancedLiquidity: boolean
  /** Whether contract has terminal/confinement waiver */
  hasTerminalWaiver: boolean
  /** Annual fees for this contract */
  annualFees: number
}

export interface LtcPhaseRow {
  phase: 'I' | 'II' | 'III' | 'IV'
  qualification: string
  contracts: string[]
  annualAccess: number
  description: string
}

export interface CalcLtcPhaseAccessResult {
  phases: LtcPhaseRow[]
  totalAnnualFees: number
  totalLtcPool: number
}

// ---------------------------------------------------------------------------
// Calc-Household-Aggregate
// ---------------------------------------------------------------------------

export interface HouseholdMember {
  name: string
  annualIncome: number
  investableAssets: number
  totalNetWorth: number
  accountCount: number
}

export interface CalcHouseholdAggregateResult {
  totalIncome: number
  totalInvestable: number
  totalNetWorth: number
  totalAccounts: number
  memberCount: number
}

// ---------------------------------------------------------------------------
// Calc-Effective-Tax-Rate
// ---------------------------------------------------------------------------

export interface CalcEffectiveTaxRateInput {
  federalTax: number
  stateTax: number
  grossIncome: number
}

export interface CalcEffectiveTaxRateResult {
  effectiveRate: number
  effectivePercent: number
  totalTax: number
}

// ---------------------------------------------------------------------------
// Lookup types
// ---------------------------------------------------------------------------

export interface IrsFactorResult {
  age: number
  factor: number
}

export interface CarrierProduct {
  carrier: string
  product: string
  type: string
  surrenderYears: number
  bonus?: number
  features: string[]
}

export interface IndexRate {
  indexName: string
  carrier: string
  product: string
  method: string
  cap: number
  participationRate: number
  spread: number
  fee: number
}

export interface SurrenderScheduleEntry {
  year: number
  chargePercent: number
}

export interface SurrenderSchedule {
  carrier: string
  product: string
  schedule: SurrenderScheduleEntry[]
}

export interface FycRate {
  carrier: string
  carrierCode: string
  targetPercent: number
  excessPercent: number
  preferred?: boolean
}

export interface IrmaaBracket {
  /** Lower MAGI bound (inclusive) */
  magiMin: number
  /** Upper MAGI bound (exclusive, Infinity for top) */
  magiMax: number
  /** Monthly Part B surcharge */
  partBMonthly: number
  /** Monthly Part D surcharge */
  partDMonthly: number
  /** Tier label */
  tier: string
}
