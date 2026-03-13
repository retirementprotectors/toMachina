/**
 * NBX_MEDICARE_MEDSUP pipeline config — Medicare Supplement / Ancillary.
 * 4 stages, 4 workflows, 4 steps, 11 task templates, no gated stages.
 * Simple pipeline: carrier-specific portal enrollment flow.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const NBX_MEDICARE_MEDSUP_CONFIG: {
    pipeline: FlowPipelineDef;
    stages: FlowStageDef[];
    workflows: FlowWorkflowDef[];
    steps: FlowStepDef[];
    tasks: FlowTaskTemplateDef[];
};
