// ---------------------------------------------------------------------------
// ATLAS Intelligence Types
// ---------------------------------------------------------------------------

export type GapStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY'
export type SourceMethod = 'API_FEED' | 'WEBHOOK' | 'MANUAL_CSV' | 'NOT_AVAILABLE' | 'PORTAL_PULL' | 'BIGQUERY'
export type SourceFrequency = 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ON_DEMAND' | 'AS_NEEDED' | 'NONE'
export type ToolType = 'FUNCTION' | 'MCP_TOOL' | 'API_ENDPOINT' | 'LAUNCHD' | 'SCRIPT'
export type ToolCategory = 'INTAKE_QUEUING' | 'EXTRACTION_APPROVAL' | 'NORMALIZATION_VALIDATION' | 'MATCHING_DEDUP' | 'EXTERNAL_ENRICHMENT' | 'BULK_OPERATIONS'
export type StageType = 'EXTERNAL' | 'MCP_TOOL' | 'GAS_FUNCTION' | 'API_ENDPOINT' | 'MATRIX_TAB' | 'FRONTEND' | 'LAUNCHD' | 'SCRIPT' | 'CLOUD_FUNCTION' | 'NOTIFICATION'
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
  default_category: string // 'medicare' | 'annuity' | 'life' | 'investments'
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

// ---------------------------------------------------------------------------
// Registry Types — TOOL | SUPER_TOOL | WIRE
// ---------------------------------------------------------------------------

export type RegistryEntryType = 'TOOL' | 'SUPER_TOOL' | 'WIRE'

export interface RegistryEntry {
  id: string
  type: RegistryEntryType
  name: string
  description: string
}

// ---------------------------------------------------------------------------
// Atomic Tool Definition
// ---------------------------------------------------------------------------

export interface AtomicToolDefinition {
  tool_id: string
  name: string
  description: string
  /** Which super tools use this atomic tool */
  used_by?: string[]
  /** Tool category for ATLAS registry grouping */
  category?: string
}

export interface AtomicToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  /** Number of records processed */
  processed?: number
  /** Number of records that passed/succeeded */
  passed?: number
  /** Number of records that failed/were filtered out */
  failed?: number
}

// ---------------------------------------------------------------------------
// Super Tool Definition
// ---------------------------------------------------------------------------

export interface SuperToolDefinition {
  super_tool_id: string
  name: string
  description: string
  /** IDs of atomic tools this super tool orchestrates, in execution order */
  tools: string[]
}

export interface SuperToolContext {
  /** Who or what triggered this execution */
  triggered_by: string
  /** Target Firestore collection (for write/match operations) */
  target_collection?: string
  /** Column mappings from introspection (for extract/normalize) */
  column_mappings?: ColumnMapping[]
  /** Format ID if matched from format library */
  format_id?: string
  /** Account category hint: medicare, annuity, life, investments */
  target_category?: string
  /** Existing records for dedup matching */
  existing_records?: Record<string, unknown>[]
  // ── Injected by wire executor on Cloud Run ──
  /** Download a file from Google Drive by ID */
  downloadFile?: (fileId: string) => Promise<{ buffer: Buffer; mimeType: string; name: string }>
  /** Move a file in Google Drive to a new folder */
  moveFile?: (fileId: string, toFolderId: string, newName?: string) => Promise<void>
  /** List subfolders within a Google Drive folder */
  listSubfolders?: (folderId: string) => Promise<Array<{ id: string; name: string }>>
  /** Load active document taxonomy entries from Firestore */
  loadTaxonomy?: () => Promise<Array<{ document_type: string; pipeline?: string; owner_role?: string; extraction_hints?: string; required_fields?: string; suppress_fields?: string }>>
  /** Load learning library entries for building type-specific intelligence hints */
  loadLearning?: () => Promise<Array<{ document_type: string; learning_type: string; target_field?: string; original_value?: string; corrected_value?: string }>>
  // ── Carried through pipeline ──
  /** Source file ID from Drive (set by SUPER_PREPARE) */
  source_file_id?: string
  /** Client ID associated with this wire execution */
  client_id?: string
  /** Intake source identifier */
  source?: string
  /** Document type determined by classification */
  document_type?: string
  /** ACF subfolder for filing */
  acf_subfolder?: string
  /** Temp directory created by SUPER_PREPARE for cleanup */
  tmp_dir?: string
  /** Additional context data */
  [key: string]: unknown
}

export interface SuperToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  /** Per-tool results for audit trail */
  tool_results?: Record<string, AtomicToolResult>
  /** Total records in, records out */
  stats?: {
    records_in: number
    records_out: number
    filtered: number
    errors: number
  }
}

// ---------------------------------------------------------------------------
// Wire Definition (updated — super tool composition)
// ---------------------------------------------------------------------------

export interface WireDefinitionV2 {
  wire_id: string
  name: string
  description: string
  /** Product lines this wire handles: 'ALL' | 'MAPD' | 'FIA' | etc. */
  product_lines: string[]
  /** Data domains: 'ENROLLMENT' | 'COMMISSIONS' | 'ACCOUNTS' | 'DEMOGRAPHICS' | 'REFERENCE' */
  data_domains: string[]
  /** Super tool IDs executed in sequence */
  super_tools: string[]
  /** Legacy stage list (retained for traceability, maps to old WireDefinition.stages) */
  stages: WireStage[]
}
