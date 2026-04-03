/**
 * API DTOs — Group 9: Utility / Remaining Routes
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/ai3.ts
 *   services/api/src/routes/analytics.ts
 *   services/api/src/routes/carriers.ts
 *   services/api/src/routes/communications.ts
 *   services/api/src/routes/connect.ts
 *   services/api/src/routes/firestore-config.ts
 *   services/api/src/routes/health.ts
 *   services/api/src/routes/intake-queue.ts
 *   services/api/src/routes/intake.ts
 *   services/api/src/routes/leadership.ts
 *   services/api/src/routes/medicare-quote.ts
 *   services/api/src/routes/opportunities.ts
 *   services/api/src/routes/org.ts
 *   services/api/src/routes/products.ts
 *   services/api/src/routes/que.ts
 *   services/api/src/routes/sync.ts
 *   services/api/src/routes/users.ts
 *   services/api/src/routes/webhooks.ts
 */

import type {
  Carrier,
  Product,
  Opportunity,
  Communication,
  OrgUnit,
  User,
} from '../types'

// ============================================================================
// AI3 — services/api/src/routes/ai3.ts
// ============================================================================

/** GET /api/ai3/:clientId — aggregated client data for AI3 report */
export interface Ai3ClientData {
  client: Record<string, unknown>
  accounts: Ai3Account[]
  connected_contacts: Array<Record<string, unknown>>
  access_items: Array<Record<string, unknown> & { id: string }>
  recent_activities: Array<Record<string, unknown> & { id: string }>
  generated_at: string
  generated_by: string
}

/** GET /api/ai3/household/:householdId — aggregated household AI3 report */
export interface Ai3HouseholdData {
  household: Record<string, unknown> & { id: string }
  members: Ai3MemberData[]
  combined_totals: Ai3CombinedTotals
  beneficiary_summary: Ai3BeneficiarySummary
  generated_at: string
  generated_by: string
}

export interface Ai3Account extends Record<string, unknown> {
  id: string
  category: string
}

export interface Ai3MemberData {
  client: Record<string, unknown>
  accounts: Ai3Account[]
  access_items: Array<Record<string, unknown> & { id: string }>
  connected_contacts: Array<Record<string, unknown>>
  recent_activities: Array<Record<string, unknown> & { id: string }>
}

export interface Ai3CombinedTotals {
  total_accounts: number
  total_premium: number
  total_face_amount: number
  by_category: Record<string, { count: number; premium: number; face_amount: number }>
}

export interface Ai3BeneficiarySummary {
  completeness_rate: number
  total: number
  complete: number
}

// ============================================================================
// ANALYTICS — services/api/src/routes/analytics.ts
// ============================================================================

/** GET /api/analytics — paginated list of analytics rows */
export type AnalyticsListDTO = AnalyticsRowDTO[]

/** GET /api/analytics/:id — single analytics row */
export type AnalyticsRowDTO = Record<string, unknown> & { id: string }

/** GET /api/analytics/summary — aggregated analytics dashboard */
export interface AnalyticsSummaryData {
  totals: AnalyticsTotals
  machines: Record<string, AnalyticsMachineBreakdown>
  daily: AnalyticsDailyTrend[]
  updated_at: unknown
}

export interface AnalyticsTotals {
  cc_sessions: number
  cc_messages: number
  cc_tool_calls: number
  cc_tokens_out: number
  mcp_calls_total: number
  mcp_calls_workspace: number
  mcp_calls_business: number
  mcp_calls_healthcare: number
  mcp_calls_gdrive: number
  mcp_calls_slack: number
  mcp_calls_other: number
  mcp_errors: number
  hem_minutes: number
  hem_value_usd: number
  longest_session_min: number
  days: number
  machine_count: number
  hem_hours: string
}

export interface AnalyticsMachineBreakdown {
  days: number
  cc_sessions: number
  cc_messages: number
  mcp_calls: number
  hem_value: number
}

export interface AnalyticsDailyTrend {
  date: string
  cc_sessions: number
  cc_messages: number
  mcp_calls: number
  hem_value: number
}

/** POST /api/analytics — pushed analytics row (upsert) */
export type AnalyticsPushResult = Record<string, unknown>

// ============================================================================
// CARRIERS — services/api/src/routes/carriers.ts
// ============================================================================

/** GET /api/carriers — list of carriers */
export type CarrierListDTO = CarrierDTO[]

/** GET /api/carriers/:id — single carrier */
export type CarrierDTO = Carrier & { id: string }

// ============================================================================
// COMMUNICATIONS — services/api/src/routes/communications.ts
// ============================================================================

/** GET /api/communications — paginated communication records */
export type CommunicationListDTO = CommunicationDTO[]

