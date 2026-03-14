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
  client_status: string
  client_classification: string
  source: string
  created_at: string
  updated_at: string
  [key: string]: unknown // 107 total fields
}

export interface Agent {
  agent_id: string
  first_name: string
  last_name: string
  email: string
  npn: string
  agent_status: string
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
  producer_status: string
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
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Opportunity {
  opportunity_id: string
  client_id?: string
  agent_id?: string
  stage: string
  pipeline: string
  value: number
  source: string
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
  npn?: string
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
// CLIENT STATUSES (Builder 3)
// ============================================================================

export const CLIENT_STATUSES = [
  'Active',
  'Active - Internal',
  'Active - External',
  'Inactive',
  'Pending',
  'Deceased',
  'Deleted',
] as const

export type ClientStatus = typeof CLIENT_STATUSES[number]

// ============================================================================
// ACCOUNT TYPE CATEGORIES (Builder 3)
// ============================================================================

export const ACCOUNT_TYPE_CATEGORIES = [
  'Annuity',
  'Life',
  'Medicare',
  'BD/RIA',
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
