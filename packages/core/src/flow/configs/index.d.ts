/**
 * Pipeline configs barrel export.
 * Re-exports ALL 13 pipeline configs (Builder 01's NBX + Builder 02's Sales/Prospect/Reactive).
 */
export { NBX_SECURITIES_CONFIG } from './nbx-securities';
export { NBX_LIFE_CONFIG } from './nbx-life';
export { NBX_ANNUITY_CONFIG } from './nbx-annuity';
export { NBX_MEDICARE_MEDSUP_CONFIG } from './nbx-medicare-medsup';
export { NBX_MEDICARE_MAPD_CONFIG } from './nbx-medicare-mapd';
export { SALES_RETIREMENT_CONFIG } from './sales-retirement';
export { SALES_MEDICARE_CONFIG } from './sales-medicare';
export { SALES_LEGACY_CONFIG } from './sales-legacy';
export { PROSPECT_RETIREMENT_CONFIG } from './prospect-retirement';
export { PROSPECT_MEDICARE_CONFIG } from './prospect-medicare';
export { PROSPECT_LEGACY_CONFIG } from './prospect-legacy';
export { REACTIVE_RETIREMENT_CONFIG } from './reactive-retirement';
export { REACTIVE_MEDICARE_CONFIG } from './reactive-medicare';
export declare const ALL_PIPELINE_CONFIGS: {
    readonly NBX_SECURITIES: {
        pipeline: import("..").FlowPipelineDef;
        stages: import("..").FlowStageDef[];
        workflows: import("..").FlowWorkflowDef[];
        steps: import("..").FlowStepDef[];
        tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly NBX_LIFE: {
        pipeline: import("..").FlowPipelineDef;
        stages: import("..").FlowStageDef[];
        workflows: import("..").FlowWorkflowDef[];
        steps: import("..").FlowStepDef[];
        tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly NBX_ANNUITY: {
        pipeline: import("..").FlowPipelineDef;
        stages: import("..").FlowStageDef[];
        workflows: import("..").FlowWorkflowDef[];
        steps: import("..").FlowStepDef[];
        tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly NBX_MEDICARE_MEDSUP: {
        pipeline: import("..").FlowPipelineDef;
        stages: import("..").FlowStageDef[];
        workflows: import("..").FlowWorkflowDef[];
        steps: import("..").FlowStepDef[];
        tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly NBX_MEDICARE_MAPD: {
        pipeline: import("..").FlowPipelineDef;
        stages: import("..").FlowStageDef[];
        workflows: import("..").FlowWorkflowDef[];
        steps: import("..").FlowStepDef[];
        tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly SALES_RETIREMENT: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly SALES_MEDICARE: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly SALES_LEGACY: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly PROSPECT_RETIREMENT: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly PROSPECT_MEDICARE: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly PROSPECT_LEGACY: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly REACTIVE_RETIREMENT: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
    readonly REACTIVE_MEDICARE: {
        readonly pipeline: import("..").FlowPipelineDef;
        readonly stages: import("..").FlowStageDef[];
        readonly workflows: import("..").FlowWorkflowDef[];
        readonly steps: import("..").FlowStepDef[];
        readonly tasks: import("..").FlowTaskTemplateDef[];
    };
};
export type PipelineKey = keyof typeof ALL_PIPELINE_CONFIGS;
