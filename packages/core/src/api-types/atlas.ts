/**
 * API DTOs -- Group 5: ATLAS / Guardian / Compliance / Wire / Import
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/atlas.ts
 *   services/api/src/routes/guardian.ts
 *   services/api/src/routes/compliance.ts
 *   services/api/src/routes/wire.ts
 *   services/api/src/routes/import.ts
 */

import type {
  GuardianAudit,
  GuardianFinding,
  FindingSeverity,
  GuardianPhase,
} from '../types/guardian'
import type {
  ColumnMapping,
  WireStage,
} from '../atlas/types'

// ============================================================================
// ATLAS — services/api/src/routes/atlas.ts
// ============================================================================

// ── Sources CRUD ─────────────────────────────────────────────────────────────

/** GET /api/atlas/sources -- paginated list (internal fields stripped) */
export type AtlasSourceListDTO = Array<Record<string, unknown>>

/** GET /api/atlas/sources/:id -- single source detail */
export type AtlasSourceDTO = Record<string, unknown> & { id: string }

/** POST /api/atlas/sources -- created source echoed back */
export type AtlasSourceCreateDTO = Record<string, unknown> & { id: string }

/** PATCH /api/atlas/sources/:id -- partial update confirmation */
export interface AtlasSourceUpdateResult {
  id: string
  updated: string[]
}

/** DELETE /api/atlas/sources/:id -- soft delete confirmation */
export interface AtlasSourceDeleteResult {
  id: string
  deleted: true
}

// ── Tools CRUD ───────────────────────────────────────────────────────────────

/** GET /api/atlas/tools -- paginated list (internal fields stripped) */
export type AtlasToolListDTO = Array<Record<string, unknown>>

/** POST /api/atlas/tools -- created tool echoed back */
export type AtlasToolCreateDTO = Record<string, unknown> & { id: string }

