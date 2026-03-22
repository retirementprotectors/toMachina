/**
 * API DTOs — Group 2: Campaign / Template / Content Block / Comms
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/campaigns.ts
 *   services/api/src/routes/campaign-analytics.ts
 *   services/api/src/routes/campaign-send.ts
 *   services/api/src/routes/templates.ts
 *   services/api/src/routes/content-blocks.ts
 *   services/api/src/routes/comms.ts
 */

import type { Campaign, Template, ContentBlock } from '../types'

// ============================================================================
// CAMPAIGNS — services/api/src/routes/campaigns.ts
// ============================================================================

/** GET /api/campaigns — paginated list (each item stripped of internal fields) */
export type CampaignListDTO = CampaignDTO[]

/** GET /api/campaigns/:id — single campaign with Firestore doc ID */
export type CampaignDTO = Campaign & { id: string }

/** GET /api/campaigns/:id/templates — templates belonging to a campaign */
export type CampaignTemplateListDTO = TemplateDTO[]

/** POST /api/campaigns/:id/assemble (single template) — assembled content */
export interface AssembledContentData {
  campaign_id: string
  template_id: string
  channel: string
  touchpoint: string
  subject: string
  body: string
  raw_body: string
  blocks_used: string[]
  missing_blocks: string[]
  merge_fields_applied: string[]
}

/** POST /api/campaigns/:id/assemble (all) — array of assembled content */
export type CampaignAssembleAllData = AssembledContentData[]

/** GET /api/campaigns/:id/preview — preview assembled content (merge fields unresolved) */
export type CampaignPreviewData = AssembledContentData[]

/** POST /api/campaigns/:id/schedule — created schedule job */
export interface CampaignScheduleJobResult {
  job_id: string
  campaign_id: string
  scheduled_for: string
  target_criteria: Record<string, unknown> | null
  status: 'scheduled'
  _created_by: string
  created_at: string
  updated_at: string
}

/** POST /api/campaigns/:id/duplicate — duplicated campaign summary */
export interface CampaignDuplicateResult {
  campaign_id: string
  name: string
  cloned_templates: number
}

// ============================================================================
// CAMPAIGN ANALYTICS — services/api/src/routes/campaign-analytics.ts
// ============================================================================

/** GET /api/campaign-analytics/:campaignId — performance summary */
export interface CampaignAnalyticsData {
  campaign_id: string
  total_sends: number
  total_sent: number
  total_delivered: number
  total_bounced: number
  total_opened: number
  total_clicked: number
  total_failed: number
  total_skipped: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  bounce_rate: number
  channel_breakdown: { email: number; sms: number }
  schedules: Record<string, unknown>[]
}

/** GET /api/campaign-analytics/:campaignId/timeline — daily send activity */
export type CampaignTimelineData = CampaignTimelineDay[]

export interface CampaignTimelineDay {
  date: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
}

/** GET /api/campaign-analytics/:campaignId/recipients — per-recipient delivery status */
export type CampaignRecipientListDTO = CampaignRecipientDTO[]

export interface CampaignRecipientDTO {
  contact_id: string
  channel: string
  status: string
  provider: string
  sent_at: string
  error_message: string | null
}

/** GET /api/campaign-analytics/:campaignId/drip-progress — drip sequence progress */
export interface CampaignDripProgressData {
  sequences: DripSequenceProgress[]
  message?: string
}

export interface DripSequenceProgress {
  drip_id: string
  sequence_name: string
  status: string
  total_enrolled: number
  active: number
  completed: number
  stopped: number
  steps: DripStepProgress[]
}

export interface DripStepProgress {
  step_index: number
  channel: string
  template_id: string
  delay_days: number
  total_enrolled: number
  reached: number
  completion_rate: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
}

/** POST /api/campaign-analytics/webhook/sendgrid — webhook processing result */
export interface WebhookSendGridResult {
  processed: number
  unmatched: number
}

/** POST /api/campaign-analytics/webhook/twilio — webhook processing result */
export interface WebhookTwilioResult {
  processed: true
  event_type: string
}

