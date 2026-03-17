/**
 * QUE Calc + Lookup Tool Library
 *
 * 25 calc-* tools: Pure financial calculators for RPI casework
 * 8 lookup-* tools: Reference data lookups (IRS, carriers, tax, IRMAA)
 *
 * All functions are PURE — no Firestore, no API calls, no async.
 * Every formula sourced from production RPI case files.
 */

// --- Types ---
export type {
  CalcResult,
  FilingStatus,
  TaxBracket,
  CalcRmdInput,
  CalcRmdResult,
  CalcGmibInput,
  CalcGmibResult,
  CalcRollupInput,
  CalcRollupResult,
  CalcRollupYearRow,
  CalcSurrenderChargeInput,
  CalcSurrenderChargeResult,
  CalcLtcgInput,
  CalcLtcgResult,
  CalcBonusOffsetInput,
  CalcBonusOffsetResult,
  CalcProvisionalIncomeInput,
  CalcProvisionalIncomeResult,
  CalcSsTaxationInput,
  CalcSsTaxationResult,
  CalcFederalTaxInput,
  CalcFederalTaxResult,
  CalcStateTaxInput,
  CalcStateTaxResult,
  CalcIrmaaInput,
  CalcIrmaaResult,
  CalcSsEarningsLimitInput,
  CalcSsEarningsLimitResult,
  CalcIncomeMultiplierInput,
  CalcIncomeMultiplierResult,
  CalcCollegeFundingInput,
  CalcCollegeFundingResult,
  CalcNetOutlayInput,
  CalcNetOutlayResult,
  CalcBreakevenEquityInput,
  CalcBreakevenEquityResult,
  CalcMvaInput,
  CalcMvaResult,
  CalcMgsvInput,
  CalcMgsvResult,
  CalcVaDepletionInput,
  CalcVaDepletionResult,
  CalcVaDepletionYearRow,
  CalcFiaProjectionInput,
  CalcFiaProjectionResult,
  CalcFiaProjectionYearRow,
  CalcDeltaInput,
  CalcDeltaResult,
  CalcDeltaYearRow,
  TaxLot,
  CalcLotSelectionInput,
  CalcLotSelectionResult,
  SelectedLot,
  LtcContract,
  LtcPhaseRow,
  CalcLtcPhaseAccessResult,
  HouseholdMember,
  CalcHouseholdAggregateResult,
  CalcEffectiveTaxRateInput,
  CalcEffectiveTaxRateResult,
  IrsFactorResult,
  CarrierProduct,
  IndexRate,
  SurrenderScheduleEntry,
  SurrenderSchedule,
  FycRate,
  IrmaaBracket,
} from './types'

// --- Lookup Tools (8) ---
export { lookupIrsFactor } from './lookup-irs-factor'
export { lookupCarrierProduct } from './lookup-carrier-product'
export { lookupIndexRate } from './lookup-index-rate'
export { lookupSurrenderSchedule } from './lookup-surrender-schedule'
export { lookupFycRate } from './lookup-fyc-rate'
export { lookupTaxBracket } from './lookup-tax-bracket'
export type { TaxBracketLookupResult } from './lookup-tax-bracket'
export { lookupIrmaaBracket } from './lookup-irmaa-bracket'
export { lookupCommunityProperty } from './lookup-community-property'
export type { CommunityPropertyResult } from './lookup-community-property'

// --- Calc Tools (25) ---
export { calcRmd } from './calc-rmd'
export { calcGmib } from './calc-gmib'
export { calcRollup } from './calc-rollup'
export { calcSurrenderCharge } from './calc-surrender-charge'
export { calcLtcg } from './calc-ltcg'
export { calcBonusOffset } from './calc-bonus-offset'
export { calcProvisionalIncome } from './calc-provisional-income'
export { calcSsTaxation } from './calc-ss-taxation'
export { calcFederalTax } from './calc-federal-tax'
export { calcStateTax } from './calc-state-tax'
export { calcIrmaa } from './calc-irmaa'
export { calcSsEarningsLimit } from './calc-ss-earnings-limit'
export { calcIncomeMultiplier } from './calc-income-multiplier'
export { calcCollegeFunding } from './calc-college-funding'
export { calcNetOutlay } from './calc-net-outlay'
export { calcBreakevenEquity } from './calc-breakeven-equity'
export { calcMva } from './calc-mva'
export { calcMgsv } from './calc-mgsv'
export { calcVaDepletion } from './calc-va-depletion'
export { calcFiaProjection } from './calc-fia-projection'
export { calcDelta } from './calc-delta'
export { calcLotSelection } from './calc-lot-selection'
export { calcLtcPhaseAccess } from './calc-ltc-phase-access'
export { calcHouseholdAggregate } from './calc-household-aggregate'
export { calcEffectiveTaxRate } from './calc-effective-tax-rate'

// --- Data (re-export for direct access) ---
export * from './data'
