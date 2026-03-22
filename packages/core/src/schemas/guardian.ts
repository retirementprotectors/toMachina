import * as v from 'valibot'
export const GuardianAuditReportSchema = v.object({ generated_at: v.string(), summary: v.object({ total_open_findings: v.number(), severity_breakdown: v.object({ critical: v.number(), high: v.number(), medium: v.number(), low: v.number() }), collections_affected: v.number(), collection_issue_counts: v.record(v.string(), v.number()) }), timeline: v.objectWithRest({}, v.unknown()) })
export const GuardianHealthSchema = v.object({ collections: v.record(v.string(), v.object({ doc_count: v.number(), field_coverage: v.record(v.string(), v.number()) })), structural: v.nullable(v.objectWithRest({}, v.unknown())) })
export const GuardianFindingSchema = v.objectWithRest({ id: v.string(), title: v.string(), severity: v.string(), status: v.string() }, v.unknown())
