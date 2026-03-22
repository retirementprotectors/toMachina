import * as v from 'valibot'
export const TerritorySchema = v.objectWithRest({ id: v.string(), territory_id: v.string(), territory_name: v.string(), state: v.string(), status: v.string() }, v.unknown())
export const SpecialistConfigSchema = v.objectWithRest({ id: v.string(), specialist_name: v.string(), territory_id: v.string(), status: v.string() }, v.unknown())
export const ACFStatusSchema = v.object({ exists: v.boolean(), folder_id: v.nullable(v.string()), folder_url: v.nullable(v.string()), complete: v.boolean(), subfolder_count: v.number(), document_count: v.number(), ai3_present: v.boolean(), last_updated: v.nullable(v.string()) })
export const ACFConfigSchema = v.objectWithRest({ template_folder_id: v.string(), subfolders: v.array(v.string()), naming_pattern: v.string(), default_subfolder: v.string() }, v.unknown())