/** POST /api/campaign-analytics/webhook/twilio — skipped result */
export interface WebhookTwilioSkipResult {
  skipped: true
  reason: string
}

// ============================================================================
// CAMPAIGN SEND — services/api/src/routes/campaign-send.ts
// ============================================================================

/** POST /api/campaign-send/enroll — enrollment result */
export interface CampaignEnrollResult {
  enrollmentCount: number
  queuedSendCount: number
  skippedDuplicates: number
}

/** POST /api/campaign-send/manual — send log entry returned for manual sends + DND skips */
export interface CampaignSendLogEntry {
  send_id: string
  campaign_id: string
  contact_id: string
  channel: string
  status: string
  content_preview?: string
  subject?: string
  provider?: string
  error_message?: string
  created_at: string
  [key: string]: unknown
}

/** GET /api/campaign-send/history — list of send log entries */
export type CampaignSendHistoryDTO = Record<string, unknown>[]

/** GET /api/campaign-send/enrollments — list of enrollments */
export type CampaignEnrollmentListDTO = Record<string, unknown>[]

/** POST /api/campaign-send/targets — matching contacts for trigger criteria */
export type CampaignTargetListDTO = Record<string, unknown>[]

/** POST /api/campaign-send/execute — batch execute result */
export interface CampaignExecuteResult {
  processed: number
  skipped: number
  total_found: number
}

/** POST /api/campaign-send/execute (no sends due) */
export interface CampaignExecuteEmptyResult {
  processed: 0
  message: 'No sends due'
}

/** GET /api/campaign-send/queue — queued sends list */
export type CampaignQueueListDTO = Record<string, unknown>[]

/** POST /api/campaign-send/cancel/:id — cancel result */
export interface CampaignCancelResult {
  id: string
  cancelled: true
}

/** POST /api/campaign-send/schedule — created schedule */
export interface CampaignSendScheduleData {
  schedule_id: string
  campaign_id: string
  scheduled_for: string
  timezone: string
  channel: string
  audience_filter: Record<string, unknown> | null
  status: 'scheduled'
  _created_by: string
  created_at: string
  updated_at: string
}

/** GET /api/campaign-send/scheduled — list of scheduled sends */
export type CampaignScheduledListDTO = Record<string, unknown>[]

/** PATCH /api/campaign-send/scheduled/:id — update result */
export interface CampaignScheduleUpdateResult {
  id: string
  updated: string[]
}

/** POST /api/campaign-send/execute-due — execute due schedules result */
export interface CampaignExecuteDueResult {
  processed: number
  results: CampaignExecuteDueItem[]
}

export interface CampaignExecuteDueItem {
  schedule_id: string
  queued: number
}

/** POST /api/campaign-send/execute-due (no schedules due) */
export interface CampaignExecuteDueEmptyResult {
  processed: 0
  message: 'No schedules due'
}

/** POST /api/campaign-send/drip/create — created drip sequence */
export interface DripSequenceCreateData {
  drip_id: string
  campaign_id: string
  sequence_name: string
  description: string
  steps: DripStepDef[]
  fallback_channel: string
  max_steps: number
  status: 'active'
  _created_by: string
  created_at: string
  updated_at: string
}

export interface DripStepDef {
  step_index: number
  delay_days: number
  channel: string
  template_id: string
  conditions: Record<string, unknown>[]
}

/** GET /api/campaign-send/drip — list of drip sequences */
export type DripSequenceListDTO = Record<string, unknown>[]

/** GET /api/campaign-send/drip/:id — drip sequence with enrollment stats */
export interface DripSequenceDetailData {
  [key: string]: unknown
  enrollment_stats: DripEnrollmentStats
}

export interface DripEnrollmentStats {
  total_enrolled: number
  active: number
  completed: number
  stopped: number
  paused: number
}

/** POST /api/campaign-send/drip/:id/enroll — drip enrollment result */
export interface DripEnrollResult {
  drip_id: string
  enrollmentCount: number
  queuedCount: number
  skippedDuplicates: number
}

/** POST /api/campaign-send/drip/advance — drip advance result */
export interface DripAdvanceResult {
  processed: number
  advanced: number
  skipped: number
  stopped: number
  failed: number
}

