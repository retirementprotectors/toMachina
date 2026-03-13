/**
 * PROSPECT_LEGACY pipeline config.
 * 7 stages: New Lead -> Engaged -> Connect 1/2/3 -> Outcome Yes/No
 * Mirrors PROSPECT_RETIREMENT structure exactly.
 * On "Outcome Yes" -> handoff to SALES_LEGACY.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const PROSPECT_LEGACY_CONFIG: {
    readonly pipeline: FlowPipelineDef;
    readonly stages: FlowStageDef[];
    readonly workflows: FlowWorkflowDef[];
    readonly steps: FlowStepDef[];
    readonly tasks: FlowTaskTemplateDef[];
};
