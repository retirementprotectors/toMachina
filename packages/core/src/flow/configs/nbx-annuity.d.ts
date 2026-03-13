/**
 * NBX_ANNUITY pipeline config — Annuity New Business.
 * 7 stages, 7 workflows, 17 steps, 42 task templates, 2 gated stages.
 * Signal -> Gradient rename applied. BI_UNIQUE system check at Suitability.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const NBX_ANNUITY_CONFIG: {
    pipeline: FlowPipelineDef;
    stages: FlowStageDef[];
    workflows: FlowWorkflowDef[];
    steps: FlowStepDef[];
    tasks: FlowTaskTemplateDef[];
};
