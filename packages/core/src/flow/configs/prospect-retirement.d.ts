/**
 * PROSPECT_RETIREMENT pipeline config.
 * 7 stages: New Lead -> Engaged -> Connect 1/2/3 -> Outcome Yes/No
 * Simple Kanban — no gates, minimal tasks.
 * On "Outcome Yes" -> handoff to SALES_RETIREMENT.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const PROSPECT_RETIREMENT_CONFIG: {
    readonly pipeline: FlowPipelineDef;
    readonly stages: FlowStageDef[];
    readonly workflows: FlowWorkflowDef[];
    readonly steps: FlowStepDef[];
    readonly tasks: FlowTaskTemplateDef[];
};