/** GET /api/communications/:id — single communication record */
export type CommunicationDTO = Communication & { id: string }

// ============================================================================
// CONNECT — services/api/src/routes/connect.ts
// ============================================================================

/** GET /api/connect/calendar — today's upcoming meetings + recordings */
export interface ConnectCalendarData {
  meetings: ConnectCalendarMeeting[]
  recordings: unknown[]
}

/** Shape of each calendar meeting (from CalendarMeeting in calendar-client.ts) */
export interface ConnectCalendarMeeting {
  title: string
  participants: string[]
  timeLabel: string
  joinable: boolean
  meetLink: string | null
}

/** POST /api/connect/meet — created quick meeting */
export interface ConnectMeetResult {
  meetLink: string | null
  eventId: string | null
}

/** GET /api/connect/channels — list of connect channels */
export type ConnectChannelListDTO = ConnectChannelDTO[]

/** POST /api/connect/channels — created channel */
export type ConnectChannelDTO = ConnectChannelRecord & { id: string }

export interface ConnectChannelRecord {
  name: string
  slug: string
  pinned: boolean
  created_at?: string
  updated_at?: string
}

/** PATCH /api/connect/channels/:id — updated channel fields */
export interface ConnectChannelUpdateResult {
  id: string
  pinned?: boolean
  updated_at: string
}

/** POST /api/connect/presence — presence heartbeat result */
export interface ConnectPresenceResult {
  email: string
  updated: true
}

// ============================================================================
// FIRESTORE CONFIG — services/api/src/routes/firestore-config.ts
// ============================================================================

/** GET /api/firestore-config/collections — all config collections with docs + wiring status */
export type FirestoreConfigCollectionsData = FirestoreConfigCollection[]

export interface FirestoreConfigCollection {
  name: string
  count: number
  docs: FirestoreConfigDoc[]
  wiring: FirestoreConfigWiring
}

export interface FirestoreConfigDoc {
  id: string
  fieldCount: number
  typeSummary: Record<string, number>
  updatedAt: string | null
  data: Record<string, unknown>
}

export interface FirestoreConfigWiring {
  status: string
  backend: string
  frontend: string
  backend_endpoints?: number
}

/** GET /api/firestore-config/platform-status — build-time platform scan results */
export interface PlatformStatusData {
  api_routes: Record<string, unknown>
  cloud_functions: unknown[]
  env_vars: unknown[]
  hookify_rules: unknown[]
  scan_stats: Record<string, unknown>
}

/** GET /api/firestore-config/health — Firestore health stats */
export interface FirestoreHealthData {
  collections: {
    active_clients: number
    households: number
    users: number
    active_accounts: number
  }
  queues: Record<string, number>
  dataGaps: {
    missing_agent: number
    missing_household: number
    no_accounts: number
  }
}

/** PUT /api/firestore-config/:collection/:docId — upserted config doc */
export interface FirestoreConfigDocResult extends Record<string, unknown> {
  id: string
  _meta: { wired: boolean; collection: string }
}

/** DELETE /api/firestore-config/:collection/:docId — deleted single doc */
export interface FirestoreConfigDeleteResult {
  deleted: { collection: string; docId: string }
}

/** DELETE /api/firestore-config/:collection — deleted all docs in collection */
export interface FirestoreConfigDeleteCollectionResult {
  deleted: { collection: string; count: number }
}

// ============================================================================
// HEALTH — services/api/src/routes/health.ts
// ============================================================================

/** GET /api/health — service health check */
export interface HealthCheckData {
  status: 'ok' | 'degraded'
  service: string
  version: string
  timestamp: string
  firestore: 'connected' | 'error'
  error?: string
}

// ============================================================================
// INTAKE QUEUE — services/api/src/routes/intake-queue.ts
// ============================================================================

/** GET /api/intake-queue — list of intake queue items */
export type IntakeQueueListDTO = IntakeQueueItemDTO[]

export type IntakeQueueItemDTO = Record<string, unknown> & { id: string }

/** PATCH /api/intake-queue/:id — updated queue item */
export interface IntakeQueueUpdateResult extends Record<string, unknown> {
  id: string
  updated_at: string
}

// ============================================================================
// INTAKE — services/api/src/routes/intake.ts
// ============================================================================

/** POST /api/intake/execute-wire — wire execution result */
export interface IntakeWireResult {
  success: boolean
  wire_id: string
  execution_id: string
  stages: Array<{ stage: string; status: string }>
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  status: string
}

/** POST /api/intake/:executionId/approve — wire approval result (same shape as IntakeWireResult or null) */
export type IntakeApproveResult = IntakeWireResult | null

