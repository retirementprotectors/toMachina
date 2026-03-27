// ─── VOLTRON Atomic Tools — Barrel Export ────────────────────────────────────
// Exports definitions only from barrel (browser-safe).
// Execute functions are server-only — import directly from individual files.
// ─────────────────────────────────────────────────────────────────────────────

// ── Definitions (browser-safe) ────────────────────────────────────────────────

export { definition as getClientDocumentsDefinition } from './get-client-documents'
export { definition as getDocumentDefinition } from './get-document'
export { definition as createAcfFolderDefinition } from './create-acf-folder'
export { definition as listAcfContentsDefinition } from './list-acf-contents'
export { definition as saveToDriveDefinition } from './save-to-drive'
export { definition as runQueQuoteDefinition } from './run-que-quote'
export { definition as scheduleMeetingDefinition } from './schedule-meeting'
export { definition as sendSmsDefinition } from './send-sms'
export { definition as createCalendarEventDefinition } from './create-calendar-event'
export { definition as logActivityDefinition } from './log-activity'
export { definition as runIllustrationDefinition } from './run-illustration'

// ── Types ─────────────────────────────────────────────────────────────────────

export type { FileMetadata, GetClientDocumentsInput } from './get-client-documents'
export type { DocumentContent, GetDocumentInput } from './get-document'
export type { FolderIdData, CreateAcfFolderInput } from './create-acf-folder'
export type { AcfFileEntry, FileListData, ListAcfContentsInput } from './list-acf-contents'
export type { FileLinkData, SaveToDriveInput } from './save-to-drive'
export type { PlanOption, PlanComparisonData, RunQueQuoteInput } from './run-que-quote'
export type { EventIdData, ScheduleMeetingInput } from './schedule-meeting'
export type { SmsStatusData, SendSmsInput } from './send-sms'
export type { CalendarEventData, CreateCalendarEventInput } from './create-calendar-event'
export type { LogEntryData, LogActivityInput } from './log-activity'
export type {
  IllustrationCarrier,
  IllustrationPdfData,
  RunIllustrationInput,
} from './run-illustration'

// ── Helpers ───────────────────────────────────────────────────────────────────

import { definition as getClientDocuments } from './get-client-documents'
import { definition as getDocument } from './get-document'
import { definition as createAcfFolder } from './create-acf-folder'
import { definition as listAcfContents } from './list-acf-contents'
import { definition as saveToDrive } from './save-to-drive'
import { definition as runQueQuote } from './run-que-quote'
import { definition as scheduleMeeting } from './schedule-meeting'
import { definition as sendSms } from './send-sms'
import { definition as createCalendarEvent } from './create-calendar-event'
import { definition as logActivity } from './log-activity'
import { definition as runIllustration } from './run-illustration'

/** All 11 atomic tool definitions for registry generation. */
export const VOLTRON_ATOMIC_TOOL_DEFINITIONS = [
  getClientDocuments,
  getDocument,
  createAcfFolder,
  listAcfContents,
  saveToDrive,
  runQueQuote,
  scheduleMeeting,
  sendSms,
  createCalendarEvent,
  logActivity,
  runIllustration,
] as const

/** Lookup a single atomic tool definition by tool_id. */
export function getVoltronAtomicToolById(toolId: string): (typeof VOLTRON_ATOMIC_TOOL_DEFINITIONS)[number] | undefined {
  return VOLTRON_ATOMIC_TOOL_DEFINITIONS.find((d) => d.tool_id === toolId)
}

// ── TRK-13741: Legacy Tool Map (82 hand-coded tools → VoltronRegistryEntry) ──
export {
  LEGACY_TOOL_MAP,
  getLegacyToolById,
  getLegacyToolsBySource,
  getLegacyToolIds,
  validateLegacyToolMap,
} from './legacy-tool-map'
