/**
 * Flow / Pipeline / Approval / Rules — API response DTOs.
 *
 * Covers routes:
 *   services/api/src/routes/flow.ts          (flow engine instance ops)
 *   services/api/src/routes/flow-admin.ts    (pipeline studio CRUD)
 *   services/api/src/routes/pipelines.ts     (legacy pipelines collection)
 *   services/api/src/routes/approval.ts      (approval engine)
 *   services/api/src/routes/rules.ts         (automation rules)
 */

import type {
  FlowPipelineDef,
  FlowStageDef,
  FlowWorkflowDef,
  FlowStepDef,
  FlowTaskTemplateDef,
  FlowInstanceData,
  FlowTaskInstanceData,
  FlowActivityData,
} from '../flow/types'

import type {
  ApprovalItem,
  ApprovalBatch,
  BatchSummary,
  BatchStatus,
  ExecutionResult,
  RoutingResult,
  TrainingRecord,
} from '../approval/types'

// ============================================================================
// Flow Engine — Pipeline config reads (flow.ts)
// ============================================================================

/** GET /api/flow/pipelines — list pipeline definitions */
export type FlowPipelineDTO = FlowPipelineDef & { id: string }

/** GET /api/flow/pipelines/:key — single pipeline definition */
export type FlowPipelineDetailDTO = FlowPipelineDef & { id: string }

/** GET /api/flow/pipelines/:key/stages — stages for a pipeline */
export type FlowStageDTO = FlowStageDef & { id: string }

// ============================================================================
// Flow Engine — Instance CRUD (flow.ts)
// ============================================================================

/** GET /api/flow/instances — list instances */
export type FlowInstanceDTO = FlowInstanceData & { id: string }

/** GET /api/flow/instances/:id — instance detail with tasks, activity, stages */
export interface FlowInstanceDetailData {
  instance: FlowInstanceData & { id: string }
  tasks: Array<FlowTaskInstanceData & { id: string }>
  activity: Array<FlowActivityData & { id: string }>
  stages: Array<FlowStageDef & { id: string }>
  gateResult?: { pass: boolean; reasons: string[] } | null
  isAtFinalStage?: boolean
}

/** POST /api/flow/instances — create a new instance */
export interface FlowInstanceCreateResult {
  instance_id: string
  pipeline_key: string
  current_stage: string
  tasks_generated: number
}

/** PATCH /api/flow/instances/:id (action=advance) */
export interface FlowInstanceAdvanceResult {
  new_stage: string
  tasks_generated: number
}

/** PATCH /api/flow/instances/:id (action=complete) */
export interface FlowInstanceCompleteResult {
  instance_id: string
  status: 'complete'
}

/** PATCH /api/flow/instances/:id (action=reassign) */
export interface FlowInstanceReassignResult {
  instance_id: string
  assigned_to: string
}

/** PATCH /api/flow/instances/:id (action=priority) */
export interface FlowInstancePriorityResult {
  instance_id: string
  priority: string
}

/** PATCH /api/flow/instances/:id (action=move) */
export interface FlowInstanceMoveResult {
  instance_id: string
  new_stage: string
}

/** Union of all PATCH /api/flow/instances/:id responses */
export type FlowInstancePatchResult =
  | FlowInstanceAdvanceResult
  | FlowInstanceCompleteResult
  | FlowInstanceReassignResult
  | FlowInstancePriorityResult
  | FlowInstanceMoveResult

// ============================================================================
// Flow Engine — Task operations (flow.ts)
// ============================================================================

/** POST /api/flow/instances/:id/tasks — generate tasks for current stage */
export interface FlowTasksGenerateResult {
  instance_id: string
  tasks_generated: number
}

/** PATCH /api/flow/tasks/:id (action=complete) */
export interface FlowTaskCompleteResult {
  task_instance_id: string
  status: 'completed'
  check_result: 'PASS'
}

/** PATCH /api/flow/tasks/:id (action=skip) */
export interface FlowTaskSkipResult {
  task_instance_id: string
  status: 'skipped'
}

/** Union of all PATCH /api/flow/tasks/:id responses */
export type FlowTaskPatchResult = FlowTaskCompleteResult | FlowTaskSkipResult

// ============================================================================
// Pipeline Studio — Admin CRUD (flow-admin.ts)
// ============================================================================

/** POST/PUT /api/flow/admin/pipelines — create/update pipeline */
export interface FlowAdminPipelineData {
  pipeline: FlowPipelineDef & { id: string }
}

/** DELETE /api/flow/admin/pipelines/:key — archive pipeline */
export interface FlowAdminPipelineArchiveResult {
  archived: true
}

/** POST /api/flow/admin/pipelines/:key/publish */
export interface FlowAdminPipelinePublishResult {
  published: true
}

/** POST /api/flow/admin/pipelines/:key/unpublish */
export interface FlowAdminPipelineUnpublishResult {
  unpublished: true
}

