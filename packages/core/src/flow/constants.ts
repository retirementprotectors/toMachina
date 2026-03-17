/**
 * Flow engine constants — ported from FLOW_Config.gs.
 * Default pipeline definitions, status enums, built-in check types.
 */

export const INSTANCE_STATUSES = ['pending', 'in_progress', 'complete', 'blocked'] as const
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'skipped', 'blocked'] as const
export const CHECK_RESULTS = ['PASS', 'FAIL', 'PENDING', 'SKIPPED'] as const

export const ACTIVITY_ACTIONS = [
  'CREATE', 'ADVANCE_STAGE', 'ADVANCE_STEP', 'COMPLETE_TASK',
  'SKIP_TASK', 'GATE_PASS', 'GATE_FAIL', 'ASSIGN',
  'PRIORITY_CHANGE', 'SYSTEM_CHECK',
] as const

export const BUILT_IN_CHECK_TYPES = [
  'FIELD_PRESENT', 'FIELD_MATCHES', 'FIELD_NOT_CONTAINS',
  'NUMERIC_LIMIT', 'ALL_FORMS_CHECKED', 'MANUAL',
] as const

export const FLOW_COLLECTIONS = {
  PIPELINES: 'flow_pipelines',
  STAGES: 'flow_stages',
  WORKFLOWS: 'flow_workflows',
  STEPS: 'flow_steps',
  TASK_TEMPLATES: 'flow_task_templates',
  INSTANCES: 'flow_instances',
  INSTANCE_TASKS: 'flow_instance_tasks',
  ACTIVITY: 'flow_activity',
} as const

export const DEFAULT_PRIORITY = 'MEDIUM'
export const DEFAULT_ENTITY_TYPE = 'CLIENT'
export const HOUSEHOLD_ENTITY_TYPE = 'HOUSEHOLD'
