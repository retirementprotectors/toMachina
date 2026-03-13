/**
 * REACTIVE_RETIREMENT pipeline config.
 * 4 stages: Intake -> Paperwork -> Client Signature -> Carrier Processing
 * Simple reactive service pipeline with DEX integration at Paperwork stage.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const REACTIVE_RETIREMENT_CONFIG: {
    readonly pipeline: FlowPipelineDef;
    readonly stages: FlowStageDef[];
    readonly workflows: FlowWorkflowDef[];
    readonly steps: FlowStepDef[];
    readonly tasks: FlowTaskTemplateDef[];
};
