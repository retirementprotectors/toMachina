// ─── VOLTRON Gap Request Types — VOL-O18 ────────────────────────────────────
// When VOLTRON identifies a missing wire during case processing, a structured
// gap request is created. Surfaces in War Room for CTO review and feeds
// MUSASHI Discovery Docs.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronLionDomain } from './types'

// ── Gap Request Priority ───────────────────────────────────────────────────

export type GapRequestPriority = 'low' | 'medium' | 'high' | 'critical'

// ── Gap Request Status ─────────────────────────────────────────────────────

export type GapRequestStatus = 'open' | 'under_review' | 'planned' | 'resolved' | 'wont_fix'

// ── VoltronGapRequest — Firestore document schema ──────────────────────────

export interface VoltronGapRequest {
  /** Firestore document ID (auto-generated) */
  id: string
  /** Lion domain where the gap was identified */
  domain: VoltronLionDomain
  /** Short title describing the missing capability */
  title: string
  /** Detailed description of what's missing */
  description: string
  /** Client scenario that triggered the gap */
  scenario: string
  /** What the expected output should look like */
  expected_output: string
  /** Priority level */
  priority: GapRequestPriority
  /** Current status */
  status: GapRequestStatus
  /** Who submitted the request (email) */
  submitted_by: string
  /** Case ID that triggered this gap (if applicable) */
  source_case_id: string | null
  /** Created timestamp (ISO) */
  created_at: string
  /** Updated timestamp (ISO) */
  updated_at: string
}

// ── Helper: create a new gap request ───────────────────────────────────────

export function createGapRequest(params: {
  id: string
  domain: VoltronLionDomain
  title: string
  description: string
  scenario: string
  expected_output: string
  priority: GapRequestPriority
  submitted_by: string
  source_case_id?: string
}): VoltronGapRequest {
  const now = new Date().toISOString()
  return {
    ...params,
    source_case_id: params.source_case_id ?? null,
    status: 'open',
    created_at: now,
    updated_at: now,
  }
}
