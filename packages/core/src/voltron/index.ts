// ─── VOLTRON Action Engine — Barrel Export ──────────────────────────────────
// Public API for the VOLTRON module. Wire executor is type-only from barrel
// (same pattern as ATLAS — avoids pulling server-only imports into Next.js).
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  VoltronUserRole,
  VoltronToolType,
  VoltronToolSource,
  VoltronLionDomain,
  VoltronToolResult,
  VoltronSuperResult,
  VoltronContext,
  VoltronWireInput,
  VoltronWireResult,
  VoltronStageResult,
  VoltronArtifact,
  VoltronRegistryEntry,
  VoltronSuperToolDefinition,
  VoltronWireDefinition,
  VoltronSuperToolExecuteFn,
} from './types'

export { VOLTRON_ROLE_RANK, VOLTRON_ROLE_TYPE_ACCESS, isToolTypeAllowed } from './types'

// Wire definitions
export {
  VOLTRON_WIRE_DEFINITIONS,
  getVoltronWireById,
  getVoltronWireIds,
  getVoltronWireStats,
  isAepBlackout,
  validateWireExecution,
} from './wires'

export type { WireValidationResult } from './wires'

// Super tool definitions (browser-safe — no execute functions from barrel)
export {
  reviewPrepDefinition,
  pullDocumentsDefinition,
  draftCommunicationDefinition,
  rmdAnalysisDefinition,
  coverageGapDefinition,
  meetingPrepDefinition,
  buildCaseworkDefinition,
  runIllustrationDefinition,
  getVoltronSuperToolDefinitions,
  getVoltronSuperToolById,
} from './super-tools'

// Atomic tool definitions (browser-safe — no execute functions from barrel)
export {
  getClientDocumentsDefinition,
  getDocumentDefinition,
  createAcfFolderDefinition,
  listAcfContentsDefinition,
  saveToDriveDefinition,
  runQueQuoteDefinition,
  scheduleMeetingDefinition,
  sendSmsDefinition,
  createCalendarEventDefinition,
  logActivityDefinition,
  runIllustrationDefinition as runIllustrationAtomicDefinition,
  VOLTRON_ATOMIC_TOOL_DEFINITIONS,
  getVoltronAtomicToolById,
  // TRK-13741: Legacy tool map (82 hand-coded → registry format)
  LEGACY_TOOL_MAP,
  getLegacyToolById,
  getLegacyToolsBySource,
  getLegacyToolIds,
  validateLegacyToolMap,
} from './tools/index'

// Atomic tool types
export type {
  FileMetadata,
  GetClientDocumentsInput,
  DocumentContent,
  GetDocumentInput,
  FolderIdData,
  CreateAcfFolderInput,
  AcfFileEntry,
  FileListData,
  ListAcfContentsInput,
  FileLinkData,
  SaveToDriveInput,
  PlanOption,
  PlanComparisonData,
  RunQueQuoteInput,
  EventIdData,
  ScheduleMeetingInput,
  SmsStatusData,
  SendSmsInput,
  CalendarEventData,
  CreateCalendarEventInput,
  LogEntryData,
  LogActivityInput,
  IllustrationCarrier,
  IllustrationPdfData,
  RunIllustrationInput,
} from './tools/index'

// Lion agent types + utilities (VOL-O01)
export type { LionConfig, LionWireResult, LionToolMap } from './lion-types'
export {
  LION_DOMAIN_KEYWORDS,
  classifyLionDomain,
  buildLionToolMap,
  LION_DOMAINS,
  LION_LABELS,
  LION_COLORS,
} from './lion-types'

// Case pipeline types (VOL-O07)
export type { CaseStatus, CaseOutcome, IntakeChannel, VoltronCase } from './case-types'
export {
  CASE_STATUS_ORDER,
  createCaseRecord,
  CASE_STATUS_LABELS,
  CASE_STATUS_COLORS,
  CASE_OUTCOME_COLORS,
} from './case-types'

// Gap request types (VOL-O18)
export type { GapRequestPriority, GapRequestStatus, VoltronGapRequest } from './gap-request-types'
export { createGapRequest } from './gap-request-types'

// Wire executor — type-only exports from barrel (import directly for execution)
// Backend-only (services/api) import directly:
//   import { executeVoltronWire } from '@tomachina/core/voltron/wire-executor'
export type { ExecuteWireOptions, WireSSEEvent, WireSSEEventType, WireStatusListener } from './wire-executor'
