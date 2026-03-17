/**
 * QUE Super Tools
 *
 * 8 ANALYZE_* super tools + GENERATE_CASEWORK + ASSEMBLE_OUTPUT
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

// Analysis super tools (8)
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