/** PATCH /api/atlas/tools/:id -- partial update confirmation */
export interface AtlasToolUpdateResult {
  id: string
  updated: string[]
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** Single row from GET /api/atlas/analytics */
export interface AtlasGapAnalysisRow {
  name: string
  total: number
  green: number
  yellow: number
  red: number
  gray: number
  avg_automation: number
  health_score: number
}

/** GET /api/atlas/analytics -- gap analysis grouped by carrier/category/domain/portal */
export type AtlasGapAnalysisData = AtlasGapAnalysisRow[]

/** Single carrier scorecard from GET /api/atlas/analytics/carriers */
export interface AtlasCarrierScorecard {
  carrier: string
  total_sources: number
  gap_breakdown: Record<string, number>
  avg_automation: number
  sources: Array<Record<string, unknown>>
}

/** GET /api/atlas/analytics/carriers -- carrier scorecard list */
export type AtlasCarrierScorecardsData = AtlasCarrierScorecard[]

// ── Audit Trail ──────────────────────────────────────────────────────────────

/** GET /api/atlas/audit -- list of audit events */
export type AtlasAuditListDTO = Array<Record<string, unknown> & { id: string }>

/** POST /api/atlas/audit -- created audit event echoed back */
export type AtlasAuditCreateDTO = Record<string, unknown>

// ── Pipeline ─────────────────────────────────────────────────────────────────

/** Single pipeline stage from GET /api/atlas/pipeline */
export interface AtlasPipelineStage {
  stage: string
  label: string
  count: number
  pending: number
  processing: number
  color: string
}

/** GET /api/atlas/pipeline -- stage counts */
export type AtlasPipelineData = AtlasPipelineStage[]

// ── Wires ────────────────────────────────────────────────────────────────────

/** Single wire definition from GET /api/atlas/wires */
export interface AtlasWireDTO {
  wire_id: string
  name: string
  product_line: string
  data_domain: string
  stages: WireStage[]
}

/** GET /api/atlas/wires -- wire definition list */
export type AtlasWireListDTO = AtlasWireDTO[]

// ── Digest ───────────────────────────────────────────────────────────────────

/** POST /api/atlas/digest -- Slack digest result (sent) */
export interface AtlasDigestSentResult {
  sent: true
  channel: string
}

/** POST /api/atlas/digest -- Slack digest result (dry run) */
export interface AtlasDigestDryRunResult {
  dry_run: true
  message: string
  note: string
}

/** POST /api/atlas/digest -- union of both outcomes */
export type AtlasDigestResult = AtlasDigestSentResult | AtlasDigestDryRunResult

// ── Health ───────────────────────────────────────────────────────────────────

/** Wire status entry from GET /api/atlas/health */
export interface AtlasWireHealthStatus {
  wire_id: string
  name: string
  product_line: string
  data_domain: string
  status: 'healthy' | 'stale' | 'error' | 'no_data'
  last_run_at?: string
  last_run_status?: string
}

/** Import run summary entry from GET /api/atlas/health */
export interface AtlasRecentRunSummary {
  run_id: string
  import_type: string
  source: string
  status: string
  imported: number
  errors: number
  started_at: string
  completed_at?: string
  duration_ms?: number
}

/** GET /api/atlas/health -- real-time health dashboard */
export interface AtlasHealthData {
  overall_health: number
  wire_health_pct: number
  source_health_pct: number
  wires: AtlasWireHealthStatus[]
  sources: {
    total: number
    green: number
    yellow: number
    red: number
    gray: number
  }
  recent_runs: AtlasRecentRunSummary[]
  checked_at: string
}

// ── Import Runs ──────────────────────────────────────────────────────────────

/** GET /api/atlas/import-runs -- list of import run records */
export type AtlasImportRunListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/atlas/import-runs/:id -- single import run detail */
export type AtlasImportRunDTO = Record<string, unknown> & { id: string }

/** POST /api/atlas/import-runs/:id/retry -- retry confirmation */
export interface AtlasImportRunRetryResult {
  id: string
  status: 'running'
  retried_at: string
}

// ── Format Library ───────────────────────────────────────────────────────────

/** GET /api/atlas/formats -- list of saved formats */
export type AtlasFormatListDTO = Array<Record<string, unknown> & { id: string }>

/** POST /api/atlas/formats -- created format echoed back */
export type AtlasFormatCreateDTO = Record<string, unknown> & { id: string }

/** PATCH /api/atlas/formats/:id -- format update confirmation */
export interface AtlasFormatUpdateResult {
  id: string
  updated_at: string
}

// ── Introspection Engine ─────────────────────────────────────────────────────

/** Carrier detection sub-object within introspection results */
export interface IntrospectCarrierDetection {
  detected_carrier: string | null
  carrier_confidence: number
  default_category: string
}

/** POST /api/atlas/introspect -- column mapping result */
export interface IntrospectResultData {
  run_id: string
  match_method: 'fingerprint_exact' | 'fingerprint_partial' | 'carrier_detect' | 'full_introspect'
  format_id: string | null
  overall_confidence: number
  column_mappings: ColumnMapping[]
  carrier_detection: IntrospectCarrierDetection
  sample_normalized: unknown[]
}

/** POST /api/atlas/introspect/confirm -- mapping confirmation result */
export interface IntrospectConfirmResult {
  format_id: string | null
  mappings_confirmed: number
  ready_for_import: true
}

// ── Source Registry Bulk + Health ────────────────────────────────────────────

/** POST /api/atlas/sources/bulk-register -- bulk registration result */
export interface AtlasSourceBulkRegisterResult {
  registered: number
  updated: number
  errors: number
  details: Array<{ carrierId: string; action: 'created' | 'updated' | 'error'; error?: string }>
}

/** GET /api/atlas/sources/health -- source health aggregate */
export interface AtlasSourceHealthData {
  total: number
  green: number
  yellow: number
  red: number
  gray: number
  health_pct: number
  checked_at: string
}

/** GET /api/atlas/execution-analytics -- wire execution analytics */
export interface AtlasExecutionAnalyticsData {
  wires: AtlasWireAnalytics[]
  period_start: string
  period_end: string
  total_runs: number
  total_success: number
  total_failures: number
}

export interface AtlasWireAnalytics {
  wire_id: string
  wire_name: string
  total_runs: number
  success_count: number
  failure_count: number
  avg_duration_ms: number
  last_run_at: string | null
  last_error: string | null
  weekly_counts: number[]
}

/** GET /api/atlas/gaps -- proactive gap report */
export interface AtlasGapReport {
  gaps: AtlasGapItem[]
  total: number
  critical: number
  warning: number
  info: number
  generated_at: string
}

export interface AtlasGapItem {
  type: 'MISSING_NORMALIZER' | 'MISSING_FORMAT_PROFILE' | 'STALE_FORMAT' | 'UNTESTED_WIRE_PATH' | 'UNREGISTERED_SOURCE'
  description: string
  severity: 'critical' | 'warning' | 'info'
  suggested_action: string
  related_entity?: string
}

// ============================================================================
// GUARDIAN -- services/api/src/routes/guardian.ts
// ============================================================================

// ── Audit Report ─────────────────────────────────────────────────────────────

/** GET /api/guardian/audit-report -- structured damage report */
export interface GuardianAuditReportData {
  generated_at: string
  summary: {
    total_open_findings: number
    severity_breakdown: Record<FindingSeverity, number>
    collections_affected: number
    collection_issue_counts: Record<string, number>
  }
  timeline: {
    bulk_operations: Array<Record<string, unknown> & { id: string }>
    recent_anomalies: Array<Record<string, unknown> & { id: string }>
  }
}

// ── Audit CRUD ───────────────────────────────────────────────────────────────

/** POST /api/guardian/audits -- created audit */
export type GuardianAuditDTO = GuardianAudit & { id: string }

/** GET /api/guardian/audits -- paginated list (data portion, pagination in envelope) */
export type GuardianAuditListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/guardian/audits/:id -- audit detail with embedded findings */
export type GuardianAuditDetailDTO = GuardianAudit & {
  id: string
  findings: Array<GuardianFinding & { id: string }>
}

/** PATCH /api/guardian/audits/:id -- updated audit echoed back */
export type GuardianAuditUpdateDTO = Record<string, unknown> & { id: string }

// ── Findings ─────────────────────────────────────────────────────────────────

/** POST /api/guardian/audits/:id/findings -- created finding */
export type GuardianFindingDTO = GuardianFinding & { id: string }

/** GET /api/guardian/audits/:id/findings -- findings for an audit */
export type GuardianFindingListDTO = Array<Record<string, unknown> & { id: string }>

/** PATCH /api/guardian/findings/:id -- updated finding echoed back */
export type GuardianFindingUpdateDTO = Record<string, unknown> & { id: string }

// ── Phase Transition ─────────────────────────────────────────────────────────

/** POST /api/guardian/audits/:id/phase -- phase transition result */
export interface GuardianPhaseTransitionResult {
  from: GuardianPhase
  to: GuardianPhase
  audit_id: string
  transitioned_at: string
  transitioned_by: string
}

// ── Health ────────────────────────────────────────────────────────────────────

/** Single collection health card */
export interface GuardianCollectionHealthCard {
  doc_count: number
  field_coverage: Record<string, number>
}

/** GET /api/guardian/health -- collection health cards + structural report */
export interface GuardianHealthData {
  collections: Record<string, GuardianCollectionHealthCard>
  structural: (Record<string, unknown> & { id: string }) | null
}

// ── Writes, Alerts, Baselines ────────────────────────────────────────────────

/** GET /api/guardian/writes -- paginated write gate log (data portion) */
export type GuardianWriteListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/guardian/alerts -- active anomaly alerts */
export type GuardianAlertListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/guardian/baselines -- paginated baseline snapshots (data portion) */
export type GuardianBaselineListDTO = Array<Record<string, unknown> & { id: string }>

/** POST /api/guardian/baselines -- created baseline snapshot */
export interface GuardianBaselineDTO {
  id: string
  snapshot_id: string
  timestamp: string
  triggered_by: string
  collections: Record<string, unknown>
  stored_at: string
  _created_by: string
}

// ============================================================================
// COMPLIANCE -- services/api/src/routes/compliance.ts
// ============================================================================

/** User statistics sub-object within compliance audit */
export interface ComplianceUserStats {
  total: number
  active: number
  suspended: number
  enrolled_2fa: number
  stale_30: number
  stale_90: number
}

/** POST /api/compliance/audit -- compliance audit report */
export interface ComplianceAuditData {
  audit_id: string
  audit_type: 'quarterly'
  findings: string[]
  critical_count: number
  user_stats: ComplianceUserStats
  run_by: string
  created_at: string
}

/** GET /api/compliance/audits -- list of past audit reports */
export type ComplianceAuditListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/compliance/audits/:id -- single audit report */
export type ComplianceAuditDetailDTO = Record<string, unknown> & { id: string }

/** POST /api/compliance/stale-users -- stale user list */
export type ComplianceStaleUsersData = Array<{
  email: string
  days_inactive: number
}>

/** POST /api/compliance/new-users -- recently created users */
export type ComplianceNewUsersData = Array<{
  email: string
  name: string
  created: string
  ou: string
}>

// ============================================================================
// WIRE -- services/api/src/routes/wire.ts
// ============================================================================

/** Wire execution result (mirrors WireResult in wire.ts) */
export interface WireExecutionResult {
  success: boolean
  wire_id: string
  stages: Array<{ stage_id: string; status: string }>
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  approval_batch_id?: string
}

/** POST /api/wire/execute -- wire execution result */
export type WireExecuteData = WireExecutionResult

/** GET /api/wire/status/:executionId -- wire execution status */
export type WireStatusData = Record<string, unknown> & { execution_id: string }

/** POST /api/wire/resume/:executionId -- resumed wire result */
export type WireResumeData = WireExecutionResult

// ============================================================================
// IMPORT -- services/api/src/routes/import.ts
// ============================================================================

// ── Shared sub-types ─────────────────────────────────────────────────────────

/** Error detail for a single row/record in an import batch */
export interface ImportErrorDetail {
  index: number
  error: string
}

// ── Single entity import results ─────────────────────────────────────────────

/** POST /api/import/client -- single client import result */
export interface ImportClientResult {
  client_id: string
  action: 'created'
}

/** POST /api/import/account -- single account import result */
export interface ImportAccountResult {
  account_id: string
  action: 'created'
  collection: string
}

/** POST /api/import/agent -- single agent import (created) */
export interface ImportAgentCreatedResult {
  agent_id: string
  action: 'created'
}

/** POST /api/import/agent -- single agent import (skipped - duplicate NPN) */
export interface ImportAgentSkippedNpnResult {
  action: 'skipped'
  reason: 'duplicate_npn'
  existing_agent_id: string
  existing_data: { npn: string; first_name: string; last_name: string }
}

/** POST /api/import/agent -- single agent import (skipped - duplicate email) */
export interface ImportAgentSkippedEmailResult {
  action: 'skipped'
  reason: 'duplicate_email'
  existing_agent_id: string
}

/** POST /api/import/agent -- union of agent import outcomes */
export type ImportAgentResult =
  | ImportAgentCreatedResult
  | ImportAgentSkippedNpnResult
  | ImportAgentSkippedEmailResult

/** POST /api/import/revenue -- single revenue import (created) */
export interface ImportRevenueCreatedResult {
  revenue_id: string
  action: 'created'
  linked_agent: string | null
  linked_account: string | null
}

/** POST /api/import/revenue -- single revenue import (skipped) */
export interface ImportRevenueSkippedResult {
  action: 'skipped'
  reason: 'duplicate_stateable_id'
  existing_revenue_id: string
}

/** POST /api/import/revenue -- union of revenue import outcomes */
export type ImportRevenueResult = ImportRevenueCreatedResult | ImportRevenueSkippedResult

/** POST /api/import/case-task -- case task creation result */
export interface ImportCaseTaskResult {
  task_id: string
  action: 'created'
  status: string
}

/** POST /api/import/finalize -- case finalization result */
export interface ImportFinalizeResult {
  client_id: string
  status: 'finalized'
}

// ── Batch import results ─────────────────────────────────────────────────────

/** POST /api/import/clients -- batch client import result */
export interface ImportBatchClientsResult {
  imported: number
  errors: ImportErrorDetail[]
}

/** POST /api/import/accounts -- batch account import result */
export interface ImportBatchAccountsResult {
  imported: number
  errors: ImportErrorDetail[]
  import_run_id: string
}

/** POST /api/import/agents -- batch agent import result */
export interface ImportBatchAgentsResult {
  imported: number
  skipped: number
  errors: ImportErrorDetail[]
  import_run_id: string
}

/** POST /api/import/revenues -- batch revenue import result */
export interface ImportBatchRevenuesResult {
  imported: number
  skipped: number
  errors: ImportErrorDetail[]
  import_run_id: string
}

// ── ATLAS Wizard batch import ────────────────────────────────────────────────

/** POST /api/import/batch (ATLAS wizard payload) -- new category types */
export interface ImportBatchAtlasWizardResult {
  total_received: number
  auto_matched: number
  new_created: number
  updated: number
  duplicates_removed: number
  flagged: number
  skipped: number
  errors: number
  run_id: string
  details?: { errors: ImportErrorDetail[] }
}

/** POST /api/import/batch (legacy payload) -- clients + accounts */
export interface ImportBatchLegacyResult {
  clients: {
    imported: number
    updated: number
    skipped: number
    errors: ImportErrorDetail[]
    mapping: Record<string, string>
  }
  accounts: {
    imported: number
    updated: number
    skipped: number
    errors: ImportErrorDetail[]
  }
  households?: {
    detected: number
    created: number
  }
}

/** POST /api/import/batch -- union of batch outcomes */
export type ImportBatchResult = ImportBatchAtlasWizardResult | ImportBatchLegacyResult

// ── Validation ───────────────────────────────────────────────────────────────

/** POST /api/import/validate -- basic validation result */
export interface ImportValidateResult {
  valid: boolean
  errors: Array<{ field: string; message: string }>
  warnings: string[]
}

/** POST /api/import/validate-full -- enhanced validation with normalization preview */
export interface ImportValidateFullResult {
  valid: boolean
  errors: Array<{ field: string; message: string }>
  warnings: Array<{ field: string; message: string }>
  normalized_data?: Record<string, unknown>
}

// ── Approval ─────────────────────────────────────────────────────────────────

/** POST /api/import/approval/create -- approval batch creation result */
export interface ImportApprovalCreateResult {
  batch_id: string
  status: 'pending'
}

// ── Bulk Book of Business ────────────────────────────────────────────────────

/** POST /api/import/bob -- bulk BoB import result */
export interface ImportBobResult {
  total: number
  imported: number
  skipped: number
  duplicates: number
  errors: number
  error_details: ImportErrorDetail[]
  import_run_id: string
}

// ── Signal Revenue ───────────────────────────────────────────────────────────

/** POST /api/import/signal-revenue -- Signal IMO revenue import result */
export interface ImportSignalRevenueResult {
  imported: number
  skipped: number
  linked_agents: number
  linked_accounts: number
  parse_errors: number
  errors: ImportErrorDetail[]
  import_run_id: string
}

// ── Commission Bulk ──────────────────────────────────────────────────────────

/** POST /api/import/commission-bulk -- generic commission import result */
export interface ImportCommissionBulkResult {
  imported: number
  skipped: number
  linked_agents: number
  linked_accounts: number
  resolution: Record<string, string | null>
  errors: ImportErrorDetail[]
  import_run_id: string
}

// ── Commission Reconciliation ────────────────────────────────────────────────

/** Single discrepancy from commission reconciliation */
export interface ImportCommissionDiscrepancy {
  revenue_id: string
  agent_id: string
  carrier: string
  product_type: string
  revenue_type: string
  period: string
  policy_number: string
  actual_amount: number
  expected_amount: number
  difference: number
  grid_rate: number
  premium: number
}

/** POST /api/import/commission-reconcile -- reconciliation result */
export interface ImportCommissionReconcileResult {
  records_checked: number
  records_matched: number
  discrepancies_found: number
  discrepancies: ImportCommissionDiscrepancy[]
  tolerance_percent: number
}

// ── Carrier Detection ────────────────────────────────────────────────────────

/** POST /api/import/carrier-detect (detected) */
export interface CarrierDetectFoundResult {
  detected: true
  carrier_id: string
  carrier: string
  default_category: string
  dedup_keys: string[]
  mapped_headers: Record<string, string>
  unmapped_headers: string[]
}

/** POST /api/import/carrier-detect (not detected) */
export interface CarrierDetectNotFoundResult {
  detected: false
  message: string
  available_formats: Array<{
    carrier_id: string
    carrier: string
    signatures: string[]
  }>
}

/** POST /api/import/carrier-detect -- union */
export type CarrierDetectResult = CarrierDetectFoundResult | CarrierDetectNotFoundResult

// ── Carrier Account Import ───────────────────────────────────────────────────

/** POST /api/import/carrier-accounts -- bulk carrier account import result */
export interface ImportCarrierAccountsResult {
  total: number
  imported: number
  skipped: number
  duplicates: number
  errors: number
  carrier_id: string
  carrier: string
  error_details: ImportErrorDetail[]
  category_breakdown: Record<string, number>
  dry_run: boolean
  import_run_id?: string
}

// ── Life / Investment Specialized Imports ─────────────────────────────────────

/** POST /api/import/life-accounts -- life policy import result */
export interface ImportLifeAccountsResult {
  total: number
  imported: number
  skipped: number
  errors: number
  error_details: ImportErrorDetail[]
  warnings: string[]
  dry_run: boolean
  import_run_id?: string
}

/** POST /api/import/investment-accounts, /api/import/bdria-accounts */
export interface ImportInvestmentAccountsResult {
  total: number
  imported: number
  skipped: number
  errors: number
  error_details: ImportErrorDetail[]
  warnings: string[]
  dry_run: boolean
  import_run_id?: string
}

// ── Client Backfill ──────────────────────────────────────────────────────────

/** POST /api/import/backfill-clients -- demographic backfill result */
export interface ImportBackfillClientsResult {
  scanned: number
  enriched: number
  fields_filled: Record<string, number>
  skipped: number
  errors: number
  error_details: Array<{ client_id: string; error: string }>
  dry_run: boolean
  import_run_id: string
}

// ── Intake Queue ─────────────────────────────────────────────────────────────

/** GET /api/import/queue/status -- intake queue depth */
export interface ImportQueueStatusData {
  by_status: Record<string, number>
  by_source: Record<string, number>
  total: number
}

// ── Agent Orchestration (IK-003) ─────────────────────────────────────────────

/** POST /api/import-agents/agent -- single agent import result */
export interface ImportAgentOrchResult {
  action: 'created' | 'updated' | 'skipped'
  agent_id: string
  reason?: string
  changes?: string[]
  match_method?: string
}

/** POST /api/import-agents/agents -- batch agent import result */
export interface ImportAgentBatchOrchResult {
  imported: number
  updated: number
  skipped: number
  errors: ImportErrorDetail[]
  import_run_id: string
}

// ── Carrier Seed (IK-004) ────────────────────────────────────────────────────

/** POST /api/import-agents/carriers -- carrier seed result */
export interface ImportCarrierSeedResult {
  created: number
  updated: number
  unchanged: number
  errors: Array<{ carrier_id: string; error: string }>
  import_run_id: string
}

/** POST /api/import-agents/naic -- NAIC population result */
export interface ImportNaicPopulateResult {
  scanned: number
  updated: number
  skipped_no_charter: number
  skipped_no_naic: number
  skipped_already_set: number
  errors: number
  dry_run: boolean
  import_run_id: string
}

/** POST /api/import-agents/resolve -- carrier identity resolution */
export interface ImportCarrierResolveResult {
  carrier: string
  charter: string | null
  charter_code: string | null
  naic: number | null
  carrier_id: string | null
}
