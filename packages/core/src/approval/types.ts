// ---------------------------------------------------------------------------
// Approval Engine Types — ported from RAPID_IMPORT IMPORT_Approval.gs
// ---------------------------------------------------------------------------

/** Status lifecycle: PENDING → APPROVED/EDITED/KILLED → EXECUTED/ERROR */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'EDITED' | 'KILLED' | 'EXECUTED' | 'ERROR'

/** Batch-level status */
export type BatchStatus = 'PENDING' | 'IN_REVIEW' | 'EXECUTED' | 'PARTIAL' | 'ERROR'

/** Source types for intake documents */
export type SourceType = 'SPC_INTAKE' | 'MAIL' | 'EMAIL' | 'MEET_TRANSCRIPT' | 'MANUAL' | 'IMPORT'

/** Target MATRIX routing */
export type TargetMatrix = 'PRODASH' | 'SENTINEL'

/** Target tabs (Firestore collection mapping) */
export type TargetTab =
  | '_CLIENT_MASTER'
  | '_ACCOUNT_BDRIA'
  | '_ACCOUNT_LIFE'
  | '_ACCOUNT_ANNUITY'
  | '_ACCOUNT_MEDICARE'
  | '_ACCOUNT_BANKING'
  | '_PRODUCER_MASTER'
  | '_AGENT_MASTER'
  | '_REVENUE_MASTER'

/** API endpoint mapping for each tab */
export type ApiEndpoint = '/client' | '/account' | '/agent' | '/revenue'

/** Account category canonical values */
export type AccountCategory = 'bdria' | 'life' | 'annuity' | 'medicare' | 'banking'

// ---------------------------------------------------------------------------
// Approval Item — one field-level write
// ---------------------------------------------------------------------------

export interface ApprovalItem {
  /** Unique ID per field approval row */
  approval_id: string
  /** Batch this item belongs to */
  batch_id: string
  /** Source of the extracted data */
  source_type: SourceType
  /** Google Drive file ID or source reference */
  source_id: string
  /** FK to intake queue */
  queue_id: string
  /** Target MATRIX (PRODASH or SENTINEL) */
  target_matrix: TargetMatrix
  /** Target tab/collection */
  target_tab: TargetTab
  /** Target field name */
  target_field: string
  /** API endpoint for write */
  api_endpoint: ApiEndpoint
  /** Existing record UUID (if matched), empty string if new */
  entity_id: string
  /** Display name for the entity (e.g., "John Smith") */
  entity_name: string
  /** Display category (e.g., "CLIENT / Identity") */
  display_category: string
  /** Display label (e.g., "First Name") */
  display_label: string
  /** Current value in MATRIX/Firestore */
  current_value: string
  /** Proposed value from extraction */
  proposed_value: string
  /** Confidence score from extraction (0-1) */
  confidence: number
  /** Current approval status */
  status: ApprovalStatus
  /** User who made the decision */
  decided_by: string
  /** ISO timestamp of decision */
  decided_at: string
  /** Slack message timestamp for deletion */
  slack_message_ts: string
  /** Slack channel ID */
  slack_channel: string
  /** ISO timestamp of creation */
  created_at: string
  /** Error message if status = ERROR */
  error_message: string
}

// ---------------------------------------------------------------------------
// Approval Batch — groups items from one extraction
// ---------------------------------------------------------------------------

export interface ApprovalBatch {
  /** Unique batch ID */
  batch_id: string
  /** Source document type */
  source_type: SourceType
  /** Source document ID */
  source_id: string
  /** Intake queue reference */
  queue_id: string
  /** Specialist who initiated the intake */
  specialist: string
  /** Entity name (first client in batch) */
  entity_name: string
  /** Batch-level status */
  status: BatchStatus
  /** All items in this batch */
  items: ApprovalItem[]
  /** Summary statistics */
  summary: BatchSummary
  /** Assigned reviewer email */
  assigned_to: string
  /** Slack notification info */
  slack_message_ts: string
  slack_channel: string
  /** ISO timestamps */
  created_at: string
  updated_at: string
  executed_at: string
  /** Execution results */
  execution_results: ExecutionResult[]
}

export interface BatchSummary {
  total: number
  by_matrix: Record<string, number>
  by_tab: Record<string, number>
  by_status: Record<ApprovalStatus, number>
  entity_name: string
}

export interface ExecutionResult {
  approval_id: string
  target_tab: string
  target_field: string
  entity_id: string
  status: 'success' | 'error'
  error_message?: string
  /** Resulting entity ID (for creates) */
  created_id?: string
}

// ---------------------------------------------------------------------------
// Extracted Data — input from watcher.js / Claude Vision
// ---------------------------------------------------------------------------

export interface ExtractedData {
  client?: Record<string, unknown>
  accounts?: {
    bdria?: Record<string, unknown>[]
    life?: Record<string, unknown>[]
    annuity?: Record<string, unknown>[]
    medicare?: Record<string, unknown>[]
    banking?: Record<string, unknown>[]
  }
  producer?: Record<string, unknown>
  revenue?: Record<string, unknown>[]
}

