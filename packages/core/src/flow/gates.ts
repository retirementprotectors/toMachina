/**
 * Gate enforcement — ported from FLOW_Gates.gs.
 * Evaluates whether an instance can advance past a stage or step.
 */

import type {
  GateResult, GateBlocker, FlowTaskInstanceData,
  BuiltInCheckType, CheckHandlerResult,
} from './types'

/**
 * Run a built-in check against entity data.
 * Ported from FLOW_Config.gs runBuiltInCheck_().
 */
export function runBuiltInCheck(
  checkType: BuiltInCheckType,
  config: Record<string, unknown>,
  entityData: Record<string, unknown>
): CheckHandlerResult {
  switch (checkType) {
    case 'FIELD_PRESENT': {
      const field = String(config.field || '')
      const val = entityData[field]
      if (val != null && val !== '') {
        return { result: 'PASS', detail: `${field} is present` }
      }
      return { result: 'FAIL', detail: `${field} is missing or empty` }
    }
    case 'FIELD_MATCHES': {
      const field = String(config.field || '')
      const expected = String(config.expected || '')
      const actual = String(entityData[field] || '')
      if (actual.toLowerCase() === expected.toLowerCase()) {
        return { result: 'PASS', detail: `${field} matches "${expected}"` }
      }
      return { result: 'FAIL', detail: `${field} is "${actual}", expected "${expected}"` }
    }
    case 'FIELD_NOT_CONTAINS': {
      const field = String(config.field || '')
      const forbidden = String(config.forbidden || '')
      const actual = String(entityData[field] || '')
      if (!actual.toLowerCase().includes(forbidden.toLowerCase())) {
        return { result: 'PASS', detail: `${field} does not contain "${forbidden}"` }
      }
      return { result: 'FAIL', detail: `${field} contains forbidden value "${forbidden}"` }
    }
    case 'NUMERIC_LIMIT': {
      const field = String(config.field || '')
      const val = Number(entityData[field])
      const min = config.min != null ? Number(config.min) : -Infinity
      const max = config.max != null ? Number(config.max) : Infinity
      if (isNaN(val)) return { result: 'FAIL', detail: `${field} is not a number` }
      if (val >= min && val <= max) {
        return { result: 'PASS', detail: `${field} (${val}) is within [${min}, ${max}]` }
      }
      return { result: 'FAIL', detail: `${field} (${val}) is outside [${min}, ${max}]` }
    }
    case 'ALL_FORMS_CHECKED': {
      const field = String(config.field || '')
      const checklist = entityData[field]
      if (checklist && typeof checklist === 'object' && !Array.isArray(checklist)) {
        const allChecked = Object.values(checklist as Record<string, unknown>).every(v => v === true)
        if (allChecked) return { result: 'PASS', detail: 'All forms checked' }
        return { result: 'FAIL', detail: 'Not all forms checked' }
      }
      return { result: 'FAIL', detail: `${field} is not a checklist object` }
    }
    case 'MANUAL':
      return { result: 'PENDING', detail: 'Manual verification required' }
    default:
      return { result: 'PENDING', detail: `Unknown check type: ${checkType}` }
  }
}

/**
 * Evaluate a stage gate — checks if all required tasks in the stage are complete.
 * Ported from FLOW_Gates.gs checkStageGate().
 */
export function evaluateStageGate(
  tasks: FlowTaskInstanceData[],
  stageId: string,
  gateEnforced: boolean
): GateResult {
  if (!gateEnforced) return { pass: true, blockers: [] }

  const stageTasks = tasks.filter(t => t.stage_id === stageId)
  if (stageTasks.length === 0) return { pass: true, blockers: [] }

  const blockers: GateBlocker[] = []
  for (const task of stageTasks) {
    if (task.is_required && !['completed', 'skipped'].includes(task.status)) {
      blockers.push({
        step_id: task.step_id,
        task_id: task.task_id,
        task_name: task.task_name,
        status: task.status,
        check_result: task.check_result,
        reason: `Required task "${task.task_name}" is ${task.status}`,
      })
    } else if (task.is_system_check && task.status === 'completed' && task.check_result && task.check_result !== 'PASS') {
      // System check tasks must have PASS result even if status is completed
      blockers.push({
        step_id: task.step_id,
        task_id: task.task_id,
        task_name: task.task_name,
        status: task.status,
        check_result: task.check_result,
        reason: `System check "${task.task_name}" returned ${task.check_result}`,
      })
    }
  }

  return { pass: blockers.length === 0, blockers }
}

/**
 * Evaluate a step gate — checks if all required tasks in the step are complete.
 * Ported from FLOW_Gates.gs checkStepGate().
 */
export function evaluateStepGate(
  tasks: FlowTaskInstanceData[],
  stepId: string,
  gateEnforced: boolean
): GateResult {
  if (!gateEnforced) return { pass: true, blockers: [] }

  const stepTasks = tasks.filter(t => t.step_id === stepId)
  if (stepTasks.length === 0) return { pass: true, blockers: [] }

  const blockers: GateBlocker[] = []
  for (const task of stepTasks) {
    if (task.is_required && !['completed', 'skipped'].includes(task.status)) {
      blockers.push({
        step_id: task.step_id,
        task_id: task.task_id,
        task_name: task.task_name,
        status: task.status,
        check_result: task.check_result,
        reason: `Required task "${task.task_name}" is ${task.status}`,
      })
    } else if (task.is_system_check && task.status === 'completed' && task.check_result && task.check_result !== 'PASS') {
      // System check tasks must have PASS result even if status is completed
      blockers.push({
        step_id: task.step_id,
        task_id: task.task_id,
        task_name: task.task_name,
        status: task.status,
        check_result: task.check_result,
        reason: `System check "${task.task_name}" returned ${task.check_result}`,
      })
    }
  }

  return { pass: blockers.length === 0, blockers }
}
