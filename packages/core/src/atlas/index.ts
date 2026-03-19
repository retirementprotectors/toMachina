// ATLAS Intelligence — barrel export

// Types
export * from './types'

// Health monitoring
export { computeAutomationHealth, isSourceStale, getAutomationSummary, calculateGapAnalysis } from './health'

// Wires (v1 legacy + v2 super tool composition)
export {
  WIRE_DEFINITIONS,
  WIRE_DEFINITIONS_V2,
  getWires,
  getWiresV2,
  getWireStats,
  getWireSuperTools,
} from './wires'

// Introspection engine
export {
  hashHeaderFingerprint,
  profileCsvColumns,
  profileCollection,
  matchProfiles,
  matchFingerprint,
} from './introspect'

// Atomic tools
export {
  validateRecordDefinition,
  validateRecordQualification,
  normalizeBoBDefinition,
  normalizeBookOfBusiness,
  normalizeStatusDefinition,
  normalizeStatusFields,
  routeToCollectionDefinition,
  routeToCollection,
  getAtomicToolDefinitions,
} from './tools'

// Super tools
export {
  extractDefinition,
  executeExtract,
  introspectDefinition,
  executeIntrospect,
  validateDefinition,
  executeValidate,
  normalizeDefinition,
  executeNormalize,
  matchDefinition,
  executeMatch,
  writeDefinition,
  executeWrite,
  classifyDefinition,
  executeClassify,
  getSuperToolDefinitions,
} from './super-tools'

// Wire executor — NOT exported from barrel.
// Backend-only (services/api, services/intake) import directly:
//   import { executeWire } from '@tomachina/core/src/atlas/wire-executor'
// Exporting here pulls .js imports into Next.js webpack which can't resolve them.
export type { WireInput, WireContext, WireResult, StageResult } from './wire-executor'