// ============================================================================
// TEMPLATES — services/api/src/routes/templates.ts
// ============================================================================

/** GET /api/templates — paginated list (each item stripped of internal fields) */
export type TemplateListDTO = TemplateDTO[]

/** GET /api/templates/:id — single template with resolved block names */
export type TemplateDetailDTO = Template & {
  id: string
  _resolved_blocks?: Record<string, string>
}

/** Single template with Firestore doc ID */
export type TemplateDTO = Template & { id: string }

/** POST /api/templates — created template echoed back */
export type TemplateCreateDTO = TemplateDTO

/** PATCH /api/templates/:id — update result */
export interface TemplateUpdateResult {
  id: string
  updated: string[]
}

/** DELETE /api/templates/:id — soft delete result */
export interface TemplateDeleteResult {
  id: string
  deleted: true
}

// ============================================================================
// CONTENT BLOCKS — services/api/src/routes/content-blocks.ts
// ============================================================================

/** GET /api/content-blocks — paginated list (each item stripped of internal fields) */
export type ContentBlockListDTO = ContentBlockDTO[]

/** GET /api/content-blocks/:id — single content block with Firestore doc ID */
export type ContentBlockDTO = ContentBlock & { id: string }

/** POST /api/content-blocks — created content block echoed back */
export type ContentBlockCreateDTO = ContentBlockDTO

/** PATCH /api/content-blocks/:id — update result */
export interface ContentBlockUpdateResult {
  id: string
  updated: string[]
}

/** DELETE /api/content-blocks/:id — soft delete result */
export interface ContentBlockDeleteResult {
  id: string
  deleted: true
}

// ============================================================================
// COMMS — services/api/src/routes/comms.ts
// ============================================================================

/** POST /api/comms/send-email — sent email result */
export interface CommsSendEmailResult {
  statusCode: number
  messageId: string | null
  to: string
  from: string
  commId: string
}

/** POST /api/comms/send-email?dryRun=true — dry-run result */
export interface CommsSendEmailDryRunResult {
  statusCode: 200
  messageId: null
  to: string
  from: string
  dryRun: true
  commId: string
}

/** POST /api/comms/send-sms — sent SMS result */
export interface CommsSendSmsResult {
  messageSid: unknown
  to: unknown
  from: unknown
  status: unknown
  dateCreated: unknown
  numSegments: unknown
  commId: string
}

/** POST /api/comms/send-sms?dryRun=true — dry-run result */
export interface CommsSendSmsDryRunResult {
  messageSid: null
  to: string
  from: string
  status: 'dry_run'
  dryRun: true
  commId: string
}

/** POST /api/comms/send-voice — initiated voice call result */
export interface CommsSendVoiceResult {
  callSid: unknown
  to: unknown
  from: unknown
  status: unknown
  direction: unknown
  dateCreated: unknown
  commId: string
}

/** POST /api/comms/send-voice?dryRun=true — dry-run result */
export interface CommsSendVoiceDryRunResult {
  callSid: null
  to: string
  from: string
  status: 'dry_run'
  dryRun: true
  commId: string
}

/** POST /api/comms/log-call — manually logged call result */
export interface CommsLogCallResult {
  commId: string
  direction: string
  outcome: string
  duration: number | null
  notes: string
}

/** GET /api/comms/status/:sid — delivery status for message (SMS) */
export interface CommsMessageStatusData {
  sid: unknown
  to: unknown
  from: unknown
  status: unknown
  direction: unknown
  dateCreated: unknown
  body: unknown
  dateSent: unknown
  dateUpdated: unknown
  errorCode: unknown
  errorMessage: unknown
  numSegments: unknown
  price: unknown
  priceUnit: unknown
}

/** GET /api/comms/status/:sid — delivery status for call */
export interface CommsCallStatusData {
  sid: unknown
  to: unknown
  from: unknown
  status: unknown
  direction: unknown
  dateCreated: unknown
  startTime: unknown
  endTime: unknown
  duration: unknown
  answeredBy: unknown
  price: unknown
  priceUnit: unknown
}
