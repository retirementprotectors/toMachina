/**
 * DELIVERY pipeline config.
 * 4 stages: Pending Receipt -> Awaiting Appointment -> Needs Mailed -> Awaiting PDR
 * Post-sale pipeline for policy delivery lifecycle.
 *
 * Sprint 012 — TRK-S12-005
 * Spec by: Nikki Gray
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
  pipeline_key: 'DELIVERY',
  pipeline_name: 'Delivery',
  description: 'Post-sale policy delivery lifecycle. Tracks from carrier issuance through signed delivery receipt.',
  portal: 'PRODASHX',
  domain: 'SERVICE',
  default_view: 'kanban',
  icon: 'local_shipping',
  status: 'active',
  created_at: '2026-04-03T00:00:00.000Z',
  updated_at: '2026-04-03T00:00:00.000Z',
}

// ============================================================================
// Stages
// ============================================================================

const stages: FlowStageDef[] = [
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'pending_receipt',
    stage_name: 'Pending Receipt',
    stage_description: 'Policy issued by carrier. Waiting for physical policy to arrive at RPI.',
    stage_order: 10,
    stage_color: 'blue',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_appointment',
    stage_name: 'Awaiting Appointment',
    stage_description: 'Policy in hand. Schedule delivery meeting with client.',
    stage_order: 20,
    stage_color: 'yellow',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'needs_mailed',
    stage_name: 'Needs Mailed',
    stage_description: 'Client chose mail delivery. Package needs to be assembled and sent.',
    stage_order: 30,
    stage_color: 'orange',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_pdr',
    stage_name: 'Awaiting PDR',
    stage_description: 'Policy delivered to client. Waiting for signed Policy Delivery Receipt.',
    stage_order: 40,
    stage_color: 'green',
    gate_enforced: false,
    has_workflow: true,
    status: 'active',
  },
]

// ============================================================================
// Workflows
// ============================================================================

const workflows: FlowWorkflowDef[] = [
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'pending_receipt',
    workflow_key: 'pending_receipt_workflow',
    workflow_name: 'Pending Receipt Workflow',
    workflow_description: 'Track policy arrival from carrier.',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_appointment',
    workflow_key: 'awaiting_appointment_workflow',
    workflow_name: 'Awaiting Appointment Workflow',
    workflow_description: 'Schedule and confirm delivery appointment.',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'needs_mailed',
    workflow_key: 'needs_mailed_workflow',
    workflow_name: 'Needs Mailed Workflow',
    workflow_description: 'Assemble and ship delivery package.',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_pdr',
    workflow_key: 'awaiting_pdr_workflow',
    workflow_name: 'Awaiting PDR Workflow',
    workflow_description: 'Collect signed Policy Delivery Receipt.',
    status: 'active',
  },
]

// ============================================================================
// Steps
// ============================================================================

const steps: FlowStepDef[] = [
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'pending_receipt',
    workflow_key: 'pending_receipt_workflow',
    step_id: 'confirm_policy_arrival',
    step_name: 'Confirm Policy Arrival',
    step_description: 'Verify physical policy has been received at RPI office.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_appointment',
    workflow_key: 'awaiting_appointment_workflow',
    step_id: 'schedule_delivery',
    step_name: 'Schedule Delivery Meeting',
    step_description: 'Contact client and schedule delivery appointment.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'needs_mailed',
    workflow_key: 'needs_mailed_workflow',
    step_id: 'prepare_package',
    step_name: 'Prepare Mail Package',
    step_description: 'Assemble delivery package with policy docs and PDR form.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'needs_mailed',
    workflow_key: 'needs_mailed_workflow',
    step_id: 'ship_package',
    step_name: 'Ship Package',
    step_description: 'Mail package and record tracking number.',
    step_order: 20,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_pdr',
    workflow_key: 'awaiting_pdr_workflow',
    step_id: 'collect_pdr',
    step_name: 'Collect PDR',
    step_description: 'Collect signed Policy Delivery Receipt from client.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
]

// ============================================================================
// Tasks
// ============================================================================

const tasks: FlowTaskTemplateDef[] = [
  // Pending Receipt
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'pending_receipt',
    workflow_key: 'pending_receipt_workflow',
    step_id: 'confirm_policy_arrival',
    task_id: 'check_mail_for_policy',
    task_name: 'Check Mail for Policy',
    task_description: 'Check incoming mail for physical policy document from carrier.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'pending_receipt',
    workflow_key: 'pending_receipt_workflow',
    step_id: 'confirm_policy_arrival',
    task_id: 'log_policy_received',
    task_name: 'Log Policy Received',
    task_description: 'Record that the physical policy has been received. Note any discrepancies.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // Awaiting Appointment
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_appointment',
    workflow_key: 'awaiting_appointment_workflow',
    step_id: 'schedule_delivery',
    task_id: 'contact_client',
    task_name: 'Contact Client to Schedule',
    task_description: 'Call or email client to schedule delivery meeting.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_appointment',
    workflow_key: 'awaiting_appointment_workflow',
    step_id: 'schedule_delivery',
    task_id: 'confirm_appointment',
    task_name: 'Confirm Appointment Scheduled',
    task_description: 'Confirm delivery appointment date/time with client.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // Needs Mailed
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'needs_mailed',
    workflow_key: 'needs_mailed_workflow',
    step_id: 'prepare_package',
    task_id: 'assemble_delivery_kit',
    task_name: 'Assemble Delivery Kit',
    task_description: 'Assemble policy, PDR form, and any supplemental documents into delivery package.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'needs_mailed',
    workflow_key: 'needs_mailed_workflow',
    step_id: 'ship_package',
    task_id: 'mail_package',
    task_name: 'Mail Package',
    task_description: 'Send delivery package via tracked mail. Record tracking number.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // Awaiting PDR
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_pdr',
    workflow_key: 'awaiting_pdr_workflow',
    step_id: 'collect_pdr',
    task_id: 'request_signed_pdr',
    task_name: 'Request Signed PDR',
    task_description: 'Request the signed Policy Delivery Receipt from client.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'SPC',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'DELIVERY',
    stage_id: 'awaiting_pdr',
    workflow_key: 'awaiting_pdr_workflow',
    step_id: 'collect_pdr',
    task_id: 'file_signed_pdr',
    task_name: 'File Signed PDR',
    task_description: 'Upload signed PDR to ACF and mark delivery complete.',
    task_order: 20,
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

export const DELIVERY_CONFIG = {
  pipeline,
  stages,
  workflows,
  steps,
  tasks,
} as const
