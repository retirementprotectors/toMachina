/**
 * SESSION_AGENT_WORKFLOW pipeline config
 * Terminal Session Agent Workflow — JDM's Builder/Auditor Protocol as a pipeline.
 * 6 stages: Scope → Discovery → Planning → Building → Audit → Walk-Through
 * 4 agent roles: Discovery Agent, Plan Agent, Builder Agent, Audit Agent
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
  pipeline_key: 'SESSION_AGENT_WORKFLOW',
  pipeline_name: 'Terminal Session Agent Workflow',
  description:
    'Claude Code session workflow. 6 stages from Scope through Walk-Through, orchestrating Discovery, Plan, Builder, and Audit agents.',
  portal: 'RIIMO',
  domain: 'ENGINEERING',
  default_view: 'board',
  icon: 'smart_toy',
  status: 'active',
  created_at: '2026-03-14T00:00:00.000Z',
  updated_at: '2026-03-14T00:00:00.000Z',
}

// ============================================================================
// Stages
// ============================================================================

const stages: FlowStageDef[] = [
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'scope',
    stage_name: 'Scope',
    stage_description: '/RENAME — scope and name the feature or session.',
    stage_order: 10,
    stage_color: 'purple',
    gate_enforced: true,
    has_workflow: true,
    ghl_stage_id: '',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'discovery',
    stage_name: 'Discovery',
    stage_description:
      'Discovery Agent inventories all tasks by module and produces the Discovery Inventory.',
    stage_order: 20,
    stage_color: 'blue',
    gate_enforced: true,
    has_workflow: true,
    ghl_stage_id: '',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    stage_name: 'Planning',
    stage_description:
      'Plan Agent enters Plan Mode, audits plan vs inventory findings, and produces the Plan Document.',
    stage_order: 30,
    stage_color: 'orange',
    gate_enforced: true,
    has_workflow: true,
    ghl_stage_id: '',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'building',
    stage_name: 'Building',
    stage_description:
      'Builder Agent executes the approved plan and produces the Builder Report.',
    stage_order: 40,
    stage_color: 'yellow',
    gate_enforced: true,
    has_workflow: true,
    ghl_stage_id: '',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    stage_name: 'Audit',
    stage_description:
      'Audit Agent verifies back-end and front-end plan adherence, reports findings, and triggers deploy.',
    stage_order: 50,
    stage_color: 'green',
    gate_enforced: true,
    has_workflow: true,
    ghl_stage_id: '',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'walkthrough',
    stage_name: 'Walk-Through',
    stage_description: 'JDM walks through the completed feature for final sign-off.',
    stage_order: 60,
    stage_color: 'red',
    gate_enforced: false,
    has_workflow: true,
    ghl_stage_id: '',
    status: 'active',
  },
]

// ============================================================================
// Workflows (one per stage)
// ============================================================================

const workflows: FlowWorkflowDef[] = [
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'scope',
    workflow_key: 'scope_workflow',
    workflow_name: 'Scope Workflow',
    workflow_description: 'Scope and name the feature or session.',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'discovery',
    workflow_key: 'discovery_workflow',
    workflow_name: 'Discovery Workflow',
    workflow_description: 'Inventory tasks by module and produce discovery inventory.',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    workflow_key: 'planning_workflow',
    workflow_name: 'Planning Workflow',
    workflow_description: 'Create and validate plan against discovery findings.',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'building',
    workflow_key: 'building_workflow',
    workflow_name: 'Building Workflow',
    workflow_description: 'Execute the approved plan via builder agents.',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    workflow_name: 'Audit Workflow',
    workflow_description: 'Verify adherence to plan, report findings, and deploy.',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'walkthrough',
    workflow_key: 'walkthrough_workflow',
    workflow_name: 'Walk-Through Workflow',
    workflow_description: 'JDM final review and sign-off.',
    status: 'active',
  },
]

// ============================================================================
// Steps
// ============================================================================

const steps: FlowStepDef[] = [
  // --- Scope ---
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'scope',
    workflow_key: 'scope_workflow',
    step_id: 'rename',
    step_name: 'Rename & Scope',
    step_description: 'Execute /RENAME to scope and name the feature.',
    step_order: 10,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },

  // --- Discovery ---
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'discovery',
    workflow_key: 'discovery_workflow',
    step_id: 'inventory',
    step_name: 'Module Inventory',
    step_description: 'Inventory all tasks by module across the codebase.',
    step_order: 10,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },

  // --- Planning ---
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    workflow_key: 'planning_workflow',
    step_id: 'plan_creation',
    step_name: 'Plan Creation',
    step_description: 'Enter Plan Mode and draft the implementation plan.',
    step_order: 10,
    gate_enforced: false,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    workflow_key: 'planning_workflow',
    step_id: 'plan_validation',
    step_name: 'Plan Validation',
    step_description: 'Audit plan against discovery inventory findings.',
    step_order: 20,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },

  // --- Building ---
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'building',
    workflow_key: 'building_workflow',
    step_id: 'execution',
    step_name: 'Plan Execution',
    step_description: 'Builder agents execute the approved plan.',
    step_order: 10,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },

  // --- Audit ---
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'backend_audit',
    step_name: 'Back-End Audit',
    step_description: 'Audit back-end code for plan adherence.',
    step_order: 10,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'frontend_audit',
    step_name: 'Front-End Audit',
    step_description: 'Audit front-end code for plan adherence.',
    step_order: 20,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'deploy',
    step_name: 'Report & Deploy',
    step_description: 'Report findings and execute #SendIt deploy.',
    step_order: 30,
    gate_enforced: true,
    execution_type: 'manual',
    status: 'active',
  },

  // --- Walk-Through ---
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'walkthrough',
    workflow_key: 'walkthrough_workflow',
    step_id: 'jdm_review',
    step_name: 'JDM Walk-Through',
    step_description: 'JDM walks through the completed feature for final approval.',
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
  // ---- Scope Stage (Purple) ----
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'scope',
    workflow_key: 'scope_workflow',
    step_id: 'rename',
    task_id: 'execute_rename',
    task_name: '/RENAME — Scope the Feature',
    task_description:
      'Execute /RENAME to define the session name, feature scope, and affected modules.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'JDM',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // ---- Discovery Stage (Blue) — Discovery Agent ----
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'discovery',
    workflow_key: 'discovery_workflow',
    step_id: 'inventory',
    task_id: 'inventory_tasks_by_module',
    task_name: 'Inventory All Tasks by Module',
    task_description:
      'Discovery Agent inventories the codebase — all tasks, components, routes, and modules relevant to the scoped feature.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'DISCOVERY_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'discovery',
    workflow_key: 'discovery_workflow',
    step_id: 'inventory',
    task_id: 'produce_discovery_inventory',
    task_name: 'Produce Discovery Inventory',
    task_description:
      'Discovery Agent produces the Discovery Inventory document — structured findings for the Plan Agent to consume.',
    task_order: 20,
    is_required: true,
    is_system_check: true,
    check_type: 'MANUAL',
    default_owner: 'DISCOVERY_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // ---- Planning Stage (Orange) — Plan Agent ----
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    workflow_key: 'planning_workflow',
    step_id: 'plan_creation',
    task_id: 'enter_plan_mode',
    task_name: '#LetsPlanIt! — Enter Plan Mode',
    task_description:
      'Plan Agent enters Plan Mode with HIGH thinking level for architecture and planning.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'PLAN_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    workflow_key: 'planning_workflow',
    step_id: 'plan_validation',
    task_id: 'audit_plan_vs_inventory',
    task_name: 'Audit Plan vs Inventory Findings',
    task_description:
      'Plan Agent audits the draft plan against Discovery Inventory findings to ensure completeness and accuracy.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'PLAN_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'planning',
    workflow_key: 'planning_workflow',
    step_id: 'plan_validation',
    task_id: 'produce_plan_document',
    task_name: 'Produce Plan Document',
    task_description:
      'Plan Agent produces the final Plan Document — approved implementation blueprint for the Builder Agent.',
    task_order: 30,
    is_required: true,
    is_system_check: true,
    check_type: 'MANUAL',
    default_owner: 'PLAN_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // ---- Building Stage (Yellow) — Builder Agent ----
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'building',
    workflow_key: 'building_workflow',
    step_id: 'execution',
    task_id: 'enter_build_mode',
    task_name: '#LetsBuildIt! — Execute Plan',
    task_description:
      'Builder Agent exits Plan Mode, switches to MEDIUM thinking, and executes the approved plan.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'BUILDER_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'building',
    workflow_key: 'building_workflow',
    step_id: 'execution',
    task_id: 'produce_builder_report',
    task_name: 'Produce Builder Report',
    task_description:
      'Builder Agent produces the Builder Report — what was built, what changed, lines shipped, any deviations from plan.',
    task_order: 20,
    is_required: true,
    is_system_check: true,
    check_type: 'MANUAL',
    default_owner: 'BUILDER_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // ---- Audit Stage (Green) — Audit Agent ----
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'backend_audit',
    task_id: 'audit_backend_adherence',
    task_name: 'Audit Back-End for Plan Adherence',
    task_description:
      'Audit Agent reviews all back-end changes (API routes, services, core logic) for adherence to the approved plan.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'AUDIT_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'frontend_audit',
    task_id: 'audit_frontend_adherence',
    task_name: 'Audit Front-End for Plan Adherence',
    task_description:
      'Audit Agent reviews all front-end changes (components, pages, styles) for adherence to the approved plan.',
    task_order: 20,
    is_required: true,
    is_system_check: false,
    default_owner: 'AUDIT_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'deploy',
    task_id: 'report_findings',
    task_name: 'Report Findings',
    task_description:
      'Audit Agent reports back with consolidated findings from back-end and front-end audits.',
    task_order: 30,
    is_required: true,
    is_system_check: false,
    default_owner: 'AUDIT_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'deploy',
    task_id: 'execute_sendit',
    task_name: '#SendIt! — Deploy to Production',
    task_description:
      'Execute the 6-step deploy protocol: verify CI passes, push to main, confirm Firebase App Hosting deploys.',
    task_order: 40,
    is_required: true,
    is_system_check: false,
    default_owner: 'AUDIT_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'audit',
    workflow_key: 'audit_workflow',
    step_id: 'deploy',
    task_id: 'produce_audit_report',
    task_name: 'Produce Audit Report',
    task_description:
      'Audit Agent produces the final Audit Report — compliance status, deviations, deploy confirmation.',
    task_order: 50,
    is_required: true,
    is_system_check: true,
    check_type: 'MANUAL',
    default_owner: 'AUDIT_AGENT',
    role_applicability: 'GENERAL',
    status: 'active',
  },

  // ---- Walk-Through Stage (Red) — JDM ----
  {
    pipeline_key: 'SESSION_AGENT_WORKFLOW',
    stage_id: 'walkthrough',
    workflow_key: 'walkthrough_workflow',
    step_id: 'jdm_review',
    task_id: 'jdm_walkthrough',
    task_name: 'JDM Walk-Through',
    task_description:
      'JDM walks through the completed feature in production. Final sign-off or punch list.',
    task_order: 10,
    is_required: true,
    is_system_check: false,
    default_owner: 'JDM',
    role_applicability: 'GENERAL',
    status: 'active',
  },
]

// ============================================================================
// Export
// ============================================================================

export const SESSION_AGENT_WORKFLOW_CONFIG = {
  pipeline,
  stages,
  workflows,
  steps,
  tasks,
} as const
