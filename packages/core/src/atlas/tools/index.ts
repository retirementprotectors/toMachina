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

import { definition as _validateRecordDef } from './validate-record'
import { definition as _normalizeBoBDef } from './normalize-book-of-business'
import { definition as _normalizeStatusDef } from './normalize-status'
import { definition as _routeToCollectionDef } from './route-to-collection'

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
  ]
}
