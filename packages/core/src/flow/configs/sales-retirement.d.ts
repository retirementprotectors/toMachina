/**
 * SALES_RETIREMENT pipeline config — The Big One.
 * Primary B2C sales pipeline with 5 color-coded stages.
 * Yellow stage has dynamic casework tasks by product line (role_applicability).
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const SALES_RETIREMENT_CONFIG: {
    readonly pipeline: FlowPipelineDef;
    readonly stages: FlowStageDef[];
    readonly workflows: FlowWorkflowDef[];
    readonly steps: FlowStepDef[];
    readonly tasks: FlowTaskTemplateDef[];
};
