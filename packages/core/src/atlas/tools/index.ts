// ---------------------------------------------------------------------------
// ATLAS Atomic Tools — barrel export
// ---------------------------------------------------------------------------

export {
  definition as validateRecordDefinition,
  execute as validateRecordQualification,
} from './validate-record'
export type { ValidateRecordInput, ValidateRecordOutput } from './validate-record'

export {
  definition as normalizeBoBDefinition,
  execute as normalizeBookOfBusiness,
} from './normalize-book-of-business'
export type { NormalizeBoBInput, NormalizeBoBOutput } from './normalize-book-of-business'

export {
  definition as normalizeStatusDefinition,
  execute as normalizeStatusFields,
} from './normalize-status'
export type { NormalizeStatusInput, NormalizeStatusOutput } from './normalize-status'

export {
  definition as routeToCollectionDefinition,
  execute as routeToCollection,
} from './route-to-collection'
export type { RouteInput, RouteOutput } from './route-to-collection'

// Server-only tools — NOT exported from barrel (import fs/child_process).
// Backend services import directly:
//   import { classifyBoundaries } from '@tomachina/core/src/atlas/tools/classify-boundaries'
//   import { splitPdf } from '@tomachina/core/src/atlas/tools/split-pdf'
//   import { labelDocument } from '@tomachina/core/src/atlas/tools/label-document'
//   import { notifySlackCase } from '@tomachina/core/src/atlas/tools/notify-slack'
// Types are safe to export (no runtime Node.js imports):
export type {
  ClassifyBoundariesInput,
  ClassifyBoundariesOutput,
  ClassifiedDocument,
} from './classify-boundaries'
export type { SplitPdfInput, SplitPdfOutput, SplitFile } from './split-pdf'
export type { LabelDocumentInput, LabelDocumentOutput } from './label-document'
export type { SlackCaseInput, SlackSplitInput, SlackAlertInput } from './notify-slack'

// ISU Extension Iowa Land Value Survey parser (FV-003 / SPR-FARMLAND-VALUATION-001).
// Uses Node-runtime APIs (crypto, fetch) — backend services import execute directly:
//   import { execute as parseIsuLandValues } from '@tomachina/core/src/atlas/tools/isu-land-value-parse'
// Types + definition are safe to export from the barrel.
export type {
  IsuParseInput,
  IsuParseOutput,
  IsuFetchFailureDetail,
} from './isu-land-value-parse'
export { definition as isuLandValueParseDefinition } from './isu-land-value-parse'

// USDA NASS Quick Stats atomic tool (FV-002 / SPR-FARMLAND-VALUATION-001).
// Uses fetch + process.env (requires NASS_QUICK_STATS_KEY). Backend-only.
export type { NassLookupInput, NassLookupOutput, NassCategory } from './nass-lookup'
export { definition as nassLookupDefinition } from './nass-lookup'

// ACF tools — definitions are browser-safe; execute functions are stubs.
// For full ACF tool implementations, see services/api/src/scripts/acf-*.ts
export {
  acfSnapshotDefinition,
  acfRenameDefinition,
  acfMergeDefinition,
  acfSubfolderDefinition,
  acfRouteFilesDefinition,
  acfLinkDefinition,
  acfFlattenDefinition,
  acfDedupeFilesDefinition,
  acfRenameFilesDefinition,
  acfReclassifyDefinition,
  acfAuditDefinition,
  getAcfToolDefinitions,
  ACF_REQUIRED_SUBFOLDERS,
  DOCUMENT_TYPE_TO_SUBFOLDER,
  resolveSubfolder,
} from './acf-tools'
export type {
  AcfSnapshotInput,
  AcfSnapshotOutput,
  AcfRenameInput,
  AcfRenameOutput,
  AcfMergeInput,
  AcfMergeOutput,
  AcfSubfolderInput,
  AcfSubfolderOutput,
  AcfRouteFilesInput,
  AcfRouteFilesOutput,
  AcfLinkInput,
  AcfLinkOutput,
  AcfFlattenInput,
  AcfFlattenOutput,
  AcfDedupeFilesInput,
  AcfDedupeFilesOutput,
  AcfRenameFilesInput,
  AcfRenameFilesOutput,
  AcfReclassifyInput,
  AcfReclassifyOutput,
  AcfAuditInput,
  AcfAuditOutput,
  AcfAuditException,
} from './acf-tools'

// System Synergy tools — API-endpoint tools (no execute functions in core)
export {
  sessionInventoryDefinition,
  memoryInventoryDefinition,
  claudeMdDiffDefinition,
  brainHealthDefinition,
  knowledgeQueryDefinition,
  sessionEnvAuditDefinition,
  duplicateDetectorDefinition,
  warriorRosterDefinition,
  deployStatusDefinition,
  hookAuditDefinition,
  getSynergyToolDefinitions,
} from './system-synergy-tools'

import { definition as _validateRecordDef } from './validate-record'
import { definition as _normalizeBoBDef } from './normalize-book-of-business'
import { definition as _normalizeStatusDef } from './normalize-status'
import { definition as _routeToCollectionDef } from './route-to-collection'
import { getAcfToolDefinitions as _getAcfDefs } from './acf-tools'
import { getSynergyToolDefinitions as _getSynergyDefs } from './system-synergy-tools'

/**
 * All atomic tool definitions for registry purposes.
 * Server-only tool definitions must be loaded dynamically at runtime.
 */
export function getAtomicToolDefinitions() {
  return [
    _validateRecordDef,
    _normalizeBoBDef,
    _normalizeStatusDef,
    _routeToCollectionDef,
    ..._getAcfDefs(),
    ..._getSynergyDefs(),
  ]
}
