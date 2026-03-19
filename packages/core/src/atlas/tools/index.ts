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

export {
  definition as classifyBoundariesDefinition,
  classifyBoundaries,
} from './classify-boundaries'
export type {
  ClassifyBoundariesInput,
  ClassifyBoundariesOutput,
  ClassifiedDocument,
} from './classify-boundaries'

export {
  definition as splitPdfDefinition,
  splitPdf,
} from './split-pdf'
export type { SplitPdfInput, SplitPdfOutput, SplitFile } from './split-pdf'

export {
  definition as labelDocumentDefinition,
  labelDocument,
} from './label-document'
export type { LabelDocumentInput, LabelDocumentOutput } from './label-document'

export {
  definition as notifySlackDefinition,
  notifySlackCase,
  notifySlackSplit,
  notifySlackAlert,
} from './notify-slack'
export type { SlackCaseInput, SlackSplitInput, SlackAlertInput } from './notify-slack'

import { definition as _validateRecordDef } from './validate-record'
import { definition as _normalizeBoBDef } from './normalize-book-of-business'
import { definition as _normalizeStatusDef } from './normalize-status'
import { definition as _routeToCollectionDef } from './route-to-collection'
import { definition as _classifyBoundariesDef } from './classify-boundaries'
import { definition as _splitPdfDef } from './split-pdf'
import { definition as _labelDocumentDef } from './label-document'
import { definition as _notifySlackDef } from './notify-slack'

/**
 * All atomic tool definitions for registry purposes.
 */
export function getAtomicToolDefinitions() {
  return [
    _validateRecordDef,
    _normalizeBoBDef,
    _normalizeStatusDef,
    _routeToCollectionDef,
    _classifyBoundariesDef,
    _splitPdfDef,
    _labelDocumentDef,
    _notifySlackDef,
  ]
}
