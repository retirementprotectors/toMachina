/**
 * Pipeline Studio — Yellow Stage Configuration (TRK-13403)
 *
 * Defines the Yellow Stage pipeline steps that trigger QUE wires.
 * This configuration is consumed by Pipeline Studio to render
 * the casework workflow and fire wires at each stage.
 */

export interface YellowStageStep {
  id: string
  name: string
  description: string
  /** Execution type — 'que_workbench' triggers QUE session */
  execution_type: 'que_workbench' | 'manual' | 'auto'
  /** Wire to fire (if execution_type is que_workbench or auto) */
  wire?: string
  /** Completion check handler */
  completionCheck?: string
  /** Stage order */
  order: number
}

export const YELLOW_STAGE_PIPELINE: YellowStageStep[] = [
  {
    id: 'ys-analysis',
    name: 'Analysis',
    description: 'Run MGE analysis to determine applicable casework types',
    execution_type: 'que_workbench',
    wire: 'WIRE_MGE_DETAILED',
    completionCheck: 'QUE_MGE_COMPLETE',
    order: 1,
  },
  {
    id: 'ys-case-building',
    name: 'Case Building',
    description: 'Fire applicable wires in parallel based on MGE results',
    execution_type: 'auto',
    wire: 'APPLICABLE_WIRES', // Dynamically determined by MGE output
    completionCheck: 'QUE_ALL_WIRES_COMPLETE',
    order: 2,
  },
  {
    id: 'ys-package-assembly',
    name: 'Package Assembly',
    description: 'Assemble all 5 outputs into ACF B4 folder',
    execution_type: 'auto',
    wire: 'WIRE_ASSEMBLE_B4',
    completionCheck: 'DEX_PACKAGE_FILED',
    order: 3,
  },
  {
    id: 'ys-case-ready',
    name: 'Case Ready',
    description: 'All outputs filed — notify specialist for Green Stage',
    execution_type: 'manual',
    completionCheck: 'SPECIALIST_CONFIRMED',
    order: 4,
  },
]

/**
 * Check handler: QUE_SESSION_COMPLETE
 * Returns true if all applicable wires have completed for a household.
 */
export interface QueSessionCompleteCheck {
  householdId: string
  completedWires: string[]
  requiredWires: string[]
}

export function isQueSessionComplete(check: QueSessionCompleteCheck): boolean {
  return check.requiredWires.every((wire) => check.completedWires.includes(wire))
}

/**
 * Map MGE applicable types to the wires that should fire.
 */
export const CASEWORK_TYPE_TO_WIRE: Record<string, string> = {
  income_now: 'WIRE_INCOME_NOW',
  income_later: 'WIRE_INCOME_LATER',
  estate_max: 'WIRE_ESTATE_MAX',
  growth_max: 'WIRE_GROWTH_MAX',
  ltc_max: 'WIRE_LTC_MAX',
  roth_conversion: 'WIRE_ROTH_CONVERSION',
  tax_harvesting: 'WIRE_TAX_HARVEST',
  mge_detailed: 'WIRE_MGE_DETAILED',
}
