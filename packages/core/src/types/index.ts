// Core types for toMachina — derived from TAB_SCHEMAS in CORE_Database.gs

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
  [key: string]: unknown
}

export type UserLevel = 'OWNER' | 'EXECUTIVE' | 'LEADER' | 'USER'

export interface Entitlement {
  moduleKey: string
  suite: string
  minLevel: number
  status: 'LIVE' | 'BETA' | 'DISABLED'
}

// --- Additional types for migration batches 2-4 ---

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

export interface Campaign {
  campaign_id: string
  campaign_name: string
  campaign_type: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Template {
  template_id: string
  template_name: string
  campaign_id?: string
  template_type: string
  status: string
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

export interface Communication {
  communication_id: string
  client_id?: string
  channel: string
  direction: string
  created_at: string
  [key: string]: unknown
}

export interface CaseTask {
  task_id: string
  client_id?: string
  task_type: string
  status: string
  assigned_to?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}
