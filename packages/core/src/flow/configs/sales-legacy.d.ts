/**
 * SALES_LEGACY pipeline config.
 * 6 stages — Aprille's "It's Time Series."
 * Each stage has a specific team owner (Team Caroline, Team Jennifer, Mo Dadkah).
 */
import type { FlowPipelineDef, FlowStageDef, FlowWorkflowDef, FlowStepDef, FlowTaskTemplateDef } from '../types';
export declare const SALES_LEGACY_CONFIG: {
    readonly pipeline: FlowPipelineDef;
    readonly stages: FlowStageDef[];
    readonly workflows: FlowWorkflowDef[];
    readonly steps: FlowStepDef[];
    readonly tasks: FlowTaskTemplateDef[];
};