export interface ExtractionContext {
  source_type: SourceType
  source_id: string
  queue_id: string
  specialist: string
  entity_id?: string
  entity_name?: string
  confidence?: number
}

// ---------------------------------------------------------------------------
// Training Data — captures user corrections for extraction improvement
// ---------------------------------------------------------------------------

export interface TrainingRecord {
  training_id: string
  batch_id: string
  approval_id: string
  target_tab: string
  target_field: string
  /** What the extraction produced */
  original_value: string
  /** What the user corrected it to */
  corrected_value: string
  /** Extraction confidence (0-1) */
  confidence: number
  /** Source type */
  source_type: SourceType
  /** ISO timestamp */
  created_at: string
  /** User who made the correction */
  corrected_by: string
}

// ---------------------------------------------------------------------------
// Routing — reviewer assignment + Firestore collection mapping
// ---------------------------------------------------------------------------

export interface RoutingResult {
  reviewer_email: string
  slack_channel: string
  division: 'SALES' | 'SERVICE' | 'LEGACY'
}

// ---------------------------------------------------------------------------
// Configuration Constants
// ---------------------------------------------------------------------------

/** Fields that should be auto-skipped during flatten (auto-generated IDs + metadata) */
export const SKIP_FIELDS = new Set([
  'client_id', 'account_id', 'agent_id', 'producer_id', 'revenue_id',
  'created_at', 'updated_at', 'ghl_object_id', 'ghl_contact_id',
  'import_source', 'gdrive_folder_url', 'acf_link', 'jira_key',
  '_id', '_migrated_at', '_source',
])

/** Tab → API endpoint mapping */
export const TAB_TO_ENDPOINT: Record<string, ApiEndpoint> = {
  '_CLIENT_MASTER': '/client',
  '_ACCOUNT_BDRIA': '/account',
  '_ACCOUNT_LIFE': '/account',
  '_ACCOUNT_ANNUITY': '/account',
  '_ACCOUNT_MEDICARE': '/account',
  '_ACCOUNT_BANKING': '/account',
  '_AGENT_MASTER': '/agent',
  '_PRODUCER_MASTER': '/agent',
  '_REVENUE_MASTER': '/revenue',
}

/** Tab → Matrix routing */
export const TAB_TO_MATRIX: Record<string, TargetMatrix> = {
  '_CLIENT_MASTER': 'PRODASH',
  '_ACCOUNT_BDRIA': 'PRODASH',
  '_ACCOUNT_LIFE': 'PRODASH',
  '_ACCOUNT_ANNUITY': 'PRODASH',
  '_ACCOUNT_MEDICARE': 'PRODASH',
  '_ACCOUNT_BANKING': 'PRODASH',
  '_AGENT_MASTER': 'SENTINEL',
  '_PRODUCER_MASTER': 'SENTINEL',
  '_REVENUE_MASTER': 'SENTINEL',
}

/** Account category string → tab mapping (with aliases) */
export const ACCOUNT_CATEGORY_TO_TAB: Record<string, TargetTab> = {
  'bdria': '_ACCOUNT_BDRIA',
  'bd_ria': '_ACCOUNT_BDRIA',
  'investment': '_ACCOUNT_BDRIA',
  'brokerage': '_ACCOUNT_BDRIA',
  'life': '_ACCOUNT_LIFE',
  'annuity': '_ACCOUNT_ANNUITY',
  'medicare': '_ACCOUNT_MEDICARE',
  'banking': '_ACCOUNT_BANKING',
  'bank': '_ACCOUNT_BANKING',
}

/** Tab → canonical account category */
export const TAB_TO_CANONICAL_CATEGORY: Record<string, AccountCategory> = {
  '_ACCOUNT_BDRIA': 'bdria',
  '_ACCOUNT_LIFE': 'life',
  '_ACCOUNT_ANNUITY': 'annuity',
  '_ACCOUNT_MEDICARE': 'medicare',
  '_ACCOUNT_BANKING': 'banking',
}

/** Tab → Firestore collection mapping */
export const TAB_TO_COLLECTION: Record<string, string> = {
  '_CLIENT_MASTER': 'clients',
  '_ACCOUNT_BDRIA': 'accounts',
  '_ACCOUNT_LIFE': 'accounts',
  '_ACCOUNT_ANNUITY': 'accounts',
  '_ACCOUNT_MEDICARE': 'accounts',
  '_ACCOUNT_BANKING': 'accounts',
  '_AGENT_MASTER': 'agents',
  '_PRODUCER_MASTER': 'agents',
  '_REVENUE_MASTER': 'revenue',
}

/** Acronyms for display label generation */
export const FIELD_ACRONYMS = new Set([
  'id', 'ghl', 'acf', 'dob', 'ssn', 'npn', 'pua', 'rmd', 'ltc', 'mec',
  'myga', 'bdria', 'uw', 'soa', 'mapd', 'pbp', 'cms', 'hicn', 'fmv',
  'rpi', 'db', 'poa', 'bd', 'ria', 'gi', 'pct', 'zip',
])
