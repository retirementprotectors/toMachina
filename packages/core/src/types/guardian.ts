// ============================================================================
// GUARDIAN — The Data Protection Engine
// Types for audits, findings, snapshots, write lineage, and anomaly alerts
// ============================================================================

// ── Audit Lifecycle ──────────────────────────────────────────────────────────

export const GUARDIAN_PHASES = ['scan', 'detect', 'respond', 'verify', 'protect'] as const
export type GuardianPhase = typeof GUARDIAN_PHASES[number]

export const GUARDIAN_PHASE_ORDER: Record<GuardianPhase, number> = {
  scan: 0,
  detect: 1,
  respond: 2,
  verify: 3,
  protect: 4,
}

export interface GuardianAudit {
  id?: string
  name: string
  description: string
  phase: GuardianPhase
  status: 'active' | 'complete'
  snapshot_id: string | null
  finding_ids: string[]
  triggered_by: 'manual' | 'scheduled' | 'anomaly'
  created_by: string
  created_at: string
  updated_at: string
}

// ── Findings ─────────────────────────────────────────────────────────────────

export const FINDING_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
export type FindingSeverity = typeof FINDING_SEVERITIES[number]

export const FINDING_CATEGORIES = [
  'schema_violation',
  'orphan_reference',
  'duplicate',
  'field_degradation',
  'bulk_anomaly',
  'missing_required',
  'data_loss',
] as const
export type FindingCategory = typeof FINDING_CATEGORIES[number]

export const FINDING_STATUSES = ['open', 'in_progress', 'resolved', 'accepted', 'wont_fix'] as const
export type FindingStatus = typeof FINDING_STATUSES[number]

export interface GuardianFinding {
  id?: string
  finding_id: string
  audit_id: string
  title: string
  description: string
  severity: FindingSeverity
  category: FindingCategory
  collection: string
  doc_ids: string[]
  status: FindingStatus
  resolution: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

// ── Data Snapshots ───────────────────────────────────────────────────────────

export interface CollectionSnapshot {
  count: number
  sample_hash: string
  field_coverage: Record<string, number> // field name → % populated (0-100)
}

export interface DataSnapshot {
  id?: string
  snapshot_id: string
  timestamp: string
  triggered_by: 'manual' | 'scheduled' | 'pre-migration'
  collections: Record<string, CollectionSnapshot>
  stored_at: string
  created_by: string
}

// ── Write Lineage ────────────────────────────────────────────────────────────

export interface GuardianWrite {
  id?: string
  timestamp: string
  collection: string
  doc_id: string
  operation: 'create' | 'update' | 'delete'
  agent_session_id: string
  source_script: string
  user_email: string
  fields_modified: string[]
  doc_count: number
  validation_passed: boolean
  schema_errors: string[]
}

// ── Anomaly Alerts ───────────────────────────────────────────────────────────

export const ANOMALY_TYPES = [
  'mass_deletion',
  'field_nullification',
  'schema_drift',
  'orphan_creation',
  'duplicate_creation',
] as const
export type AnomalyType = typeof ANOMALY_TYPES[number]

export interface AnomalyAlert {
  id?: string
  type: AnomalyType
  severity: FindingSeverity
  collection: string
  description: string
  doc_count: number
  detected_at: string
  acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
}

// ── Schema Validation ────────────────────────────────────────────────────────

export interface CollectionSchema {
  required: string[]
  neverNull?: string[]
  immutableAfterCreate?: string[]
  recommended?: string[]
  conditionalRequired?: Record<string, string[]>
}

// ── Audit Report ─────────────────────────────────────────────────────────────

export interface CollectionAuditResult {
  total: number
  missing_required_fields: Array<{ field: string; count: number }>
  orphan_references: number
  duplicates: number
  issues: Array<{ doc_id: string; issue: string; severity: FindingSeverity }>
}

export interface AuditReport {
  generated_at: string
  summary: {
    total_collections_audited: number
    total_docs_audited: number
    issues_found: number
    severity_breakdown: Record<FindingSeverity, number>
  }
  collections: Record<string, CollectionAuditResult>
  timeline: {
    bulk_operations: Array<{ timestamp: string; collection: string; count: number; operation: string }>
    recent_anomalies: Array<{ timestamp: string; description: string }>
  }
}

// ── Phase Transition ─────────────────────────────────────────────────────────

export interface PhaseTransitionResult {
  success: boolean
  from: GuardianPhase
  to: GuardianPhase
  blocked_reason?: string
}
