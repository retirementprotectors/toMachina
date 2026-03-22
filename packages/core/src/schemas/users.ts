import * as v from 'valibot'
export const UserSchema = v.objectWithRest({ id: v.string(), email: v.string(), first_name: v.string(), last_name: v.string(), role: v.string(), level: v.number(), division: v.string(), status: v.string() }, v.unknown())
