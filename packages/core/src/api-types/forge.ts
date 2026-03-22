/**
 * API DTOs — Group 8: FORGE / Tracker / Sprint / SPARK
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/tracker.ts
 *   services/api/src/routes/sprints.ts
 *   services/api/src/routes/spark.ts
 *
 * CRITICAL: AuditRoundData uses TrackerItemDTO[] arrays (not counts).
 * Root cause of the ForgeAudit crash (2026-03-20) was returning counts
 * where the frontend expected arrays.
 */

// ============================================================================
// TRACKER ITEM — entity type (no existing core type)
// ============================================================================

/** Tracker item as returned by the API (Firestore doc with id). */
export interface TrackerItemDTO {
  id: string
  item_id: string
  title: string
  description?: string
  status: string
  type?: string
  portal?: string
  scope?: string
  component?: string
  section?: string
  sprint_id?: string | null
  plan_link?: string | null
  discovery_url?: string | null
  notes?: string
  attachments?: TrackerAttachmentDTO[]
  audit_round?: number
  audit_status?: string
  audit_notes?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

/** Attachment nested inside a tracker item. */
export interface TrackerAttachmentDTO {
  name: string
  original_name: string
  url: string
  content_type: string
  size: number
  path: string
  uploaded_at: string
  uploaded_by: string
}

// ============================================================================
// TRACKER — services/api/src/routes/tracker.ts
// ============================================================================

/** GET /api/tracker — paginated list of tracker items (pagination in envelope meta) */
export type TrackerListDTO = TrackerItemDTO[]

/** GET /api/tracker/:id — single tracker item */
export type TrackerGetDTO = TrackerItemDTO

/** POST /api/tracker — created tracker item echoed back */
export type TrackerCreateDTO = TrackerItemDTO

/** PATCH /api/tracker/:id — updated tracker item echoed back */
export type TrackerUpdateDTO = TrackerItemDTO

/** DELETE /api/tracker/:id */
export interface TrackerDeleteResult {
  deleted: string
}

/** PATCH /api/tracker/bulk — bulk update result */
export interface TrackerBulkUpdateResult {
  updated: number
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

export type DupReason = 'exact_match' | 'substring_match' | 'jaccard_similarity'

/** A single dedup group: one winner + N duplicates */
export interface DupGroupDTO {
  winner: { id: string; item_id: string; title: string; status: string }
  duplicates: { id: string; item_id: string; title: string; status: string }[]
  reason: DupReason
}

/** GET /api/tracker/dedup — full dedup scan */
export interface DedupScanData {
  groups: DupGroupDTO[]
  total_groups: number
}

/** POST /api/tracker/dedup/merge — merged winner echoed back */
export type DedupMergeResult = TrackerItemDTO

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** POST /api/tracker/:id/attachments — created attachment echoed back */
export type AttachmentCreateDTO = TrackerAttachmentDTO

/** DELETE /api/tracker/:id/attachments/:name */
export interface AttachmentDeleteResult {
  deleted: string
}

// ============================================================================
// SPRINT — services/api/src/routes/sprints.ts
// ============================================================================

/** Sprint entity as returned by the API. */
export interface SprintDTO {
  id: string
  name: string
  description: string
  discovery_url?: string | null
  plan_link?: string | null
  item_ids: string[]
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

/** GET /api/sprints — all sprints ordered by created_at desc */
export type SprintListDTO = SprintDTO[]

/** GET /api/sprints/:id — single sprint */
export type SprintGetDTO = SprintDTO

/** POST /api/sprints — created sprint echoed back */
export type SprintCreateDTO = SprintDTO

/** POST /api/sprints/auto — auto-generated sprint with item count */
export type SprintAutoCreateDTO = SprintDTO & { item_count: number }

/** PATCH /api/sprints/:id — updated sprint echoed back */
export type SprintUpdateDTO = SprintDTO

/** DELETE /api/sprints/:id */
export interface SprintDeleteResult {
  deleted: string
  unassigned_items: number
}

// ---------------------------------------------------------------------------
// Discovery Import
// ---------------------------------------------------------------------------

/** POST /api/sprints/import-discovery (dry_run: true) */
export interface DiscoveryImportPreviewData {
  sprint: { name: string; description: string; discovery_url: string | null }
  sprint_name: string
  items: Array<Record<string, unknown>>
  item_count: number
  items_created: number
}

/** POST /api/sprints/import-discovery (dry_run: false / commit) */
export interface DiscoveryImportResult {
  sprint_id: string
  sprint_name: string
  discovery_url: string | null
  items_created: number
  item_ids: string[]
}

// ---------------------------------------------------------------------------
// Prompt Generation (discovery, building, audit-discovery, audit-plan, audit)
// ---------------------------------------------------------------------------

/** GET /api/sprints/:id/prompt — generated markdown prompt */
export interface SprintPromptData {
  prompt: string
}

/** GET /api/sprints/:id/audit-discovery — generated audit-discovery markdown */
export type AuditDiscoveryPromptData = SprintPromptData

/** GET /api/sprints/:id/audit-plan — generated audit-plan markdown */
export type AuditPlanPromptData = SprintPromptData

/** GET /api/sprints/:id/audit — generated audit verification markdown */
export type AuditPromptData = SprintPromptData

// ---------------------------------------------------------------------------
// Audit Rounds
// ---------------------------------------------------------------------------

/**
 * GET /api/sprints/:id/audit-round — current audit round summary.
 *
 * CRITICAL: pending, passed, and failed are TrackerItemDTO[] arrays.
 * The ForgeAudit crash (2026-03-20) was caused by returning counts
 * where the frontend expected arrays. This type is the safety net.
 */
export interface AuditRoundData {
  current_round: number
  total_items: number
  /** Items awaiting audit decision. MUST be an array of items, never a count. */
  pending: TrackerItemDTO[]
  pending_count: number
  /** Items that passed audit. MUST be an array of items, never a count. */
  passed: TrackerItemDTO[]
  passed_count: number
  /** Items that failed audit. MUST be an array of items, never a count. */
  failed: TrackerItemDTO[]
  failed_count: number
}

/** POST /api/sprints/:id/audit-rounds — create new audit round from failed items */
export interface AuditRoundCreateResult {
  new_round: number
  previous_round: number
  items: TrackerItemDTO[]
  item_count: number
}

// ---------------------------------------------------------------------------
// SendIt / Reopen
// ---------------------------------------------------------------------------

/** POST /api/sprints/:id/sendit — confirm all items + close sprint */
export interface SendItResult {
  confirmed: number
  sprint_closed: boolean
  git: {
    committed: boolean
    message: string
  }
}

/** POST /api/sprints/:id/reopen — reopen a completed sprint */
export interface ReopenResult {
  reverted: number
  sprint_reopened: boolean
}

// ============================================================================
// SPARK — services/api/src/routes/spark.ts
// ============================================================================

/** GET /api/spark/test — health check */
export interface SparkHealthData {
  message: string
  timestamp: string
  version: string
}

/** Spark event entry stored in the rolling log. */
export interface SparkEventEntry {
  event_type: string
  spark_contact_id: string
  timestamp: string
  received_at: string
}

/** Spark stats counters. */
export interface SparkStats {
  total: number
  contacts: number
  policies: number
  soas: number
  assessments?: number
}

/** GET /api/spark/status — webhook status + last events */
export interface SparkStatusData {
  last_events: SparkEventEntry[]
  stats: SparkStats
  webhook_active: boolean
  version: string
}

/** POST /api/spark/webhook — webhook processing result */
export interface SparkWebhookResult {
  event_type: string
  spark_contact_id: string
  result: Record<string, unknown>
}
