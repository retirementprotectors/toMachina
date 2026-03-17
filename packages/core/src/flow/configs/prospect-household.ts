/**
 * PROSPECT_HOUSEHOLD pipeline config.
 * 7 stages: New Lead -> Engaged -> Connect 1/2/3 -> Outcome Yes/No
 * Simple Kanban — no gates, minimal tasks.
 * On "Outcome Yes" -> handoff to SALES_RETIREMENT.
 */

import type {
  FlowPipelineDef,
  FlowStageDef,
  FlowWorkflowDef,
  FlowStepDef,
  FlowTaskTemplateDef,
} from '../types'

// ============================================================================
// Pipeline
// ============================================================================

const pipeline: FlowPipelineDef = {
  pipeline_key: 'PROSPECT_HOUSEHOLD',
  pipeline_name: 'Prospecting - Household',
  description: 'Household prospecting pipeline. Simple Kanban. Hands off to Sales Process - Retirement.',
  portal: 'PRODASHX',
  domain: 'HOUSEHOLD',
  default_view: 'kanban',
  icon: 'person_search',
  handoff_pipeline: 'SALES_RETIREMENT',
  default_entity_type: 'HOUSEHOLD',
  status: 'active',
  created_at: '2026-03-17T00:00:00.000Z',
  updated_at: '2026-03-17T00:00:00.000Z',
}

// ============================================================================
// Stages
// ============================================================================

const stages: FlowStageDef[] = [
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'new_lead',
    stage_name: 'New Lead',
    stage_description: 'New household lead received. Initial qualification pending.',
    stage_order: 10,
    stage_color: 'gray',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'engaged',
    stage_name: 'Engaged',
    stage_description: 'Household lead is engaged. Initial contact made.',
    stage_order: 20,
    stage_color: 'blue',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_1',
    stage_name: 'Connect 1',
    stage_description: 'First connect attempt.',
    stage_order: 30,
    stage_color: 'cyan',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_2',
    stage_name: 'Connect 2',
    stage_description: 'Second connect attempt.',
    stage_order: 40,
    stage_color: 'yellow',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_3',
    stage_name: 'Connect 3',
    stage_description: 'Third connect attempt.',
    stage_order: 50,
    stage_color: 'orange',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'outcome_yes',
    stage_name: 'Outcome Yes',
    stage_description: 'Household prospect converted. Handoff to Sales Process - Retirement.',
    stage_order: 60,
    stage_color: 'green',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'outcome_no',
    stage_name: 'Outcome No',
    stage_description: 'Household prospect declined or unresponsive.',
    stage_order: 70,
    stage_color: 'red',
    gate_enforced: false,
    has_workflow: false,
    status: 'active',
  },
]

// ============================================================================
// Workflows (one per stage except Outcome No)
// ============================================================================

const workflows: FlowWorkflowDef[] = [
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'new_lead',
    workflow_key: 'new_lead_workflow',
    workflow_name: 'New Lead Workflow',
    workflow_description: 'Initial household lead qualification.',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'engaged',
    workflow_key: 'engaged_workflow',
    workflow_name: 'Engaged Workflow',
    workflow_description: 'Initial engagement and contact.',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_1',
    workflow_key: 'connect_1_workflow',
    workflow_name: 'Connect 1 Workflow',
    workflow_description: 'First connect attempt.',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_2',
    workflow_key: 'connect_2_workflow',
    workflow_name: 'Connect 2 Workflow',
    workflow_description: 'Second connect attempt.',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_3',
    workflow_key: 'connect_3_workflow',
    workflow_name: 'Connect 3 Workflow',
    workflow_description: 'Third connect attempt.',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'outcome_yes',
    workflow_key: 'outcome_yes_workflow',
    workflow_name: 'Outcome Yes Workflow',
    workflow_description: 'Household prospect converted — prepare handoff.',
    status: 'active',
  },
]

// ============================================================================
// Steps (1 per workflow)
// ============================================================================

const steps: FlowStepDef[] = [
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'new_lead',
    workflow_key: 'new_lead_workflow',
    step_id: 'qualify_lead',
    step_name: 'Qualify Lead',
    step_description: 'Review and qualify the new household lead.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'engaged',
    workflow_key: 'engaged_workflow',
    step_id: 'initial_engagement',
    step_name: 'Initial Engagement',
    step_description: 'Make initial contact with the household.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_1',
    workflow_key: 'connect_1_workflow',
    step_id: 'attempt_1',
    step_name: 'Connect Attempt 1',
    step_description: 'First connect attempt.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_2',
    workflow_key: 'connect_2_workflow',
    step_id: 'attempt_2',
    step_name: 'Connect Attempt 2',
    step_description: 'Second connect attempt.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_3',
    workflow_key: 'connect_3_workflow',
    step_id: 'attempt_3',
    step_name: 'Connect Attempt 3',
    step_description: 'Third connect attempt.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'outcome_yes',
    workflow_key: 'outcome_yes_workflow',
    step_id: 'prepare_handoff',
    step_name: 'Prepare Handoff',
    step_description: 'Prepare handoff to Sales Process - Retirement.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
]

// ============================================================================
// Tasks (minimal — 0-1 per stage)
// ============================================================================

const tasks: FlowTaskTemplateDef[] = [
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'new_lead',
    workflow_key: 'new_lead_workflow',
    step_id: 'qualify_lead',
    task_id: 'review_lead_source',
    task_name: 'Review Lead Source',
    task_description: 'Review household lead source and qualification criteria.',
    task_order: 10,
    is_required: false,
    is_system_check: false,
    default_owner: 'ADVISOR',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'engaged',
    workflow_key: 'engaged_workflow',
    step_id: 'initial_engagement',
    task_id: 'log_initial_contact',
    task_name: 'Log Initial Contact',
    task_description: 'Record initial contact details and next steps.',
    task_order: 10,
    is_required: false,
    is_system_check: false,
    default_owner: 'ADVISOR',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_1',
    workflow_key: 'connect_1_workflow',
    step_id: 'attempt_1',
    task_id: 'log_connect_1',
    task_name: 'Log Connect Attempt 1',
    task_description: 'Record outcome of first connect attempt.',
    task_order: 10,
    is_required: false,
    is_system_check: false,
    default_owner: 'ADVISOR',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_2',
    workflow_key: 'connect_2_workflow',
    step_id: 'attempt_2',
    task_id: 'log_connect_2',
    task_name: 'Log Connect Attempt 2',
    task_description: 'Record outcome of second connect attempt.',
    task_order: 10,
    is_required: false,
    is_system_check: false,
    default_owner: 'ADVISOR',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'connect_3',
    workflow_key: 'connect_3_workflow',
    step_id: 'attempt_3',
    task_id: 'log_connect_3',
    task_name: 'Log Connect Attempt 3',
    task_description: 'Record outcome of third connect attempt.',
    task_order: 10,
    is_required: false,
    is_system_check: false,
    default_owner: 'ADVISOR',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'PROSPECT_HOUSEHOLD',
    stage_id: 'outcome_yes',
    workflow_key: 'outcome_yes_workflow',
    step_id: 'prepare_handoff',
    task_id: 'create_sales_instance',
    task_name: 'Create Sales Instance',
    task_description: 'Trigger handoff to SALES_RETIREMENT pipeline.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'ADVISOR',
    role_applicability: 'GENERAL',
    status: 'active',
  },
]

// ============================================================================
// Export
// ============================================================================

export const PROSPECT_HOUSEHOLD_CONFIG = {
  pipeline,
  stages,
  workflows,
  steps,
  tasks,
} as const
