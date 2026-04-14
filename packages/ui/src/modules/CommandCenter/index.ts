/**
 * VOLTRON Command Center — OPS dashboard for registry, wires, cases, and Lions.
 * Separate from the business metrics CommandCenter (CommandCenterLegacy.tsx).
 *
 * Built by RONIN — VOLTRON CONSUME Track (VOL-C02/C04/C15)
 */

// VOLTRON Command Center (canonical — promoted to /modules/command-center in VOL-N05)
export { CommandCenterPage } from './CommandCenterPage'
export type { CommandCenterPageProps } from './CommandCenterPage'

// OPERATE Track components (VOL-O13, VOL-O14, VOL-O18)
export { RunWirePanel } from './RunWirePanel'
export { CaseReviewWidget } from './CaseReviewWidget'
export { GapRequestForm } from './GapRequestForm'

// Legacy business metrics dashboard (CommandCenterLegacy) retired in VOL-N05 —
// JDM Option B: VOLTRON OPS CC absorbs the /modules/command-center route.
