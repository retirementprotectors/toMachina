/**
 * REACTIVE_MEDICARE pipeline config.
 * 6 stages: Request Intake -> Client Comm -> RPI Work -> Provider Comm -> Carrier Comm -> Confirmation
 * More complex than Retirement reactive — tracks communication timestamps per party.
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const REACTIVE_MEDICARE_CONFIG: {
    readonly pipeline: FlowPipelineDef;
    readonly stages: FlowStageDef[];
    readonly workflows: FlowWorkflowDef[];
    readonly steps: FlowStepDef[];
    readonly tasks: FlowTaskTemplateDef[];
};
