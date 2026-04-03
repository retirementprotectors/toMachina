/**
 * Pipeline configs barrel export.
 * Re-exports ALL 15 pipeline configs.
 */

// NBX pipelines (Builder 01)
export { NBX_INVESTMENTS_CONFIG } from './nbx-securities'
export { NBX_LIFE_CONFIG } from './nbx-life'
export { NBX_ANNUITY_CONFIG } from './nbx-annuity'
export { NBX_MEDICARE_MEDSUP_CONFIG } from './nbx-medicare-medsup'
export { NBX_MEDICARE_MAPD_CONFIG } from './nbx-medicare-mapd'

// Sales pipelines (Builder 02)
export { SALES_RETIREMENT_CONFIG } from './sales-retirement'
export { SALES_MEDICARE_CONFIG } from './sales-medicare'
export { SALES_LEGACY_CONFIG } from './sales-legacy'

// Prospecting pipelines (Builder 02 + Builder 03)
export { PROSPECT_RETIREMENT_CONFIG } from './prospect-retirement'
export { PROSPECT_MEDICARE_CONFIG } from './prospect-medicare'
export { PROSPECT_LEGACY_CONFIG } from './prospect-legacy'
export { PROSPECT_HOUSEHOLD_CONFIG } from './prospect-household'

// Reactive pipelines (Builder 02)
export { REACTIVE_RETIREMENT_CONFIG } from './reactive-retirement'
export { REACTIVE_MEDICARE_CONFIG } from './reactive-medicare'

// Delivery pipeline (Sprint 012 — TRK-S12-005)
export { DELIVERY_CONFIG } from './delivery'

// Session Agent Workflow (engineering ops)
export { SESSION_AGENT_WORKFLOW_CONFIG } from './session-agent-workflow'

// Convenience lookup — all 15 configs by pipeline key
import { NBX_INVESTMENTS_CONFIG } from './nbx-securities'
import { NBX_LIFE_CONFIG } from './nbx-life'
import { NBX_ANNUITY_CONFIG } from './nbx-annuity'
import { NBX_MEDICARE_MEDSUP_CONFIG } from './nbx-medicare-medsup'
import { NBX_MEDICARE_MAPD_CONFIG } from './nbx-medicare-mapd'
import { SALES_RETIREMENT_CONFIG } from './sales-retirement'
import { SALES_MEDICARE_CONFIG } from './sales-medicare'
import { SALES_LEGACY_CONFIG } from './sales-legacy'
import { PROSPECT_RETIREMENT_CONFIG } from './prospect-retirement'
import { PROSPECT_MEDICARE_CONFIG } from './prospect-medicare'
import { PROSPECT_LEGACY_CONFIG } from './prospect-legacy'
import { PROSPECT_HOUSEHOLD_CONFIG } from './prospect-household'
import { REACTIVE_RETIREMENT_CONFIG } from './reactive-retirement'
import { REACTIVE_MEDICARE_CONFIG } from './reactive-medicare'
import { DELIVERY_CONFIG } from './delivery'
import { SESSION_AGENT_WORKFLOW_CONFIG } from './session-agent-workflow'

export const ALL_PIPELINE_CONFIGS = {
  NBX_INVESTMENTS: NBX_INVESTMENTS_CONFIG,
  NBX_LIFE: NBX_LIFE_CONFIG,
  NBX_ANNUITY: NBX_ANNUITY_CONFIG,
  NBX_MEDICARE_MEDSUP: NBX_MEDICARE_MEDSUP_CONFIG,
  NBX_MEDICARE_MAPD: NBX_MEDICARE_MAPD_CONFIG,
  SALES_RETIREMENT: SALES_RETIREMENT_CONFIG,
  SALES_MEDICARE: SALES_MEDICARE_CONFIG,
  SALES_LEGACY: SALES_LEGACY_CONFIG,
  PROSPECT_RETIREMENT: PROSPECT_RETIREMENT_CONFIG,
  PROSPECT_MEDICARE: PROSPECT_MEDICARE_CONFIG,
  PROSPECT_LEGACY: PROSPECT_LEGACY_CONFIG,
  PROSPECT_HOUSEHOLD: PROSPECT_HOUSEHOLD_CONFIG,
  REACTIVE_RETIREMENT: REACTIVE_RETIREMENT_CONFIG,
  REACTIVE_MEDICARE: REACTIVE_MEDICARE_CONFIG,
  DELIVERY: DELIVERY_CONFIG,
  SESSION_AGENT_WORKFLOW: SESSION_AGENT_WORKFLOW_CONFIG,
} as const

export type PipelineKey = keyof typeof ALL_PIPELINE_CONFIGS
