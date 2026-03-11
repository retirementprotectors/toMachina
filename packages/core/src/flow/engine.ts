/**
 * Flow engine — core state machine.
 * Ported from FLOW_Engine.gs.
 * Pure logic layer — Firestore I/O is done by the caller (API routes).
 */

import type {
  FlowInstanceData, FlowStageDef, FlowTaskInstanceData,
  GateResult, CreateInstanceInput, StepProgress, ActivityAction,
} from './types'
import { evaluateStageGate, evaluateStepGate } from './gates'
import { DEFAULT_PRIORITY, DEFAULT_ENTITY_TYPE } from './constants'

/**
 * Build a new instance object (does NOT write to Firestore).
 * Ported from FLOW_Engine.gs createInstance().
 */
export function buildNewInstance(
  input: CreateInstanceInput,
  instanceId: string,
  firstStageId: string
): FlowInstanceData {
  const now = new Date().toISOString()
  return {
    instance_id: instanceId,
    pipeline_key: input.pipeline_key,
    current_stage: firstStageId,
    current_step: '',
    entity_type: input.entity_type || DEFAULT_ENTITY_TYPE,
    entity_id: input.entity_id,
    entity_name: input.entity_name,
    entity_data: input.entity_data ? JSON.stringify(input.entity_data) : '{}',
    priority: input.priority || DEFAULT_PRIORITY,
    assigned_to: input.assigned_to,
    stage_status: 'in_progress',
    workflow_progress: '{}',
    custom_fields: input.custom_fields ? JSON.stringify(input.custom_fields) : '{}',
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
  }
}

/**
 * Determine the next stage for an instance.
 * Returns null if already at the last stage.
 */
export function getNextStage(
  stages: FlowStageDef[],
  currentStageId: string
): FlowStageDef | null {
  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order)
  const currentIdx = sorted.findIndex(s => s.stage_id === currentStageId)
  if (currentIdx < 0 || currentIdx >= sorted.length - 1) return null
  return sorted[currentIdx + 1]
}

/**
 * Check if an instance can advance to the next stage.
 * Returns gate result with blockers if gate is enforced and tasks are incomplete.
 */
export function canAdvanceStage(
  instance: FlowInstanceData,
  stages: FlowStageDef[],
  tasks: FlowTaskInstanceData[]
): { canAdvance: boolean; nextStage: FlowStageDef | null; gate: GateResult } {
  const currentStage = stages.find(s => s.stage_id === instance.current_stage)
  const nextStage = getNextStage(stages, instance.current_stage)

  if (!nextStage) {
    return { canAdvance: false, nextStage: null, gate: { pass: true, blockers: [] } }
  }

  const gate = evaluateStageGate(
    tasks,
    instance.current_stage,
    currentStage?.gate_enforced ?? false
  )

  return { canAdvance: gate.pass, nextStage, gate }
}

/**
 * Build the updates to apply when advancing a stage.
 */
export function buildStageAdvanceUpdates(nextStageId: string): Partial<FlowInstanceData> {
  return {
    current_stage: nextStageId,
    current_step: '',
    workflow_progress: '{}',
    stage_status: 'in_progress',
    updated_at: new Date().toISOString(),
  }
}

/**
 * Build the updates to apply when completing an instance.
 */
export function buildCompleteUpdates(): Partial<FlowInstanceData> {
  const now = new Date().toISOString()
  return {
    stage_status: 'complete',
    completed_at: now,
    updated_at: now,
  }
}

/**
 * Build the updates for reassigning an instance.
 */
export function buildReassignUpdates(newOwner: string): Partial<FlowInstanceData> {
  return {
    assigned_to: newOwner,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Build the updates for changing priority.
 */
export function buildPriorityUpdates(newPriority: string): Partial<FlowInstanceData> {
  return {
    priority: newPriority,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Build an activity log entry.
 */
export function buildActivity(
  activityId: string,
  instanceId: string,
  pipelineKey: string,
  action: ActivityAction,
  fromValue: string,
  toValue: string,
  performedBy: string,
  notes?: string
) {
  return {
    activity_id: activityId,
    instance_id: instanceId,
    pipeline_key: pipelineKey,
    action,
    from_value: fromValue,
    to_value: toValue,
    performed_by: performedBy,
    performed_at: new Date().toISOString(),
    notes: notes || '',
  }
}

/**
 * Recalculate workflow progress from tasks.
 * Ported from FLOW_Tasks.gs _recalcProgress().
 */
export function recalcProgress(tasks: FlowTaskInstanceData[]): Record<string, StepProgress> {
  const progress: Record<string, StepProgress> = {}

  for (const task of tasks) {
    if (!progress[task.step_id]) {
      progress[task.step_id] = { status: 'pending', tasks_total: 0, tasks_complete: 0 }
    }
    progress[task.step_id].tasks_total++
    if (['completed', 'skipped'].includes(task.status)) {
      progress[task.step_id].tasks_complete++
    }
  }

  for (const [stepId, p] of Object.entries(progress)) {
    if (p.tasks_complete >= p.tasks_total) {
      progress[stepId].status = 'complete'
    } else if (p.tasks_complete > 0) {
      progress[stepId].status = 'in_progress'
    } else {
      progress[stepId].status = 'pending'
    }
  }

  return progress
}

/**
 * Build a task instance from a template.
 * Ported from FLOW_Tasks.gs generateTasksForStage().
 */
export function buildTaskInstance(
  taskInstanceId: string,
  instanceId: string,
  pipelineKey: string,
  template: {
    stage_id: string
    step_id: string
    task_id: string
    task_name: string
    task_order: number
    is_required: boolean
    is_system_check: boolean
    check_type?: string
    check_config?: string
    default_owner?: string
  },
  assignedTo: string
): FlowTaskInstanceData {
  const now = new Date().toISOString()
  const ownerEmail = template.default_owner === 'SYSTEM'
    ? 'SYSTEM'
    : (template.default_owner && template.default_owner !== 'ADVISOR')
      ? template.default_owner
      : assignedTo

  return {
    task_instance_id: taskInstanceId,
    instance_id: instanceId,
    pipeline_key: pipelineKey,
    stage_id: template.stage_id,
    step_id: template.step_id,
    task_id: template.task_id,
    task_name: template.task_name,
    task_order: template.task_order,
    owner_email: ownerEmail,
    status: 'pending',
    is_required: template.is_required,
    is_system_check: template.is_system_check,
    check_type: template.check_type,
    check_config: template.check_config,
    check_result: undefined,
    check_detail: undefined,
    created_at: now,
    updated_at: now,
  }
}
