/**
 * QUE Super Tools
 *
 * 12 ANALYZE_* super tools + GENERATE_CASEWORK + ASSEMBLE_OUTPUT
 * All compose calc-* and lookup-* tools from the QUE tool library.
 */

// Types
export type {
  SuperToolAccount,
  SuperToolHousehold,
  SuperToolMember,
  Dependent,
  AnalysisResult,
  CaseworkType,
  SuperToolOutput,
  MgeAnalysisOutput,
} from './types'

// Analysis super tools (8 core + 4 life & estate = 12)
export { analyzeIncomeNow } from './analyze-income-now'
export { analyzeIncomeLater } from './analyze-income-later'
export { analyzeEstate } from './analyze-estate'
export { analyzeGrowth } from './analyze-growth'
export { analyzeLtc } from './analyze-ltc'
export { analyzeRoth } from './analyze-roth'
export { analyzeTaxHarvest } from './analyze-tax-harvest'
export { analyzeMge } from './analyze-mge'

// Casework generation super tools (2)
export { generateCasework } from './generate-casework'
export type { CaseworkOutput, GenerateCaseworkResult } from './generate-casework'
export { assembleOutput } from './assemble-output'
export type { AssembledDocument, AssembleOutputResult } from './assemble-output'

// Life & Estate analysis super tools (4)
export { analyzeGroupGap } from './analyze-group-gap'
export { analyzeLifeNeed } from './analyze-life-need'
export { analyzeUnderwritingPath } from './analyze-underwriting-path'
export { analyzeLifeOptions } from './analyze-life-options'
export { generateLifeCasework } from './generate-life-casework'

// CSG MedSupp quote (TRK-EPIC-07)
export { quoteMedsupp } from './quote-medsupp'
export type {
  QuoteMedsuppInput,
  RawCsgQuote,
  NormalizedQuote,
  QuoteMedsuppResult,
} from './quote-medsupp'
