/**
 * REACTIVE_RETIREMENT pipeline config.
 * 4 stages: Intake -> Paperwork -> Client Signature -> Carrier Processing
 * Simple reactive service pipeline with DEX integration at Paperwork stage.
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
  pipeline_key: 'REACTIVE_RETIREMENT',
  pipeline_name: 'Reactive Service - Retirement',
  description: 'Reactive service requests for retirement accounts. Intake through carrier processing.',
  portal: 'PRODASHX',
  domain: 'RETIREMENT',
  default_view: 'kanban',
  icon: 'support_agent',
  status: 'active',
  created_at: '2026-03-13T00:00:00.000Z',
  updated_at: '2026-03-13T00:00:00.000Z',
}

// ============================================================================
// Stages
// ============================================================================

const stages: FlowStageDef[] = [
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'intake',
    stage_name: 'Intake',
    stage_description: 'Service request received. Log request details and classify.',
    stage_order: 10,
    stage_color: 'blue',
    gate_enforced: false,
    has_workflow: true,
    ghl_stage_id: 'intake',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'paperwork',
    stage_name: 'Paperwork',
    stage_description: 'Generate required paperwork via DEX. Prepare forms for client.',
    stage_order: 20,
    stage_color: 'yellow',
    gate_enforced: false,
    has_workflow: true,
    ghl_stage_id: 'paperwork',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'client_signature',
    stage_name: 'Client Signature',
    stage_description: 'Paperwork sent to client for signature.',
    stage_order: 30,
    stage_color: 'orange',
    gate_enforced: false,
    has_workflow: true,
    ghl_stage_id: 'client_signature',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    stage_name: 'Carrier Processing',
    stage_description: 'Signed paperwork submitted to carrier. Awaiting processing.',
    stage_order: 40,
    stage_color: 'green',
    gate_enforced: false,
    has_workflow: true,
    ghl_stage_id: 'carrier_processing',
    status: 'active',
  },
]

// ============================================================================
// Workflows
// ============================================================================

const workflows: FlowWorkflowDef[] = [
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'intake',
    workflow_key: 'intake_workflow',
    workflow_name: 'Intake Workflow',
    workflow_description: 'Log and classify the service request.',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'paperwork',
    workflow_key: 'paperwork_workflow',
    workflow_name: 'Paperwork Workflow',
    workflow_description: 'Generate and prepare paperwork via DEX.',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'client_signature',
    workflow_key: 'client_signature_workflow',
    workflow_name: 'Client Signature Workflow',
    workflow_description: 'Send paperwork and collect client signature.',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    workflow_key: 'carrier_processing_workflow',
    workflow_name: 'Carrier Processing Workflow',
    workflow_description: 'Submit to carrier and track processing.',
    status: 'active',
  },
]

// ============================================================================
// Steps
// ============================================================================

const steps: FlowStepDef[] = [
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'intake',
    workflow_key: 'intake_workflow',
    step_id: 'log_request',
    step_name: 'Log Request',
    step_description: 'Log the service request details.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'paperwork',
    workflow_key: 'paperwork_workflow',
    step_id: 'generate_paperwork',
    step_name: 'Generate Paperwork',
    step_description: 'Generate required forms via DEX.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'client_signature',
    workflow_key: 'client_signature_workflow',
    step_id: 'collect_signature',
    step_name: 'Collect Signature',
    step_description: 'Send forms to client and collect signature.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    workflow_key: 'carrier_processing_workflow',
    step_id: 'submit_to_carrier',
    step_name: 'Submit to Carrier',
    step_description: 'Submit signed paperwork to carrier.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    workflow_key: 'carrier_processing_workflow',
    step_id: 'track_processing',
    step_name: 'Track Processing',
    step_description: 'Monitor carrier processing status.',
    step_order: 20,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
]

// ============================================================================
// Tasks
// ============================================================================

const tasks: FlowTaskTemplateDef[] = [
  // Intake
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'intake',
    workflow_key: 'intake_workflow',
    step_id: 'log_request',
    task_id: 'log_service_request',
    task_name: 'Log Service Request',
    task_description: 'Record the service request type, details, and client information.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'intake',
    workflow_key: 'intake_workflow',
    step_id: 'log_request',
    task_id: 'classify_request',
    task_name: 'Classify Request Type',
    task_description: 'Classify the service request (RMD, transfer, beneficiary change, etc.).',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'intake',
    workflow_key: 'intake_workflow',
    step_id: 'log_request',
    task_id: 'identify_required_forms',
    task_name: 'Identify Required Forms',
    task_description: 'Determine which forms and documents are needed for this request.',
    task_order: 30,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // Paperwork
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'paperwork',
    workflow_key: 'paperwork_workflow',
    step_id: 'generate_paperwork',
    task_id: 'generate_dex_kit',
    task_name: 'Generate DEX Form Kit',
    task_description: 'Generate the required form kit via DEX pipeline.',
    task_order: 10,
    is_required: true,
    is_system_check: true,
    check_type: 'MANUAL',
    check_config: JSON.stringify({ system_check: 'DEX_KIT_GENERATE' }),
    default_owner: 'SYSTEM',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'paperwork',
    workflow_key: 'paperwork_workflow',
    step_id: 'generate_paperwork',
    task_id: 'review_generated_forms',
    task_name: 'Review Generated Forms',
    task_description: 'Review the DEX-generated forms for accuracy.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'paperwork',
    workflow_key: 'paperwork_workflow',
    step_id: 'generate_paperwork',
    task_id: 'prepare_client_package',
    task_name: 'Prepare Client Package',
    task_description: 'Assemble the form package for client review and signature.',
    task_order: 30,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // Client Signature
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'client_signature',
    workflow_key: 'client_signature_workflow',
    step_id: 'collect_signature',
    task_id: 'send_for_signature',
    task_name: 'Send for Client Signature',
    task_description: 'Send the form package to the client for signature.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'client_signature',
    workflow_key: 'client_signature_workflow',
    step_id: 'collect_signature',
    task_id: 'confirm_signature_received',
    task_name: 'Confirm Signature Received',
    task_description: 'Confirm that signed documents have been received from the client.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // Carrier Processing
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    workflow_key: 'carrier_processing_workflow',
    step_id: 'submit_to_carrier',
    task_id: 'submit_signed_forms',
    task_name: 'Submit Signed Forms to Carrier',
    task_description: 'Submit the signed paperwork to the carrier for processing.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    workflow_key: 'carrier_processing_workflow',
    step_id: 'track_processing',
    task_id: 'monitor_carrier_status',
    task_name: 'Monitor Carrier Processing Status',
    task_description: 'Track the carrier processing status until completion.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'REACTIVE_RETIREMENT',
    stage_id: 'carrier_processing',
    workflow_key: 'carrier_processing_workflow',
    step_id: 'track_processing',
    task_id: 'confirm_completion',
    task_name: 'Confirm Request Completion',
    task_description: 'Confirm the service request has been fully processed.',
    task_order: 30,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
]

// ============================================================================
// Export
// ============================================================================

export const REACTIVE_RETIREMENT_CONFIG = {
  pipeline,
  stages,
  workflows,
  steps,
  tasks,
} as const
