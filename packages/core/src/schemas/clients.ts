import * as v from 'valibot'
export const ClientSchema = v.objectWithRest({ id: v.string(), client_id: v.string(), first_name: v.string(), last_name: v.string(), status: v.string(), email: v.string(), created_at: v.string(), updated_at: v.string() }, v.unknown())
export const AccountSchema = v.objectWithRest({ id: v.string(), account_type: v.string(), carrier: v.optional(v.string()), carrier_name: v.optional(v.string()), status: v.string(), created_at: v.string(), updated_at: v.string() }, v.unknown())
export const AccessItemSchema = v.objectWithRest({ id: v.string(), service_name: v.string(), category: v.string(), status: v.string(), auth_status: v.string(), type: v.string() }, v.unknown())
