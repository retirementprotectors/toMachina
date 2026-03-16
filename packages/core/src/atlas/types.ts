// ---------------------------------------------------------------------------
// ATLAS Intelligence Types
// ---------------------------------------------------------------------------

export type GapStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY'
export type SourceMethod = 'API_FEED' | 'WEBHOOK' | 'MANUAL_CSV' | 'NOT_AVAILABLE' | 'PORTAL_PULL' | 'BIGQUERY'
export type SourceFrequency = 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ON_DEMAND' | 'AS_NEEDED' | 'NONE'
export type ToolType = 'FUNCTION' | 'MCP_TOOL' | 'API_ENDPOINT' | 'LAUNCHD' | 'SCRIPT'
export type ToolCategory = 'INTAKE_QUEUING' | 'EXTRACTION_APPROVAL' | 'NORMALIZATION_VALIDATION' | 'MATCHING_DEDUP' | 'EXTERNAL_ENRICHMENT' | 'BULK_OPERATIONS'
export type StageType = 'EXTERNAL' | 'MCP_TOOL' | 'GAS_FUNCTION' | 'API_ENDPOINT' | 'MATRIX_TAB' | 'FRONTEND' | 'LAUNCHD' | 'SCRIPT'
export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED'
export type AutomationType = 'LAUNCHD' | 'GAS_TRIGGER' | 'CLOUD_FUNCTION' | 'CLOUD_SCHEDULER'

/**
 * AtlasSource is defined in ../types/index.ts with [key: string]: unknown.
 * Atlas-specific fields (carrier_name, gap_status, automation_pct, etc.)
 * are accessed via the index signature. Re-export for convenience.
 */
export type { AtlasSource } from '../types'

export interface AtlasTool {
  tool_id: string
  tool_name: string
  source_project: string
  source_file: string
  description: string
  category: ToolCategory
  tool_type: ToolType
  runnable: boolean
  run_target: string
  used_by_frontend: string
  product_lines: string
  data_domains: string
  status: string
  [key: string]: unknown
}

export interface WireStage {
  type: StageType
  name: string
  project?: string
  file?: string
  server?: string
  view?: string
  platform?: string
  detail?: string
}

export interface WireDefinition {
  wire_id: string
  name: string
  product_line: string
  data_domain: string
  stages: WireStage[]
}

export interface AutomationEntry {
  automation_id: string
  automation_name: string
  automation_type: AutomationType
  schedule: string
  script_path: string
  last_run_at: string
  last_status: string
  last_error: string
  expected_interval_hours: number
  owner: string
  status: string
  notes: string
}

export interface AutomationHealth {
  automation_id: string
  automation_name: string
  health: HealthStatus
  last_run_at: string
  elapsed_hours: number
  expected_hours: number
}

export interface GapGroup {
  name: string
  total: number
  green: number
  yellow: number
  red: number
  gray: number
  avg_automation: number
  health_score: number
}

// ---------------------------------------------------------------------------
// Format Library + Introspection Types
// ---------------------------------------------------------------------------

export interface AtlasFormat {
  format_id: string
  carrier_export_type: string
  carrier_name: string
  header_fingerprint: string
  column_map: Record<string, string>
  value_patterns: Record<string, { distinct_count: number; sample_values: unknown[]; dominant_type: string; null_rate: number }>
  dedup_keys: string[]
  default_category: string // 'medicare' | 'annuity' | 'life' | 'bdria'
  times_used: number
  last_used_at: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface IntrospectRun {
  run_id: string
  format_id: string | null
  header_fingerprint: string
  headers: string[]
  target_category: string
  match_method: 'fingerprint_exact' | 'fingerprint_partial' | 'carrier_detect' | 'full_introspect'
  overall_confidence: number
  column_mappings: ColumnMapping[]
  triggered_by: string
  created_at: string
}

export interface ColumnMapping {
  csv_header: string
  firestore_field: string
  confidence: number
  status: 'auto' | 'suggested' | 'unmapped'
  alternatives: { field: string; confidence: number }[]
}

export interface FieldProfile {
  distinct_count: number
  sample_values: unknown[]
  dominant_type: 'string' | 'number' | 'date' | 'currency' | 'boolean' | 'mixed'
  null_rate: number
  min_length?: number
  max_length?: number
}
