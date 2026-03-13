/**
 * NBX_SECURITIES pipeline config — Securities & Advisory (Gradient).
 * Ported from archive/RAPID_FLOW/FLOW_DevTools.gs _seedNBXSecurities().
 * 7 stages, 7 workflows, 17 steps, 40 task templates, 3 gated stages.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const NBX_SECURITIES_CONFIG: {
    pipeline: FlowPipelineDef;
    stages: FlowStageDef[];
    workflows: FlowWorkflowDef[];
    steps: FlowStepDef[];
    tasks: FlowTaskTemplateDef[];
};
