/**
 * QUE Engine Types
 *
 * Core type definitions for the QUE (Quoting & Underwriting Engine).
 * Sessions, quotes, recommendations, profiles, sources, and outputs.
 *
 * Pure types only — no runtime code.
 */

import type { Household, HouseholdFinancials } from '../types'

// ============================================================================
// ENUMS / UNION TYPES
// ============================================================================

export type QueSessionStatus =
  | 'draft'
  | 'quoting'
  | 'comparing'
  | 'recommending'
  | 'complete'
  | 'archived'

export type QueProductLine = 'LIFE' | 'ANNUITY' | 'MEDICARE' | 'INVESTMENT'

export type QueAdapterType = 'api' | 'manual' | 'playwright' | 'mcp'

export type QueGapStatus = 'GREEN' | 'YELLOW' | 'RED'

export type QueSolutionCategory =
  | 'INCOME_NOW'
  | 'INCOME_LATER'
  | 'ESTATE_MAX'
  | 'GROWTH_MAX'
  | 'LTC_MAX'
  | 'ROTH_CONVERSION'
  | 'TAX_HARVEST'
  | 'MGE_DETAILED'

export type QueComparisonAlgorithm =
  | 'lowest_premium'
  | 'best_value'
  | 'carrier_rated'
  | 'custom'

// ============================================================================
// SESSION
// ============================================================================

export interface QueSession {
  session_id: string
  household_id: string
  household_name: string
  product_line: QueProductLine
  status: QueSessionStatus

  /** Optional link to the Flow Engine instance driving this session */
  flow_instance_id?: string
  /** Current step in the flow workflow */
  flow_step_id?: string

  /** Snapshot of household data at session creation (immutable during session) */
  client_snapshot: {
    members: {
      client_id: string
      client_name: string
      role: string
      dob?: string
      gender?: string
      state?: string
    }[]
    accounts: Record<string, unknown>[]
    financials?: HouseholdFinancials
  }

  /** Product-line-specific parameters (e.g., zip, plan_letter for Medicare) */
  quote_parameters: Record<string, unknown>

  /** All quote IDs fetched during this session */
  quote_ids: string[]
  /** Subset of quote_ids selected for recommendation */
  selected_quote_ids: string[]
  /** Recommendation document ID, if created */
  recommendation_id?: string
  /** Output document IDs (PDFs, illustrations, etc.) */
  output_ids: string[]

  assigned_to: string
  created_by: string
  created_at: string
  updated_at: string
  finalized_at?: string
}

// ============================================================================
// QUOTE
// ============================================================================

export interface QueQuote {
  quote_id: string
  session_id: string
  source_id: string
  carrier_id?: string
  carrier: string
  product_name: string

  premium_monthly?: number
  premium_annual?: number
  premium_single?: number

  /** Source-specific details (benefit amounts, riders, rates, etc.) */
  details: Record<string, unknown>

  /** Computed score (0-100) from comparison algorithm */
  score?: number
  /** Rank within the scored set (1 = best) */
  rank?: number
  /** Flags for attention (e.g., "lowest_premium", "best_rated", "missing_data") */
  flags: string[]

  fetched_at: string
  /** Raw response from source, for audit/debug */
  source_raw?: string
}

// ============================================================================
// RECOMMENDATION
// ============================================================================

export interface QueRecommendation {
  recommendation_id: string
  session_id: string
  household_id: string
  product_line: QueProductLine
  solution_category: QueSolutionCategory

  selected_products: {
    quote_id: string
    carrier: string
    product_name: string
    rationale: string
  }[]

  advisor_notes: string
  created_by: string
  created_at: string
  updated_at: string
}

// ============================================================================
// PROFILE (admin-configured quoting profile)
// ============================================================================

export interface QueProfile {
  profile_id: string
  profile_name: string
  product_line: QueProductLine
  description: string

  /** Which sources to query */
  source_ids: string[]
  /** How to rank results */
  comparison_algorithm: QueComparisonAlgorithm
  /** Which output templates to generate */
  output_template_ids: string[]
  /** Which solution categories this profile supports */
  solution_categories: QueSolutionCategory[]
  /** Client fields required before quoting can begin */
  required_client_fields: string[]
  /** Default quote parameters (can be overridden per session) */
  default_parameters: Record<string, unknown>

  status: 'active' | 'draft' | 'archived'
  created_at: string
  updated_at: string
}

// ============================================================================
// SOURCE (carrier/vendor integration definition)
// ============================================================================

export interface QueSource {
  que_source_id: string
  /** Optional link to ATLAS source registry */
  atlas_source_id?: string
  source_name: string
  product_lines: QueProductLine[]
  adapter_type: QueAdapterType

  adapter_config: {
    /** API endpoint URL */
    endpoint?: string
    /** Auth mechanism (bearer, api_key, oauth, etc.) */
    auth_type?: string
    /** URL for manual quoting (opened in browser/Playwright) */
    manual_url?: string
    /** Fields to prefill on manual entry forms */
    prefill_fields?: string[]
    /** Template for building API requests */
    request_template?: Record<string, unknown>
    /** Mapping from source response to QueQuote fields */
    response_mapping?: Record<string, unknown>
  }

  /** JSON Schema describing required input fields */
  input_schema: Record<string, unknown>
  /** JSON Schema describing output shape */
  output_schema: Record<string, unknown>

  /** How automated this source is */
  automation_level: 'full' | 'semi' | 'manual'
  /** Current integration method description */
  current_method: string
  /** Target integration method description */
  target_method: string
  /** Percentage of automation achieved (0-100) */
  automation_pct: number
  /** Gap status relative to full automation */
  gap_status: QueGapStatus

  status: 'active' | 'inactive' | 'coming_soon'
  created_at: string
  updated_at: string
}

// ============================================================================
// OUTPUT TEMPLATE
// ============================================================================

export interface QueOutputTemplate {
  template_id: string
  template_name: string
  product_lines: QueProductLine[]
  output_type: 'comparison' | 'illustration' | 'recommendation' | 'summary' | 'factfinder'

  /** Optional link to DEX form for PDF generation */
  dex_form_id?: string
  /** Field mapping from session/quote data to template placeholders */
  data_mapping: Record<string, string>

  status: 'active' | 'draft'
  created_at: string
  updated_at: string
}

// ============================================================================
// OUTPUT (generated document)
// ============================================================================

export interface QueOutput {
  output_id: string
  session_id: string
  client_id: string
  template_id: string
  output_type: string

  /** DEX package ID if filed via DEX */
  dex_package_id?: string
  /** Google Drive file ID of the generated document */
  drive_file_id?: string

  status: 'generating' | 'complete' | 'error'
  generated_at: string
  filed_at?: string
  error?: string
}
