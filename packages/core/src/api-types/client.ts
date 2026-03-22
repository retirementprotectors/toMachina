/**
 * API DTOs — Group 1: Client / Account / Household
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/clients.ts
 *   services/api/src/routes/accounts.ts
 *   services/api/src/routes/households.ts
 *   services/api/src/routes/access.ts
 *   services/api/src/routes/activities.ts
 *   services/api/src/routes/case-tasks.ts
 *   services/api/src/routes/booking.ts
 *   services/api/src/routes/search.ts
 */

import type {
  Client,
  Account,
  Household,
  HouseholdMember,
  HouseholdFinancials,
  AccessItem,
  Activity,
  CaseTask,
  Relationship,
} from '../types'

// ============================================================================
// CLIENTS — services/api/src/routes/clients.ts
// ============================================================================

/** GET /api/clients — paginated list (each item stripped of internal fields) */
export type ClientListDTO = ClientDTO[]

/** GET /api/clients/:id — single client with Firestore doc ID */
export type ClientDTO = Client & { id: string }

/** POST /api/clients — created client echoed back */
export type ClientCreateDTO = ClientDTO

/** PATCH /api/clients/:id — updated client echoed back */
export type ClientUpdateDTO = ClientDTO

/** DELETE /api/clients/:id — soft delete confirmation */
export interface ClientDeleteResult {
  id: string
  status: 'deleted'
}

// ============================================================================
// CLIENT SUB-RESOURCES — nested under /api/clients/:id/*
// ============================================================================

/** GET /api/clients/:id/accounts — accounts for a client */
export type ClientAccountListDTO = AccountDTO[]

/** GET /api/clients/:id/activities — recent activities for a client */
export type ClientActivityListDTO = ActivityDTO[]

/** GET /api/clients/:id/relationships — relationships for a client */
export type ClientRelationshipListDTO = RelationshipDTO[]

// ============================================================================
// ACCOUNTS — services/api/src/routes/accounts.ts
// ============================================================================

/** GET /api/accounts — collection group list (includes _client_id from doc path) */
export type AccountListDTO = AccountWithClientDTO[]

/** Account with Firestore doc ID plus parent client ID injected from doc path */
export interface AccountWithClientDTO extends AccountDTO {
  _client_id: string
}

/** GET /api/accounts/:clientId/:accountId — single account */
export type AccountDTO = Account & { id: string }

/** POST /api/accounts/:clientId — created account echoed back */
export type AccountCreateDTO = AccountDTO

/** PATCH /api/accounts/:clientId/:accountId — updated account echoed back */
export type AccountUpdateDTO = AccountDTO

// ============================================================================
// HOUSEHOLDS — services/api/src/routes/households.ts
// ============================================================================

/** GET /api/households — paginated list */
export type HouseholdListDTO = HouseholdDTO[]

/** GET /api/households/:id — single household */
export type HouseholdDTO = Household & { id: string }

/** POST /api/households — created household echoed back */
export type HouseholdCreateDTO = HouseholdDTO

/** PATCH /api/households/:id — updated household echoed back */
export type HouseholdUpdateDTO = HouseholdDTO

/** DELETE /api/households/:id — soft delete (sets status Inactive) */
export interface HouseholdDeleteResult {
  id: string
  status: 'Inactive'
}

/** POST /api/households/:id/members — newly added member */
export interface HouseholdMemberAddResult {
  client_id: string
  client_name: string
  role: string
  relationship: string
  added_at: string
}

/** DELETE /api/households/:id/members/:clientId — removed member confirmation */
export interface HouseholdMemberRemoveResult {
  removed: string
}

/** POST /api/households/:id/recalculate — aggregate financials after recalc */
export type HouseholdRecalculateResult = HouseholdFinancials & {
  last_calculated: string
}

/** GET /api/households/:id/meeting-prep — household meeting preparation data */
export interface HouseholdMeetingPrepData {
  household_summary: {
    household_id: string
    household_name: string
    member_count: number
    address: string
    aggregate_financials: Partial<HouseholdFinancials>
  }
  member_inventory: MeetingPrepMemberInventory[]
  opportunities: string[]
  action_items: string[]
  generated_at: string
}

export interface MeetingPrepMemberInventory {
  client_id: string
  client_name: string
  role: string
  accounts_by_category: Record<string, Array<Record<string, unknown>>>
  total_premium: number
  total_face_amount: number
  account_count: number
}

