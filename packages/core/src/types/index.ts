// Core types for toMachina — derived from TAB_SCHEMAS in CORE_Database.gs

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface Client {
  client_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  dob: string
  ssn_last4?: string
  status: string
  client_classification: string
  source: string
  /** UUID of the assigned user (from users collection, user_id field). Replaces legacy agent_id. */
  assigned_user_id?: string
  /** @deprecated Legacy field — use assigned_user_id instead. Points to row_N in old agents collection. */
  agent_id?: string
  /** FK to households collection — links this client to their household group. */
  household_id?: string
  created_at: string
  updated_at: string
  [key: string]: unknown // 107 total fields
}

/**
 * @deprecated The agents collection is being replaced. Internal team members are
 * now tracked via `users` with `is_agent: true`. External producers use the `producers`
 * collection. This interface is retained for backward compatibility during the transition.
 */
export interface Agent {
  agent_id: string
  first_name: string
  last_name: string
  email: string
  npn: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Producer {
  producer_id: string
  first_name: string
  last_name: string
  email: string
  npn: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Account {
  account_id: string
  client_id: string
  account_type: string
  carrier: string
  product: string
  policy_number: string
  status: string
  premium: number
  face_amount: number
  effective_date: string
  /** Underwriting charter legal entity (e.g., "Accendo Insurance Company") */
  carrier_charter?: string
  /** Charter short code (e.g., "ACC") */
  charter_code?: string
  /** NAIC code for the underwriting charter */
  naic_code?: string
  /** Parent brand (e.g., "Aetna / CVS Health") */
  parent_carrier?: string
  /** Carrier doc ID in Firestore carriers collection */
  carrier_id?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Opportunity {
  opportunity_id: string
  client_id?: string
  agent_id?: string
  /** Admin staff processing this opportunity (separate from agent_id who wrote the policy) */
  assignee_id?: string
  stage: string
  pipeline: string
  value: number
  source: string
  /** Pipeline-specific data fields (e.g. policy_number, premium, tax_status) */
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Revenue {
  revenue_id: string
  account_id: string
  agent_id: string
  amount: number
  revenue_type: string
  period: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface User {
  email: string
  /** Stable UUID for cross-collection references. All 14 users already have this populated. */
  user_id?: string
  first_name: string
  last_name: string
  role: string
  level: number
  division: string
  unit: string
  manager_email: string
  status: string
  entitlements: string[]
  slack_id?: string
  phone?: string
  job_title?: string
  aliases?: string[]
  personal_email?: string
  location?: string
  /** National Producer Number — only relevant when is_agent is true. */
  npn?: string
  /** Whether this user is a licensed insurance agent eligible for client assignment. */
  is_agent?: boolean
  /** Whether this user is a Registered Rep (Series 7 — BD side: Gradient Securities, RBC). */
  is_rr?: boolean
  /** Whether this user is an Investment Advisor Rep (Series 65/66 — RIA side: Gradient Wealth, Schwab). */
  is_iar?: boolean
  hire_date?: string
  google_chat_id?: string
  employee_profile?: Record<string, unknown>
  module_permissions?: Record<string, string[]>
  [key: string]: unknown
}

export interface Carrier {
  carrier_id: string
  name: string
  naic_code?: string
  parent_carrier?: string
  product_types?: string[]
  status: string
  am_best_rating?: string
  website?: string
  contact_phone?: string
  contact_email?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Product {
  product_id: string
  carrier_id: string
  name: string
  product_type: string
  core_product_type?: string
  status: string
  description?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface OrgUnit {
  entity_id: string
  entity_type: string
  name: string
  parent_id?: string
  manager_email?: string
  slack_channel_id?: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Campaign {
  campaign_id: string
  name: string
  campaign_name?: string
  type: string
  campaign_type?: string
  status: string
  trigger_type?: string
  audience?: string
  template_ids?: string[]
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Template {
  template_id: string
  name: string
  template_name?: string
  type: string
  template_type?: string
  channel: string
  campaign_id?: string
  subject?: string
  body?: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CaseTask {
  task_id: string
  client_id?: string
  account_id?: string
  title: string
  task_type?: string
  description?: string
  status: string
  priority?: string
  assigned_to?: string
  due_date?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Communication {
  comm_id: string
  communication_id?: string
  client_id?: string
  channel: string
  direction: string
  subject?: string
  body?: string
  status: string
  sent_at?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CompGrid {
  grid_id: string
  carrier_id: string
  product_type: string
  level: string
  rate: number
  effective_date?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface AtlasSource {
  source_id: string
  name: string
  type: string
  category: string
  status: string
  frequency?: string
  last_pull?: string
  owner?: string
  description?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FlowPipeline {
  pipeline_key: string
  name: string
  description?: string
  status: string
  stages?: string[]
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FlowInstance {
  instance_id: string
  pipeline_key: string
  subject_type: string
  subject_id: string
  current_stage: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// --- Builder 2: Additional entity types ---

export interface Pipeline {
  pipeline_id: string
  pipeline_name: string
  status: string
  pipeline_type: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Relationship {
  relationship_id: string
  client_id: string
  related_client_id?: string
  relationship_type: string
  created_at: string
  [key: string]: unknown
}

export interface Activity {
  activity_id: string
  client_id: string
  activity_type: string
  description: string
  created_at: string
  [key: string]: unknown
}

export interface ContentBlock {
  block_id: string
  block_name: string
  block_type: string
  content: string
  [key: string]: unknown
}

export interface SourceRegistry {
  source_id: string
  source_name: string
  source_type: string
  status: string
  [key: string]: unknown
}

// --- Householding ---

export interface Household {
  household_id: string
  household_name: string
  primary_contact_id: string
  primary_contact_name?: string
  members: HouseholdMember[]
  address?: string
  city?: string
  state?: string
  zip?: string
  household_status: string
  assigned_user_id?: string
  acf_folder_id?: string
  acf_folder_url?: string
  aggregate_financials?: HouseholdFinancials
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface HouseholdMember {
  client_id: string
  client_name?: string
  role: 'primary' | 'spouse' | 'child' | 'parent' | 'sibling' | 'other'
  relationship: string
  added_at: string
}

export interface HouseholdFinancials {
  combined_income?: number
  combined_net_worth?: number
  combined_investable_assets?: number
  filing_status?: string
  total_accounts?: number
  total_premium?: number
  total_face_amount?: number
  last_calculated?: string
}

// ============================================================================
// ENTITLEMENT TYPES
// ============================================================================

export type UserLevel = 'OWNER' | 'EXECUTIVE' | 'LEADER' | 'USER'

export interface Entitlement {
  moduleKey: string
  suite: string
  minLevel: number
  status: 'LIVE' | 'BETA' | 'DISABLED'
}

// ============================================================================
// API RESPONSE TYPE (Builder 3)
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// DEDUP/MATCH TYPES (Builder 3)
// ============================================================================

export type DedupTier = 'MERGED' | 'MERGED_NOTIFY' | 'REVIEW_NEEDED' | 'INSERTED'

export interface DedupResult {
  tier: DedupTier
  score: number
  method: string
  existingId?: string
  mergedFields?: string[]
}

// ============================================================================
// INTAKE STATUSES (Builder 3)
// ============================================================================

export const INTAKE_STATUSES = [
  'Pending',
  'Processing',
  'Approved',
  'Rejected',
  'Needs Review',
  'Error',
  'Complete',
] as const

export type IntakeStatus = typeof INTAKE_STATUSES[number]

// ============================================================================
// CLIENT STATUSES
// ============================================================================

export const CLIENT_STATUSES = [
  'Active',
  'Active - Affiliate (OK to Market)',
  'Active - Affiliate (Do Not Market)',
  'Prospect',
  'Inactive',
  'Inactive - Fired',
  'Inactive - Deceased',
  'Inactive - Complaint',
  'Unknown',
] as const

export type ClientStatus = typeof CLIENT_STATUSES[number]

// ============================================================================
// ACCOUNT STATUSES
// ============================================================================

export const ACCOUNT_STATUSES = [
  'Active',
  'Pending',
  'Inactive',
  'Terminated',
  'Surrendered',
  'Cancelled',
  'Lapsed',
  'Matured',
  'Deceased',
  'Claim',
  'Unknown',
] as const

export type AccountStatus = typeof ACCOUNT_STATUSES[number]

// ============================================================================
// ACCOUNT TYPE CATEGORIES (Builder 3)
// ============================================================================

export const ACCOUNT_TYPE_CATEGORIES = [
  'Annuity',
  'Life',
  'Medicare',
  'Investments',
  'Banking',
] as const

export type AccountTypeCategory = typeof ACCOUNT_TYPE_CATEGORIES[number]

// ============================================================================
// ACCESS CENTER TYPES
// ============================================================================

export type AccessStatus = 'active' | 'pending' | 'expired' | 'not_started'
export type AccessType = 'api' | 'portal'
export type AccessCategory = 'medicare' | 'annuity' | 'life' | 'investment' | 'financial' | 'government' | 'other'

export interface AccessItem {
  access_id: string
  client_id: string
  type: AccessType
  service_name: string
  subheading?: string
  category: AccessCategory
  carrier_id?: string
  product_type?: string
  status: AccessStatus
  portal_url?: string
  username?: string
  auth_status: 'none' | 'sent' | 'on_file'
  auth_doc_url?: string
  last_verified?: string
  last_login?: string
  notes?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// ============================================================================
// PROZONE TYPES
// ============================================================================

export interface Territory {
  territory_id: string
  territory_name: string
  state: string
  region?: string
  counties: TerritoryCounty[]
  zones: Zone[]
  status: 'Active' | 'Inactive'
  created_at: string
  updated_at: string
}

export interface TerritoryCounty {
  county: string
  zone_id: string
  client_count?: number
}

export interface Zone {
  zone_id: string
  zone_name: string
  territory_id: string
  resolution_type: 'county' | 'zip'
  assignments: ZoneAssignment[]
}

export interface ZoneAssignment {
  county?: string
  zip?: string
  zone_id: string
}

export interface SpecialistConfig {
  config_id: string
  user_id: string
  specialist_name: string
  territory_id: string
  origin_zip: string
  tier_map: TierMapEntry[]
  office_days: string[]
  field_days: string[]
  slot_templates: SlotTemplate[]
  meeting_criteria: MeetingCriteria
  zone_lead_criteria: ZoneLeadCriteria
  calendar_booking_url?: string
  team: TeamMember[]
  status: 'Active' | 'Inactive'
  created_at: string
  updated_at: string
}

export interface TierMapEntry {
  zone_id: string
  county?: string
  tier: 'I' | 'II' | 'III' | 'IV'
  drive_minutes: number
  slots_per_day: number
  first_slot: string
  last_slot: string
}

export interface SlotTemplate {
  tier: 'I' | 'II' | 'III' | 'IV'
  slots_per_day: number
  first_slot: string
  last_slot: string
  slot_duration_minutes: number
  departure_time?: string
  return_time?: string
}

export interface MeetingCriteria {
  field: { active_la: boolean; intra_territory: boolean; max_age: number }
  office: { active_la: boolean; min_age?: number; outer_zone: boolean }
}

export interface ZoneLeadCriteria {
  active_medicare_all: boolean
  active_la_80plus: boolean
  no_core_under_80: boolean
}

export interface TeamMember {
  user_id: string
  name: string
  role: 'coordinator' | 'associate'
}

// ============================================================================
// GUARDIAN — Data Protection Engine
// ============================================================================

export type {
  GuardianAudit,
  GuardianFinding,
  DataSnapshot,
  CollectionSnapshot,
  GuardianWrite,
  AnomalyAlert,
  AnomalyType,
  CollectionSchema,
  CollectionAuditResult,
  AuditReport,
  GuardianPhase,
  FindingSeverity,
  FindingCategory,
  FindingStatus,
  PhaseTransitionResult,
} from './guardian'

export {
  GUARDIAN_PHASES,
  GUARDIAN_PHASE_ORDER,
  FINDING_SEVERITIES,
  FINDING_CATEGORIES,
  FINDING_STATUSES,
  ANOMALY_TYPES,
} from './guardian'
