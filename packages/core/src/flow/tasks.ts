/**
 * Flow task helpers — task completion and skip logic.
 * Ported from FLOW_Tasks.gs.
 */

import type { FlowTaskInstanceData, CheckResult } from './types'
import { dispatchCheck } from './hooks'

/**
 * Attempt to complete a task. If it's a system check, runs the check first.
 * Returns the updated task fields and check result.
 * Ported from FLOW_Tasks.gs completeTask().
 */
export function processTaskCompletion(
  task: FlowTaskInstanceData,
  completedBy: string,
  entityData: Record<string, unknown>,
  notes?: string
): { success: boolean; updates: Partial<FlowTaskInstanceData>; error?: string } {
  const now = new Date().toISOString()

  // System check tasks dispatch to handler
  if (task.is_system_check && task.check_type) {
    const result = dispatchCheck(task.check_type, task.check_config || '{}', entityData)

    if (result.result === 'FAIL') {
      return {
        success: false,
        updates: {
          status: 'blocked',
          check_result: 'FAIL',
          check_detail: result.detail,
          updated_at: now,
        },
        error: `System check failed: ${result.detail}`,
      }
    }

    return {
      success: true,
      updates: {
        status: 'completed',
        check_result: result.result as CheckResult,
        check_detail: result.detail,
        completed_by: completedBy,
        completed_at: now,
        notes: notes || '',
        updated_at: now,
      },
    }
  }

  // Regular task — just complete it
  return {
    success: true,
    updates: {
      status: 'completed',
      check_result: 'PASS',
      check_detail: 'Completed manually',
      completed_by: completedBy,
      completed_at: now,
      notes: notes || '',
      updated_at: now,
    },
  }
}

/**
 * Attempt to skip a task. Only non-required tasks can be skipped.
 * Ported from FLOW_Tasks.gs skipTask().
 */
export function processTaskSkip(
  task: FlowTaskInstanceData,
  skippedBy: string,
  reason?: string
): { success: boolean; updates: Partial<FlowTaskInstanceData>; error?: string } {
  if (task.is_required) {
    return {
      success: false,
      updates: {},
      error: `Cannot skip required task "${task.task_name}"`,
    }
  }

  const now = new Date().toISOString()
  return {
    success: true,
    updates: {
      status: 'skipped',
      check_result: 'SKIPPED',
      check_detail: reason || 'Skipped by user',
      completed_by: skippedBy,
      completed_at: now,
      notes: reason || '',
      updated_at: now,
    },
  }
}
