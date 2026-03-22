/**
 * API DTOs — Group 4: CAM / Revenue / Commission / Producers / Agents
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/cam.ts
 *   services/api/src/routes/revenue.ts
 *   services/api/src/routes/producers.ts
 *   services/api/src/routes/agents.ts
 */

import type { Revenue, Producer, Agent, CompGrid } from '../types'

// ============================================================================
// REVENUE — services/api/src/routes/revenue.ts
// ============================================================================

/** GET /api/revenue — paginated list (stripped of internal fields) */
export type RevenueListDTO = RevenueDTO[]

/** GET /api/revenue/:id — single revenue record with Firestore doc ID */
export type RevenueDTO = Revenue & { id: string }

/** POST /api/revenue — created revenue record echoed back */
export type RevenueCreateDTO = RevenueDTO

/** PATCH /api/revenue/:id — updated revenue record echoed back */
export type RevenueUpdateDTO = RevenueDTO

/** GET /api/revenue/summary/by-agent — revenue totals grouped by agent */
export type RevenueByAgentSummaryDTO = RevenueAgentBucket[]

export interface RevenueAgentBucket {
  agent_id: string
  total: number
  count: number
}

/** POST /api/revenue/bulk — bulk import result summary */
export interface RevenueBulkImportResult {
  total: number
  imported: number
  skipped: number
  duplicates: number
  linked_agents: number
  linked_accounts: number
  errors: Array<{ index: number; error: string }>
}

// ============================================================================
// PRODUCERS — services/api/src/routes/producers.ts
// ============================================================================

/** GET /api/producers — paginated list (stripped of internal fields) */
export type ProducerListDTO = ProducerDTO[]

/** GET /api/producers/:id — single producer with Firestore doc ID */
export type ProducerDTO = Producer & { id: string }

/** POST /api/producers — created producer echoed back */
export type ProducerCreateDTO = ProducerDTO

/** PATCH /api/producers/:id — updated producer echoed back */
export type ProducerUpdateDTO = ProducerDTO

// ============================================================================
// AGENTS — services/api/src/routes/agents.ts
// ============================================================================

/** GET /api/agents — paginated list (stripped of internal fields) */
export type AgentListDTO = AgentDTO[]

/** GET /api/agents/:id — single agent with Firestore doc ID */
export type AgentDTO = Agent & { id: string }

/** POST /api/agents — created agent echoed back */
export type AgentCreateDTO = AgentDTO

/** PATCH /api/agents/:id — updated agent echoed back */
export type AgentUpdateDTO = AgentDTO

// ============================================================================
// CAM — REVENUE ANALYTICS — services/api/src/routes/cam.ts
// ============================================================================

/** Reusable bucket shape for breakdowns (by type, by carrier, by agent) */
export interface RevenueBucket {
  total: number
  count: number
}

/** GET /api/cam/revenue — revenue summary with multi-axis breakdowns */
export interface CamRevenueSummaryData {
  total: number
  record_count: number
  by_type: Record<string, RevenueBucket>
  by_carrier: Record<string, RevenueBucket>
  by_agent: Record<string, RevenueBucket>
}

/** Single month in the trend series */
export interface RevenueTrendMonth {
  month: string
  total: number
  count: number
}

/** GET /api/cam/revenue/trends — monthly revenue trend */
export interface CamRevenueTrendsData {
  months: RevenueTrendMonth[]
  period_months: number
}

/** GET /api/cam/revenue/by-carrier — carriers ranked by total revenue */
export type CamRevenueByCarrierDTO = CamCarrierBucket[]

export interface CamCarrierBucket {
  carrier: string
  total: number
  count: number
}

/** GET /api/cam/revenue/by-agent — agents ranked by total revenue */
export type CamRevenueByAgentDTO = CamAgentBucket[]

export interface CamAgentBucket {
  agent_id: string
  total: number
  count: number
}

/** GET /api/cam/revenue/by-type — product types ranked by total revenue */
export type CamRevenueByTypeDTO = CamTypeBucket[]

export interface CamTypeBucket {
  product_type: string
  total: number
  count: number
}

// ============================================================================
// CAM — COMMISSION CALCULATIONS
// ============================================================================

/** POST /api/cam/commission/calculate — single commission calculation */
export interface CommissionCalculateData {
  amount: number
  rate: number
  type: string
  commission: number
  breakdown: {
    gross: number
    rate_applied: number
    net_commission: number
  }
}

/** Year projection used in commission/project response */
export interface YearProjectionDTO {
  year: number
  revenue: number
  cumulative: number
}

/** POST /api/cam/commission/project — multi-year revenue projection */
export interface CommissionProjectData {
  projection: {
    projections: YearProjectionDTO[]
    total: number
  }
  npv?: number
  inputs: {
    account_count: number
    years: number
    growth_rate: number
  }
}

/** Single schedule entry for an account's commission history */
export interface CommissionScheduleEntry {
  id: string
  revenue_type: string
  amount: number
  period: string
  payment_date: string
  status: string
}

/** GET /api/cam/commission/schedule/:id — commission schedule for one account */
export interface CommissionScheduleData {
  account_id: string
  schedule: CommissionScheduleEntry[]
  total: number
  record_count?: number
}

// ============================================================================
// CAM — COMP GRIDS
// ============================================================================

