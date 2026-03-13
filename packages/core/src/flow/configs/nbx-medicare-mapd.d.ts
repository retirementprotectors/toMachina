/**
 * NBX_MEDICARE_MAPD pipeline config — MAPD / PDP Enrollment (SunFire).
 * 4 stages, 4 workflows, 4 steps, 11 task templates, no gated stages.
 * Simple pipeline: SunFire platform enrollment flow.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const NBX_MEDICARE_MAPD_CONFIG: {
    pipeline: FlowPipelineDef;
    stages: FlowStageDef[];
    workflows: FlowWorkflowDef[];
    steps: FlowStepDef[];
    tasks: FlowTaskTemplateDef[];
};
