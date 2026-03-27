// ─── VOLTRON Super Tools Barrel ──────────────────────────────────────────────
// All 8 Super Tools exported with definitions and execute functions.
// RUN_ILLUSTRATION is server-only (Playwright) but definition is safe to export.
// ─────────────────────────────────────────────────────────────────────────────

export {
  definition as reviewPrepDefinition,
  execute as executeReviewPrep,
} from './review-prep'

export {
  definition as pullDocumentsDefinition,
  execute as executePullDocuments,
} from './pull-documents'

export {
  definition as draftCommunicationDefinition,
  execute as executeDraftCommunication,
} from './draft-communication'

export {
  definition as rmdAnalysisDefinition,
  execute as executeRmdAnalysis,
} from './rmd-analysis'

export {
  definition as coverageGapDefinition,
  execute as executeCoverageGap,
} from './coverage-gap'

export {
  definition as meetingPrepDefinition,
  execute as executeMeetingPrep,
} from './meeting-prep'

export {
  definition as buildCaseworkDefinition,
  execute as executeBuildCasework,
} from './build-casework'

export {
  definition as runIllustrationDefinition,
  execute as executeRunIllustration,
} from './run-illustration'

import { definition as reviewPrepDef } from './review-prep'
import { definition as pullDocumentsDef } from './pull-documents'
import { definition as draftCommunicationDef } from './draft-communication'
import { definition as rmdAnalysisDef } from './rmd-analysis'
import { definition as coverageGapDef } from './coverage-gap'
import { definition as meetingPrepDef } from './meeting-prep'
import { definition as buildCaseworkDef } from './build-casework'
import { definition as runIllustrationDef } from './run-illustration'

import type { VoltronSuperToolDefinition } from '../types'

/** All 8 VOLTRON Super Tool definitions for registry generation */
export function getVoltronSuperToolDefinitions(): VoltronSuperToolDefinition[] {
  return [
    reviewPrepDef,
    pullDocumentsDef,
    draftCommunicationDef,
    rmdAnalysisDef,
    coverageGapDef,
    meetingPrepDef,
    buildCaseworkDef,
    runIllustrationDef,
  ]
}

/** Super Tool ID → Definition lookup */
export function getVoltronSuperToolById(id: string): VoltronSuperToolDefinition | undefined {
  return getVoltronSuperToolDefinitions().find(d => d.super_tool_id === id)
}
