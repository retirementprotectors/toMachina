// ─── VOLTRON Wire Definitions ───────────────────────────────────────────────
// 4 wires composing the 8 Super Tools into end-to-end client workflows.
// Each wire defines: super tool chain, approval gates, entitlement minimum.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronWireDefinition } from './types'

// ── Wire Definitions ────────────────────────────────────────────────────────

export const VOLTRON_WIRE_DEFINITIONS: VoltronWireDefinition[] = [
  {
    wire_id: 'ANNUAL_REVIEW',
    name: 'Annual Review',
    description: 'Full annual review preparation: review packet, documents, meeting prep, and draft follow-up communication.',
    super_tools: ['REVIEW_PREP', 'PULL_DOCUMENTS', 'MEETING_PREP', 'DRAFT_COMMUNICATION'],
    approval_gates: ['DRAFT_COMMUNICATION'],
    entitlement_min: 'DIRECTOR',
  },
  {
    wire_id: 'AEP_ENROLLMENT',
    name: 'AEP Enrollment',
    description: 'Annual Enrollment Period preparation: review, coverage gap analysis, and enrollment communication.',
    super_tools: ['REVIEW_PREP', 'COVERAGE_GAP', 'DRAFT_COMMUNICATION'],
    approval_gates: ['DRAFT_COMMUNICATION'],
    entitlement_min: 'DIRECTOR',
  },
  {
    wire_id: 'ONBOARD_AGENCY',
    name: 'Onboard Agency',
    description: 'New agency onboarding: review prep and document retrieval.',
    super_tools: ['REVIEW_PREP', 'PULL_DOCUMENTS'],
    approval_gates: undefined,
    entitlement_min: 'DIRECTOR',
  },
  {
    wire_id: 'NEW_BUSINESS',
    name: 'New Business',
    description: 'New business pipeline: review prep, casework generation, and meeting scheduling.',
    super_tools: ['REVIEW_PREP', 'BUILD_CASEWORK', 'MEETING_PREP'],
    approval_gates: ['BUILD_CASEWORK'],
    entitlement_min: 'DIRECTOR',
  },
]

// ── AEP Blackout Enforcement ────────────────────────────────────────────────

/** Check if current date falls within AEP blackout period (Oct 1 - Dec 7) */
export function isAepBlackout(date: Date = new Date()): boolean {
  const month = date.getMonth() // 0-indexed
  const day = date.getDate()
  // Oct 1 through Dec 7
  if (month === 9) return true                        // All of October
  if (month === 10) return true                       // All of November
  if (month === 11 && day <= 7) return true           // Dec 1-7
  return false
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