/** POST /api/intake/:executionId/reject — wire rejection result */
export interface IntakeRejectResult {
  rejected: true
  execution_id: string
}

// ============================================================================
// LEADERSHIP — services/api/src/routes/leadership.ts
// ============================================================================

/** GET /api/leadership/meetings — list of meetings */
export type LeadershipMeetingListDTO = LeadershipMeetingDTO[]

/** GET /api/leadership/meetings/:id — single meeting */
export type LeadershipMeetingDTO = Record<string, unknown> & { id: string }

/** GET /api/leadership/meetings/actions — open action items across meetings */
export type LeadershipActionListDTO = LeadershipActionItemDTO[]

export interface LeadershipActionItemDTO extends Record<string, unknown> {
  meeting_id: string
  meeting_title: unknown
  meeting_date: unknown
}

/** POST /api/leadership/meetings — created meeting */
export interface LeadershipMeetingCreateResult {
  meeting_id: string
}

/** PATCH /api/leadership/meetings/actions/:id — updated action item status */
export interface LeadershipActionUpdateResult {
  action_id: string
  status: string
}

/** GET /api/leadership/roadmaps — list of roadmaps */
export type LeadershipRoadmapListDTO = LeadershipRoadmapDTO[]

/** GET /api/leadership/roadmaps/:id — single roadmap */
export type LeadershipRoadmapDTO = Record<string, unknown> & { id: string }

/** POST /api/leadership/roadmaps — created roadmap */
export interface LeadershipRoadmapCreateResult {
  roadmap_id: string
}

/** PATCH /api/leadership/roadmaps/:id — updated roadmap */
export interface LeadershipRoadmapUpdateResult {
  roadmap_id: string
}

/** POST /api/leadership/roadmaps/:id/milestone — added milestone */
export interface LeadershipMilestoneCreateResult {
  milestone_id: string
}

/** GET /api/leadership/dashboard — aggregated leadership dashboard */
export interface LeadershipDashboardData {
  meetings_this_week: number
  open_action_items: number
  overdue_action_items: number
  roadmap_statuses: Record<string, number>
  total_roadmaps: number
  open_tasks: number
  active_team_members: number
}

/** GET /api/leadership/divisions — per-division summary */
export type LeadershipDivisionsData = Record<
  string,
  { team_size: number; open_tasks: number; roadmap_status: string }
>

// ============================================================================
// MEDICARE QUOTE — services/api/src/routes/medicare-quote.ts
// ============================================================================

/** POST /api/medicare-quote/quotes — Med Supp quote results */
export interface MedicareQuoteData {
  quotes: MedicareQuoteItem[]
  count: number
  input: MedicareQuoteInput
}

export interface MedicareQuoteItem {
  company_id: number
  carrier: string
  am_best_rating: string | null
  naic_code: string | null
  plan_letter: string
  monthly_premium: number
  annual_premium: number
  rate_type: string
  effective_date: string
  eft_discount: boolean
}

export interface MedicareQuoteInput {
  zip: string
  age: number
  gender: 'M' | 'F'
  tobacco: boolean
  plan_letter: string
  effective_date: string
}

/** GET /api/medicare-quote/companies — carrier list */
export interface MedicareCompaniesData {
  companies: MedicareCompany[]
  count: number
}

export interface MedicareCompany {
  id: number
  name: string
  naic_code?: string
  am_best_rating?: string
}

/** GET /api/medicare-quote/plan-letters — available plan letters */
export interface MedicarePlanLettersData {
  plan_letters: MedicarePlanLetter[]
}

export interface MedicarePlanLetter {
  key: string
  label: string
  description: string
}

/** GET /api/medicare-quote/status — CSG API configuration status */
export interface MedicareQuoteStatusData {
  configured: boolean
  provider: string
}

// ============================================================================
// OPPORTUNITIES — services/api/src/routes/opportunities.ts
// ============================================================================

/** GET /api/opportunities — paginated list */
export type OpportunityListDTO = OpportunityDTO[]

/** GET /api/opportunities/:id — single opportunity */
export type OpportunityDTO = Opportunity & { id: string }

/** POST /api/opportunities — created opportunity echoed back */
export type OpportunityCreateDTO = OpportunityDTO

/** PATCH /api/opportunities/:id — updated opportunity */
export type OpportunityUpdateDTO = OpportunityDTO

/** DELETE /api/opportunities/:id — soft-deleted (closed_lost) */
export interface OpportunityDeleteResult {
  id: string
  stage: 'closed_lost'
}

/** GET /api/opportunities/field-schemas — all pipeline custom field schemas */
export type { PipelineFieldSchema, CustomFieldDef, CustomFieldType } from '../opportunities/custom-fields'

