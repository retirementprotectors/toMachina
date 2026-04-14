/**
 * QUE Wires — Chain super tools in sequence.
 *
 * 14 wires:
 *   - 7 type-specific (ANALYZE_* → GENERATE_CASEWORK)
 *   - 1 full review (ANALYZE_MGE → GENERATE_CASEWORK for all types)
 *   - 1 meeting prep (ANALYZE_MGE → generate-meeting-prep)
 *   - 1 assembly (ASSEMBLE_OUTPUT → package all 5 outputs)
 *   - 4 life & estate (ANALYZE_GROUP_GAP / ANALYZE_LIFE_NEED / ANALYZE_UNDERWRITING_PATH / ANALYZE_LIFE_OPTIONS)
 */

// Types
export type {
  WireInput,
  WireResult,
  ReviewMeetingWireResult,
  AssembleB4WireResult,
} from './types'

// Type-specific wires (7)
export { wireIncomeNow } from './wire-income-now'
export { wireIncomeLater } from './wire-income-later'
export { wireEstateMax } from './wire-estate-max'
export { wireGrowthMax } from './wire-growth-max'
export { wireLtcMax } from './wire-ltc-max'
export { wireRothConversion } from './wire-roth-conversion'
export { wireTaxHarvest } from './wire-tax-harvest'

// Full review wire
export { wireMgeDetailed } from './wire-mge-detailed'
export type { MgeDetailedWireResult } from './wire-mge-detailed'

// Meeting prep wire
export { wireReviewMeeting } from './wire-review-meeting'
export type { ReviewMeetingInput } from './wire-review-meeting'

// Assembly wire
export { wireAssembleB4 } from './wire-assemble-b4'
export type { AssembleB4Input } from './wire-assemble-b4'

// Life & Estate wires (4)
export { wireLifeDiscovery } from './wire-life-discovery'
export { wireLifeNeeds } from './wire-life-needs'
export { wireLifeOptions } from './wire-life-options'
export { wireLifePresentation } from './wire-life-presentation'

// CSG MedSupp quote wire (TRK-EPIC-07)
export { wireMedsuppQuote, isAepBlackout } from './wire-medsupp-quote'
export type {
  MedsuppQuoteWireInput,
  MedsuppQuoteWireResult,
} from './wire-medsupp-quote'
