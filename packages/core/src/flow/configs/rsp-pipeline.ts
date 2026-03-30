/**
 * RSP_PIPELINE config — TRK-RSP-001
 *
 * The Retirement Services Pipeline. 5 color-coded stages:
 * Orange (Discovery) → Blue (Analysis) → Yellow (Presentation) → Green (Implementation) → Red (Service)
 *
 * Three A+R meeting transitions: Discovery→Analysis, Analysis→Presentation, Presentation→Implementation
 */

import type {
  FlowPipelineDef,
  FlowStageDef,
} from '../types'

export const pipeline: FlowPipelineDef = {
  pipeline_key: 'RSP_PIPELINE',
  pipeline_name: 'RSP — Retirement Services Pipeline',
  description: 'Full-cycle retirement services pipeline. Orange Discovery through Red Service handoff. Three A+R meeting transitions.',
  portal: 'PRODASHX',
  domain: 'RETIREMENT',
  default_view: 'kanban',
  icon: 'account_balance',
  status: 'active',
  created_at: '2026-03-29T00:00:00.000Z',
  updated_at: '2026-03-29T00:00:00.000Z',
}

export const stages: FlowStageDef[] = [
  {
    pipeline_key: 'RSP_PIPELINE',
    stage_id: 'orange_discovery',
    stage_name: 'Orange — Discovery',
    stage_description: 'Initial discovery phase. Collect client data, accounts, authorizations. Virtual or F2F.',
    stage_order: 10,
    stage_color: '#f97316',
    gate_enforced: true,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'RSP_PIPELINE',
    stage_id: 'blue_analysis',
    stage_name: 'Blue — Analysis',
    stage_description: 'A+R Meeting 1 complete. Analysis phase. Blue Gate: all reports ordered + auth forms signed.',
    stage_order: 20,
    stage_color: '#3b82f6',
    gate_enforced: true,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'RSP_PIPELINE',
    stage_id: 'yellow_presentation',
    stage_name: 'Yellow — Presentation',
    stage_description: 'A+R Meeting 2 complete. Presentation prep. Yellow Gate: illustrations run, recommendations prepared.',
    stage_order: 30,
    stage_color: '#eab308',
    gate_enforced: true,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'RSP_PIPELINE',
    stage_id: 'green_implementation',
    stage_name: 'Green — Implementation',
    stage_description: 'A+R Meeting 3 complete. Implementation phase. Applications submitted, transfers initiated.',
    stage_order: 40,
    stage_color: '#22c55e',
    gate_enforced: true,
    has_workflow: true,
    status: 'active',
  },
  {
    pipeline_key: 'RSP_PIPELINE',
    stage_id: 'red_service',
    stage_name: 'Red — Service',
    stage_description: 'Handoff to Service team. All implementations confirmed. Ongoing service relationship.',
    stage_order: 50,
    stage_color: '#ef4444',
    gate_enforced: false,
    has_workflow: false,
    status: 'active',
  },
]

export const RSP_PIPELINE_CONFIG = { pipeline, stages, workflows: [], steps: [], taskTemplates: [] }
