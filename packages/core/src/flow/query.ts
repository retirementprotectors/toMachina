/**
 * Flow query helpers — pure filter/sort utilities.
 * Ported from FLOW_Query.gs.
 * Firestore queries are done by the API layer; these helpers process results.
 */

import type { FlowInstanceData, FlowStageDef } from './types'

export interface KanbanColumn {
  stage_id: string
  stage_name: string
  stage_order: number
  stage_color?: string
  instances: FlowInstanceData[]
  count: number
}

/**
 * Build a Kanban board structure from stages + instances.
 * Ported from FLOW_Query.gs getKanban().
 */
export function buildKanbanBoard(
  stages: FlowStageDef[],
  instances: FlowInstanceData[]
): KanbanColumn[] {
  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order)
  return sorted.map(stage => {
    const stageInstances = instances.filter(i => i.current_stage === stage.stage_id)
    return {
      stage_id: stage.stage_id,
      stage_name: stage.stage_name,
      stage_order: stage.stage_order,
      stage_color: stage.stage_color,
      instances: stageInstances,
      count: stageInstances.length,
    }
  })
}

/**
 * Parse JSON fields on an instance (entity_data, workflow_progress, custom_fields).
 */
export function parseInstanceJsonFields(instance: FlowInstanceData): FlowInstanceData & {
  _entityData: Record<string, unknown>
  _workflowProgress: Record<string, unknown>
  _customFields: Record<string, unknown>
} {
  return {
    ...instance,
    _entityData: safeJsonParse(instance.entity_data),
    _workflowProgress: safeJsonParse(instance.workflow_progress),
    _customFields: safeJsonParse(instance.custom_fields),
  }
}

function safeJsonParse(val: unknown): Record<string, unknown> {
  if (typeof val === 'object' && val !== null) return val as Record<string, unknown>
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return {} }
  }
  return {}
}