/** GET /api/cam/comp-grids — paginated list (stripped of internal fields) */
export type CompGridListDTO = CompGridDTO[]

/** GET /api/cam/comp-grids/:id — single comp grid with Firestore doc ID */
export type CompGridDTO = CompGrid & { id: string }

/** POST /api/cam/comp-grids — created comp grid echoed back */
export type CompGridCreateDTO = CompGridDTO

/** PATCH /api/cam/comp-grids/:id — updated comp grid echoed back */
export type CompGridUpdateDTO = CompGridDTO

/** GET /api/cam/comp-grids/history — paginated grid change audit trail */
export interface CompGridHistoryEntry {
  grid_id: string
  change_type: string
  old_rate: number
  new_rate: number
  changed_by: string
  changed_at: string
  old_data: Record<string, unknown>
  [key: string]: unknown
}

export type CompGridHistoryListDTO = CompGridHistoryEntry[]

// ============================================================================
// CAM — PIPELINE
// ============================================================================

/** Count + value bucket used in pipeline summary */
export interface PipelineBucket {
  count: number
  value: number
}

/** GET /api/cam/pipeline — pipeline summary with conversion rate */
export interface CamPipelineData {
  submitted: PipelineBucket
  issued: PipelineBucket
  withdrawn: PipelineBucket
  total: PipelineBucket
  conversion_rate: number
}

/** GET /api/cam/pipeline/forecast — 3/6/12-month revenue forecast */
export interface CamPipelineForecastData {
  account_count: number
  forecast_3m: number
  forecast_6m: number
  forecast_12m: number
  monthly_run_rate: number
}

// ============================================================================
// CAM — PROJECTIONS
// ============================================================================

/** Monthly revenue entry in a hypothetical projection stream */
export interface HypotheticalMonthEntry {
  month: number
  revenue: number
}

/** One stream (retail / downline / network) in a hypothetical projection */
export interface HypotheticalStream {
  year1: number
  monthly: HypotheticalMonthEntry[]
}

/** POST /api/cam/projections/hypothetical — what-if scenario result */
export interface HypotheticalProjectionData {
  tier: { key: string; percent: number }
  revenue_per_client: number
  retail: HypotheticalStream
  downline: HypotheticalStream | null
  network: HypotheticalStream | null
  total: { year1: number }
}

// ============================================================================
// CAM — COMMISSION MANAGEMENT
// ============================================================================

/** Single discrepancy found during reconciliation */
export interface CommissionDiscrepancy {
  discrepancy_id: string
  revenue_id: string
  agent_id: string
  carrier: string
  product_type: string
  period: string
  actual_amount: number
  calculated_amount: number
  difference: number
  status: string
  created_at: string
  updated_at: string
}

/** POST /api/cam/commission/reconcile — reconciliation result */
export interface CommissionReconcileResult {
  records_checked: number
  discrepancies_found: number
  discrepancies: CommissionDiscrepancy[]
}

/** GET /api/cam/commission/discrepancies — paginated list */
export type CommissionDiscrepancyListDTO = CommissionDiscrepancy[]

/** PATCH /api/cam/commission/discrepancies/:id — resolved discrepancy */
export interface CommissionDiscrepancyUpdateDTO {
  id: string
  [key: string]: unknown
}

// ============================================================================
// CAM — AGENT COMMISSION
// ============================================================================

/** GET /api/cam/agent/:agentId/commission — agent commission history + totals */
export interface AgentCommissionData {
  agent_id: string
  records: Record<string, unknown>[]
  totals: {
    fyc: number
    renewal: number
    override: number
    total: number
  }
  record_count: number
}

/** Line item on a commission statement */
export interface StatementLineItem {
  revenue_id: string
  carrier: string
  product_type: string
  revenue_type: string
  amount: number
  policy_number: string
}

/** GET /api/cam/agent/:agentId/statement — commission statement for a period */
export interface AgentStatementData {
  statement: {
    agent_id: string
    agent_name: string
    period: string
    generated_at: string
    line_items: StatementLineItem[]
    total: number
    line_item_count: number
  }
}

/** Single override entry for a downline agent */
export interface OverrideEntry {
  downline_agent_id: string
  downline_revenue: number
  override_rate: number
  override_amount: number
}

/** POST /api/cam/agent/:agentId/override — override calculation result */
export interface AgentOverrideData {
  agent_id: string
  period: string
  override_rate: number
  overrides: OverrideEntry[]
  total_override: number
}

// ============================================================================
// CAM — ANALYTICS
// ============================================================================

/** GET /api/cam/analytics/retention — revenue retention metrics */
export interface RetentionAnalyticsData {
  retention_rate: number
  lapse_rate: number
  active_revenue: number
  renewal_revenue: number
  lapsed_revenue: number
  total_base: number
}

/** Single month in the seasonal pattern */
export interface SeasonalMonth {
  month: number
  month_name: string
  total: number
  count: number
  avg: number
}

/** GET /api/cam/analytics/seasonal — seasonal revenue patterns */
export interface SeasonalAnalyticsData {
  months: SeasonalMonth[]
  avg_monthly: number
  peak_month: string
  peak_revenue: number
}

/** GET /api/cam/analytics/carrier-rank — carriers ranked by commission */
export type CarrierRankDTO = CarrierRankEntry[]

export interface CarrierRankEntry {
  carrier: string
  fyc: number
  renewal: number
  total: number
  policy_count: number
}