/** POST /api/flow/admin/stages — creates stage + auto-generated workflow */
export interface FlowAdminStageCreateData {
  stage: FlowStageDef & { id: string }
  workflow: FlowWorkflowDef & { id: string }
}

/** PUT /api/flow/admin/stages/:id — update stage */
export interface FlowAdminStageUpdateData {
  stage: FlowStageDef & { id: string }
}

/** DELETE /api/flow/admin/stages/:id — cascade delete */
export interface FlowAdminStageDeleteResult {
  deleted: true
  cascaded: {
    workflows: number
    steps: number
    tasks: number
  }
}

/** POST /api/flow/admin/stages/reorder — batch reorder */
export interface FlowAdminStageReorderResult {
  reordered: number
}

/** POST/PUT /api/flow/admin/steps — create/update step */
export interface FlowAdminStepData {
  step: FlowStepDef & { id: string }
}

/** DELETE /api/flow/admin/steps/:id — cascade delete */
export interface FlowAdminStepDeleteResult {
  deleted: true
  cascaded: {
    tasks: number
  }
}

/** POST/PUT /api/flow/admin/tasks — create/update task template */
export interface FlowAdminTaskTemplateData {
  task: FlowTaskTemplateDef & { id: string }
}

/** DELETE /api/flow/admin/tasks/:id */
export interface FlowAdminTaskTemplateDeleteResult {
  deleted: true
}

/** POST/PUT /api/flow/admin/workflows — create/update workflow */
export interface FlowAdminWorkflowData {
  workflow: FlowWorkflowDef & { id: string }
}

/** DELETE /api/flow/admin/workflows/:id */
export interface FlowAdminWorkflowDeleteResult {
  deleted: true
}

// ============================================================================
// Legacy Pipelines collection (pipelines.ts)
// ============================================================================

/**
 * GET /api/pipelines, GET /api/pipelines/:id
 * Legacy pipelines collection (separate from flow_pipelines).
 * Generic record — no typed schema yet.
 */
export type LegacyPipelineDTO = Record<string, unknown> & { id: string }

// ============================================================================
// Approval Engine (approval.ts)
// ============================================================================

/** POST /api/approval/batches — create a new approval batch */
export interface ApprovalBatchCreateResult {
  batch_id: string
  approval_count: number
  summary: BatchSummary
  assigned_to: string
  routing: RoutingResult
}

/** POST /api/approval/batches/:id/notify — Slack notification sent */
export interface ApprovalNotifyResult {
  ts: string | undefined
  channel: string | undefined
}

/** PATCH /api/approval/batches/:id/items/:itemId — single item update */
export type ApprovalItemDTO = ApprovalItem

/** PATCH /api/approval/batches/:id/bulk — bulk update result */
export interface ApprovalBulkUpdateResult {
  updated: number
  summary: BatchSummary
}

/** POST /api/approval/batches/:id/execute — execution result */
export interface ApprovalExecuteResult {
  batch_id: string
  status: BatchStatus
  executed: number
  errors: number
  training_captured: number
  wire_resumed: boolean
  results: ExecutionResult[]
}

/** GET /api/approval/batches — list view (items stripped for performance) */
export interface ApprovalBatchListItem {
  batch_id: string
  source_type: string
  entity_name: string
  status: string
  assigned_to: string
  summary: BatchSummary
  created_at: string
  updated_at: string
  executed_at: string
  item_count: number
}

/** Deep-links resolved for a batch — client/ACF/account jump targets */
export interface ApprovalDeepLink {
  label: string
  url: string
}
export interface ApprovalDeepLinks {
  clientUrl: string | null
  acfFolderUrl: string | null
  accounts: ApprovalDeepLink[]
}

/** GET /api/approval/batches/:id — full batch detail + resolved deep-links */
export type ApprovalBatchDetailDTO = ApprovalBatch & {
  deep_links?: ApprovalDeepLinks
}

/** GET /api/approval/stats — dashboard statistics */
export interface ApprovalStatsData {
  total: number
  pending: number
  in_review: number
  executed: number
  partial: number
  error: number
  completed_today: number
  avg_approval_minutes: number
}

/** GET /api/approval/training — training records for extraction improvement */
export type ApprovalTrainingDTO = TrainingRecord & { id: string }

// ============================================================================
// Automation Rules (rules.ts)
// ============================================================================

/** Automation rule shape — no typed entity yet, defined inline. */
export interface AutomationRuleDTO {
  id: string
  rule_id: string
  rule_name: string
  trigger_type: string
  trigger_condition: Record<string, unknown> | string
  action_type: string
  action_config: Record<string, unknown> | string
  enabled: boolean
  status: string
  fire_count: number
  last_fired_at: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

/** POST /api/rules/evaluate — time-based rule evaluation result */
export interface RulesEvaluateResult {
  evaluated: number
  fired: number
  skipped: number
}
