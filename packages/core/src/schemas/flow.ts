import * as v from 'valibot'
export const FlowPipelineSchema = v.objectWithRest({ id: v.string(), pipeline_key: v.optional(v.string()), pipeline_name: v.optional(v.string()), status: v.string() }, v.unknown())
export const FlowStageSchema = v.objectWithRest({ id: v.string(), stage_id: v.optional(v.string()), stage_name: v.optional(v.string()), stage_order: v.optional(v.number()) }, v.unknown())
export const FlowInstanceSchema = v.objectWithRest({ id: v.string(), pipeline_key: v.string(), current_stage: v.string(), entity_id: v.string(), entity_name: v.string(), assigned_to: v.string(), stage_status: v.string() }, v.unknown())
export const FlowInstanceDetailSchema = v.object({ instance: FlowInstanceSchema, tasks: v.array(v.objectWithRest({ id: v.string(), task_name: v.string(), status: v.string(), is_required: v.boolean() }, v.unknown())), activity: v.array(v.objectWithRest({ id: v.string(), action: v.string(), performed_by: v.string(), performed_at: v.string() }, v.unknown())), stages: v.array(FlowStageSchema) })
export const FlowAdminPipelineDataSchema = v.object({ pipeline: FlowPipelineSchema })
