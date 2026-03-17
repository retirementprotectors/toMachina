/**
 * Flow engine types — ported from RAPID_FLOW GAS.
 * Defines Pipeline, Stage, Instance, Gate, Hook, and FlowTask interfaces.
 */

// ============================================================================
// STATUS ENUMS
// ============================================================================

export type InstanceStatus = 'pending' | 'in_progress' | 'complete' | 'blocked'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked'
export type CheckResult = 'PASS' | 'FAIL' | 'PENDING' | 'SKIPPED'
export type ActivityAction =
  | 'CREATE'
  | 'ADVANCE_STAGE'
  | 'ADVANCE_STEP'
  | 'COMPLETE_TASK'
  | 'SKIP_TASK'
  | 'GATE_PASS'
  | 'GATE_FAIL'
  | 'ASSIGN'
  | 'PRIORITY_CHANGE'
  | 'SYSTEM_CHECK'

export type BuiltInCheckType =
  | 'FIELD_PRESENT'
  | 'FIELD_MATCHES'
  | 'FIELD_NOT_CONTAINS'
  | 'NUMERIC_LIMIT'
  | 'ALL_FORMS_CHECKED'
  | 'MANUAL'

export type HookType = 'onEnter' | 'onExit' | 'onComplete'

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface FlowPipelineDef {
  pipeline_key: string
  pipeline_name: string
  description?: string
  portal?: string
  domain?: string
  platform_carrier?: string
  product_type?: string
  default_view?: string
  icon?: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FlowStageDef {
  pipeline_key: string
  stage_id: string
  stage_name: string
  stage_description?: string
  stage_order: number
  stage_color?: string
  gate_enforced: boolean
  has_workflow: boolean
  status: string
  [key: string]: unknown
}

export interface FlowWorkflowDef {
  pipeline_key: string
  stage_id: string
  workflow_key: string
  workflow_name: string
  workflow_description?: string
  status: string
  [key: string]: unknown
}

export interface FlowStepDef {
  pipeline_key: string
  stage_id: string
  workflow_key: string
  step_id: string
  step_name: string
  step_description?: string
  step_order: number
  gate_enforced: boolean
  execution_type?: string
  status: string
  [key: string]: unknown
}

export interface FlowTaskTemplateDef {
  pipeline_key: string
  stage_id: string
  workflow_key?: string
  step_id: string
  task_id: string
  task_name: string
  task_description?: string
  task_order: number
  is_required: boolean
  is_system_check: boolean
  check_type?: string
  check_config?: string
  default_owner?: string
  role_applicability?: string
  status: string
  [key: string]: unknown
}

// ============================================================================
// INSTANCE TYPES
// ============================================================================

export interface FlowInstanceData {
  instance_id: string
  pipeline_key: string
  current_stage: string
  current_step: string
  /** Entity type for this instance. Common values: 'CLIENT' | 'HOUSEHOLD' */
  entity_type: string
  entity_id: string
  entity_name: string
  entity_data: string | Record<string, unknown>
  priority: string
  assigned_to: string
  stage_status: InstanceStatus
  workflow_progress: string | Record<string, StepProgress>
  custom_fields?: string | Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
  completed_at?: string
  [key: string]: unknown
}

export interface StepProgress {
  status: string
  tasks_total: number
  tasks_complete: number
}

export interface FlowTaskInstanceData {
  task_instance_id: string
  instance_id: string
  pipeline_key: string
  stage_id: string
  step_id: string
  task_id: string
  task_name: string
  task_order: number
  owner_email: string
  status: TaskStatus
  is_required: boolean
  is_system_check: boolean
  check_type?: string
  check_config?: string
  check_result?: CheckResult
  check_detail?: string
  completed_by?: string
  completed_at?: string
  notes?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FlowActivityData {
  activity_id: string
  instance_id: string
  pipeline_key: string
  action: ActivityAction
  from_value: string
  to_value: string
  performed_by: string
  performed_at: string
  notes?: string
  [key: string]: unknown
}

// ============================================================================
// GATE TYPES
// ============================================================================

export interface GateResult {
  pass: boolean
  blockers: GateBlocker[]
}

export interface GateBlocker {
  step_id: string
  task_id: string
  task_name: string
  status: string
  check_result?: string
  reason: string
}

// ============================================================================
// CHECK HANDLER TYPES
// ============================================================================

export interface CheckHandlerResult {
  result: CheckResult
  detail: string
}

export type CheckHandler = (
  checkConfig: Record<string, unknown>,
  instanceData: Record<string, unknown>
) => CheckHandlerResult

// ============================================================================
// CREATE INSTANCE INPUT
// ============================================================================

export interface CreateInstanceInput {
  pipeline_key: string
  entity_type?: string
  entity_id: string
  entity_name: string
  entity_data?: Record<string, unknown>
  assigned_to: string
  priority?: string
  custom_fields?: Record<string, unknown>
  created_by: string
}