// ============================================================================
// ORG — services/api/src/routes/org.ts
// ============================================================================

/** GET /api/org — list of org units */
export type OrgUnitListDTO = OrgUnitDTO[]

/** GET /api/org/:id — single org unit */
export type OrgUnitDTO = OrgUnit & { id: string }

/** GET /api/org/:id/members — users belonging to an org unit */
export type OrgUnitMembersDTO = UserDTO[]

// ============================================================================
// PRODUCTS — services/api/src/routes/products.ts
// ============================================================================

/** GET /api/products — list of products */
export type ProductListDTO = ProductDTO[]

/** GET /api/products/:id — single product */
export type ProductDTO = Product & { id: string }

// ============================================================================
// QUE — services/api/src/routes/que.ts
// ============================================================================

/** GET /api/que — list of QUE sessions */
export type QueSessionListDTO = QueSessionDTO[]

/** Single QUE session (stripped of internal fields) */
export type QueSessionDTO = Record<string, unknown> & { id: string }

/** GET /api/que/:sessionId — session with embedded quotes + recommendation */
export interface QueSessionDetailData extends Record<string, unknown> {
  quotes: Array<Record<string, unknown>>
  recommendation: Record<string, unknown> | null
}

/** POST /api/que — created session */
export interface QueSessionCreateResult {
  session_id: string
}

/** POST /api/que/:sessionId/quote — added quote */
export interface QueQuoteCreateResult {
  quote_id: string
}

/** PATCH /api/que/:sessionId — updated session fields */
export interface QueSessionUpdateResult {
  session_id: string
  updated: string[]
}

/** POST /api/que/:sessionId/recommendation — saved recommendation */
export interface QueRecommendationCreateResult {
  recommendation_id: string
}

/** POST /api/que/:sessionId/generate-output — generated output stubs */
export interface QueGenerateOutputData {
  outputs: QueOutputStub[]
}

export interface QueOutputStub {
  key: string
  status: 'pending'
  drive_url: null
}

/** POST /api/que/:sessionId/complete — session completed */
export interface QueSessionCompleteResult {
  session_id: string
  status: 'complete'
}

// ============================================================================
// SYNC — services/api/src/routes/sync.ts
// ============================================================================

/** POST /api/sync/agent — agent sync with related data */
export interface SyncAgentData {
  agent: Record<string, unknown> & { id: string }
  stats: {
    clients: number
    accounts: number
    revenue_records: number
    total_revenue: number
  }
  related: {
    clients: Array<Record<string, unknown> & { id: string }>
    revenue: Array<Record<string, unknown> & { id: string }>
  }
}

/** POST /api/sync/client — client sync with related data */
export interface SyncClientData {
  client: Record<string, unknown> & { id: string }
  agent: (Record<string, unknown> & { id: string }) | null
  stats: {
    accounts: number
    revenue_records: number
    total_revenue: number
  }
  related: {
    accounts: Array<Record<string, unknown> & { id: string }>
    revenue: Array<Record<string, unknown> & { id: string }>
  }
}

/** POST /api/sync/account — account sync with related data */
export interface SyncAccountData {
  account: Record<string, unknown> & { id: string }
  client: (Record<string, unknown> & { id: string }) | null
  agent: (Record<string, unknown> & { id: string }) | null
  stats: {
    revenue_records: number
    total_revenue: number
  }
  related: {
    revenue: Array<Record<string, unknown> & { id: string }>
  }
}

// ============================================================================
// USERS — services/api/src/routes/users.ts
// ============================================================================

/** GET /api/users — list of all users */
export type UserListDTO = UserDTO[]

/** GET /api/users/me — current authenticated user profile */
export type UserMeDTO = UserDTO

/** GET /api/users/:email — single user by email */
export type UserDTO = User & { id: string }

/** PATCH /api/users/:email — updated user profile */
export type UserUpdateDTO = UserDTO

// ============================================================================
// WEBHOOKS — services/api/src/routes/webhooks.ts
// ============================================================================

/** POST /api/webhooks/sendgrid — SendGrid event processing result */
export interface WebhookSendgridResult {
  processed: number
  errors: number
  total: number
}

/**
 * POST /api/webhooks/twilio/sms — Twilio SMS callback
 * Note: Returns TwiML XML, not JSON. No DTO needed.
 *
 * POST /api/webhooks/twilio/voice — Twilio Voice callback
 * Note: Returns TwiML XML, not JSON. No DTO needed.
 */

/** POST /api/webhooks/docusign — DocuSign Connect event processing */
export interface WebhookDocusignResult {
  processed: boolean
  package_id?: string
  old_status?: string
  new_status?: string
  reason?: string
}