/** POST /api/households/:id/appointments — created appointment */
export interface HouseholdAppointmentResult {
  appointment_id: string
  date: string
  time: string
  specialist_id: string
  zone_id: string
  tier: string
  type: 'field' | 'office'
  notes: string
  status: 'scheduled'
  created_at: string
}

/** POST /api/households/enrich-territories — batch enrichment result */
export interface HouseholdEnrichTerritoriesResult {
  enriched: number
  skipped: number
  total: number
}

// ============================================================================
// ACCESS — services/api/src/routes/access.ts
// ============================================================================

/** GET /api/access/:clientId — list access items for a client */
export type AccessItemListDTO = AccessItemDTO[]

/** GET /api/access/:clientId/:accessId — single access item */
export type AccessItemDTO = AccessItem & { id: string }

/** POST /api/access/:clientId — created access item echoed back (no Firestore `id` wrapper; uses access_id) */
export type AccessItemCreateDTO = AccessItem

/** PUT /api/access/:clientId/:accessId — updated access item */
export type AccessItemUpdateDTO = AccessItemDTO

/** DELETE /api/access/:clientId/:accessId — deleted confirmation */
export interface AccessItemDeleteResult {
  id: string
  status: 'deleted'
}

/** POST /api/access/:clientId/auto-generate — auto-generated items count */
export interface AccessAutoGenerateResult {
  created: number
}

// ============================================================================
// ACTIVITIES — services/api/src/routes/activities.ts
// ============================================================================

/** GET /api/activities — global activity log (paginated) */
export type ActivityListDTO = ActivityDTO[]

/** GET /api/activities/client/:clientId — client-scoped activity log */
export type ClientActivityFeedDTO = ActivityDTO[]

/** POST /api/activities — manually logged activity */
export type ActivityDTO = Activity & { id?: string }

/** GET /api/activities/household/:householdId — merged household activity feed */
export type HouseholdActivityDTO = (Activity & {
  id: string
  member_name: string
  member_client_id: string
})[]

// ============================================================================
// CASE TASKS — services/api/src/routes/case-tasks.ts
// ============================================================================

/** GET /api/case-tasks — paginated list */
export type CaseTaskListDTO = CaseTaskDTO[]

/** GET /api/case-tasks/:id — single case task */
export type CaseTaskDTO = CaseTask & { id: string }

/** POST /api/case-tasks — created case task echoed back */
export type CaseTaskCreateDTO = CaseTaskDTO

/** PATCH /api/case-tasks/:id — updated case task echoed back */
export type CaseTaskUpdateDTO = CaseTaskDTO

// ============================================================================
// RELATIONSHIPS (from clients.ts sub-route)
// ============================================================================

/** Individual relationship record with Firestore doc ID */
export type RelationshipDTO = Relationship & { id: string }

// ============================================================================
// BOOKING — services/api/src/routes/booking.ts
// ============================================================================

/** GET /api/booking/config/:slug — booking configuration for agent or team */
export interface BookingConfigData {
  agent: BookingAgentInfo
  bookingTypes: BookingType[]
  availability: BookingAvailability
  isTeam: boolean
}

export interface BookingAgentInfo {
  email: string
  all_emails?: string[]
  first_name?: string
  last_name?: string
  display_name: string
  job_title?: string
  slug: string
  photo_url?: string | null
  office_address?: string
}

export interface BookingType {
  name: string
  duration_minutes: number
  category: string
  modes: string[]
  auto_confirm: boolean
}

export interface BookingAvailability {
  timezone: string
  business_hours: Record<number, { start: string; end: string }>
  buffer_minutes: number
  max_advance_days: number
  slot_increment_minutes: number
}

/** GET /api/booking/busy — busy periods for a month */
export interface BookingBusyData {
  busy: Array<{ start: string; end: string }>
}

/** POST /api/booking — created booking confirmation */
export interface BookingCreateResult {
  booking_id: string
  agent_name: string
  meeting_type: string
  start: string
  end: string
  mode: string
  status: 'confirmed'
}

/** GET /api/booking/search-clients — client search results for booking form */
export interface BookingClientSearchItem {
  name: string
  email: string
  phone: string
}

export type BookingClientSearchDTO = BookingClientSearchItem[]

// ============================================================================
// SEARCH — services/api/src/routes/search.ts
// ============================================================================

/** GET /api/search — unified type-ahead search results */
export interface SearchResultsData {
  clients: SearchResultItem[]
  accounts: SearchResultItem[]
}

export interface SearchResultItem {
  id: string
  type: 'client' | 'account'
  label: string
  sublabel: string
  href: string
}
