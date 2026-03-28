// ─── VOLTRON Wire Definitions ───────────────────────────────────────────────
// 4 wires composing the 8 Super Tools into end-to-end client workflows.
// Each wire defines: super tool chain, approval gates, entitlement minimum.
// Wire executor imports these definitions and runs super tools sequentially
// with output chaining between stages.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronWireDefinition } from './types'

// ── Wire Definitions ────────────────────────────────────────────────────────
// PRODUCTION: ANNUAL_REVIEW and BUILD_CASEWORK (NEW_BUSINESS) verified in prod.
// AEP_ENROLLMENT enforces AEP blackout (Oct 1 – Dec 7) via validateWireExecution.

export const VOLTRON_WIRE_DEFINITIONS: VoltronWireDefinition[] = [
  {
    wire_id: 'ANNUAL_REVIEW',
    name: 'Annual Review',
    description:
      'Full annual review preparation: review packet, client documents, meeting prep with agenda, and draft follow-up communication. Approval gate pauses before sending communication.',
    super_tools: ['REVIEW_PREP', 'PULL_DOCUMENTS', 'MEETING_PREP', 'DRAFT_COMMUNICATION'],
    approval_gates: ['DRAFT_COMMUNICATION'],
    entitlement_min: 'DIRECTOR',
  },
  {
    wire_id: 'AEP_ENROLLMENT',
    name: 'AEP Enrollment',
    description:
      'Annual Enrollment Period preparation: client review, coverage gap analysis, and enrollment communication draft. AEP blackout (Oct 1 – Dec 7) blocks communications automatically.',
    super_tools: ['REVIEW_PREP', 'COVERAGE_GAP', 'DRAFT_COMMUNICATION'],
    approval_gates: ['DRAFT_COMMUNICATION'],
    entitlement_min: 'DIRECTOR',
  },
  {
    wire_id: 'ONBOARD_AGENCY',
    name: 'Onboard Agency',
    description:
      'New agency onboarding: gather agency data via review prep, retrieve and organize ACF documents, and prepare folder structure for the new agency relationship.',
    super_tools: ['REVIEW_PREP', 'PULL_DOCUMENTS'],
    approval_gates: undefined,
    entitlement_min: 'DIRECTOR',
  },
  {
    wire_id: 'NEW_BUSINESS',
    name: 'New Business',
    description:
      'New business pipeline: review prep for prospect, casework generation with QUE quotes and interactive HTML, and meeting scheduling. Approval gate pauses before committing casework.',
    super_tools: ['REVIEW_PREP', 'BUILD_CASEWORK', 'MEETING_PREP'],
    approval_gates: ['BUILD_CASEWORK'],
    entitlement_min: 'DIRECTOR',
  },
]

// ── AEP Blackout Enforcement ────────────────────────────────────────────────

/** Check if current date falls within AEP blackout period (Oct 1 – Dec 7) */
export function isAepBlackout(date: Date = new Date()): boolean {
  const month = date.getMonth() // 0-indexed
  const day = date.getDate()
  // Oct 1 through Dec 7
  if (month === 9) return true                        // All of October
  if (month === 10) return true                       // All of November
  if (month === 11 && day <= 7) return true           // Dec 1-7
  return false
}

// ── Wire Pre-Execution Validation ───────────────────────────────────────────

export interface WireValidationResult {
  valid: boolean
  error?: string
  wire_id: string
}

/**
 * Validate wire execution constraints before running.
 * Call this BEFORE executeVoltronWire to enforce business rules:
 * - AEP_ENROLLMENT: blocked during AEP blackout (Oct 1 – Dec 7)
 *
 * Returns { valid: true } if wire can execute, or { valid: false, error } if blocked.
 */
export function validateWireExecution(wireId: string, date: Date = new Date()): WireValidationResult {
  // AEP blackout enforcement
  if (wireId === 'AEP_ENROLLMENT' && isAepBlackout(date)) {
    return {
      valid: false,
      error: `AEP_ENROLLMENT wire blocked: AEP blackout period is active (Oct 1 – Dec 7). Current date: ${date.toISOString().slice(0, 10)}. Communications cannot be sent during the Annual Enrollment Period.`,
      wire_id: wireId,
    }
  }

  // Verify wire exists
  const wire = getVoltronWireById(wireId)
  if (!wire) {
    return {
      valid: false,
      error: `Unknown wire: ${wireId}`,
      wire_id: wireId,
    }
  }

  return { valid: true, wire_id: wireId }
}

// ── Lookup Functions ────────────────────────────────────────────────────────

export function getVoltronWireById(wireId: string): VoltronWireDefinition | undefined {
  return VOLTRON_WIRE_DEFINITIONS.find(w => w.wire_id === wireId)
}

export function getVoltronWireIds(): string[] {
  return VOLTRON_WIRE_DEFINITIONS.map(w => w.wire_id)
}

export function getVoltronWireStats(): {
  totalWires: number
  totalSuperToolSlots: number
  wiresWithGates: number
} {
  return {
    totalWires: VOLTRON_WIRE_DEFINITIONS.length,
    totalSuperToolSlots: VOLTRON_WIRE_DEFINITIONS.reduce((sum, w) => sum + w.super_tools.length, 0),
    wiresWithGates: VOLTRON_WIRE_DEFINITIONS.filter(w => w.approval_gates && w.approval_gates.length > 0).length,
  }
}
