// ─── VOLTRON Case Pipeline Types — VOL-O07 ──────────────────────────────────
// Schema for voltron_cases Firestore collection. Every wire execution creates
// a case record. Cases flow: intake → wire_running → output_ready →
// agent_review → resolved.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronLionDomain } from './types'

// ── Case Status Lifecycle ──────────────────────────────────────────────────

export type CaseStatus = 'intake' | 'wire_running' | 'output_ready' | 'agent_review' | 'resolved'

export const CASE_STATUS_ORDER: CaseStatus[] = [
  'intake', 'wire_running', 'output_ready', 'agent_review', 'resolved',
]

// ── Case Outcome (set during agent_review → resolved) ──────────────────────

export type CaseOutcome = 'accepted' | 'revised' | 'escalated'

// ── Intake Channel — where the case originated ─────────────────────────────

export type IntakeChannel = 'mdj_panel' | 'slack' | 'email' | 'command_center'

// ── VoltronCase — Firestore document schema ────────────────────────────────

export interface VoltronCase {
  /** Firestore document ID (auto-generated) */
  case_id: string
  /** Client Firestore ID */
  client_id: string
  /** Denormalized display name (first + last) */
  client_name: string
  /** QUE wire executed (e.g., WIRE_INCOME_NOW) */
  wire_name: string
  /** Lion domain that handled this case */
  lion_domain: VoltronLionDomain
  /** Assigned RPI agent email */
  agent_id: string
  /** Current lifecycle status */
  status: CaseStatus
  /** Where this case came from */
  intake_channel: IntakeChannel
  /** Structured wire execution result */
  wire_output: Record<string, unknown> | null
  /** Agent outcome after review */
  outcome: CaseOutcome | null
  /** Agent notes on revision/escalation */
  revision_notes: string | null
  /** Case creation timestamp (ISO) */
  created_at: string
  /** Last status change timestamp (ISO) */
  updated_at: string
  /** Resolution timestamp (ISO), null until resolved */
  resolved_at: string | null
}

// ── Helper: create a new case record ───────────────────────────────────────

export function createCaseRecord(params: {
  case_id: string
  client_id: string
  client_name: string
  wire_name: string
  lion_domain: VoltronLionDomain
  agent_id: string
  intake_channel: IntakeChannel
}): VoltronCase {
  const now = new Date().toISOString()
  return {
    ...params,
    status: 'intake',
    wire_output: null,
    outcome: null,
    revision_notes: null,
    created_at: now,
    updated_at: now,
    resolved_at: null,
  }
}

// ── Case status display helpers ────────────────────────────────────────────

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  intake: 'Intake',
  wire_running: 'Wire Running',
  output_ready: 'Output Ready',
  agent_review: 'Agent Review',
  resolved: 'Resolved',
}

export const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  intake: '#3b82f6',
  wire_running: '#f59e0b',
  output_ready: '#06b6d4',
  agent_review: '#a855f7',
  resolved: '#22c55e',
}

export const CASE_OUTCOME_COLORS: Record<CaseOutcome, string> = {
  accepted: '#22c55e',
  revised: '#f59e0b',
  escalated: '#ef4444',
}
