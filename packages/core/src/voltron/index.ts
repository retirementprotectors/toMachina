// ─── VOLTRON Action Engine — Barrel Export ──────────────────────────────────
// Public API for the VOLTRON module. Wire executor is type-only from barrel
// (same pattern as ATLAS — avoids pulling server-only imports into Next.js).
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  VoltronUserRole,
  VoltronToolType,
  VoltronToolSource,
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
} from './wires'

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

// Wire executor — type-only exports from barrel (import directly for execution)
// Backend-only (services/api) import directly:
//   import { executeVoltronWire } from '@tomachina/core/voltron/wire-executor'
export type { ExecuteWireOptions } from './wire-executor'
