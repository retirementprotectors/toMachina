import * as v from 'valibot'
export const PaginatedMetaSchema = v.object({ count: v.number(), total: v.optional(v.number()), hasMore: v.optional(v.boolean()), nextCursor: v.optional(v.nullable(v.string())) })
export function successEnvelope<T>(dataSchema: v.GenericSchema<T>) { return v.object({ success: v.literal(true), data: dataSchema, pagination: v.optional(PaginatedMetaSchema) }) }
export function arrayEnvelope<T>(itemSchema: v.GenericSchema<T>) { return v.object({ success: v.literal(true), data: v.array(itemSchema), pagination: v.optional(PaginatedMetaSchema) }) }
