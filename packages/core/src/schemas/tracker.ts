import * as v from 'valibot'
export const TrackerItemSchema = v.objectWithRest({ id: v.string(), item_id: v.string(), title: v.string(), status: v.string(), created_at: v.string(), updated_at: v.string() }, v.unknown())
export const SprintSchema = v.objectWithRest({ id: v.string(), name: v.string(), description: v.string(), item_ids: v.array(v.string()), status: v.string(), created_at: v.string(), updated_at: v.string() }, v.unknown())
export const AuditRoundDataSchema = v.object({ current_round: v.number(), total_items: v.number(), pending: v.array(TrackerItemSchema), pending_count: v.number(), passed: v.array(TrackerItemSchema), passed_count: v.number(), failed: v.array(TrackerItemSchema), failed_count: v.number() })
export const TrackerBulkUpdateSchema = v.object({ updated: v.number() })
