// ─── VOLTRON Lion Config Definitions — VOL-O02 through VOL-O06 ──────────────
// Static Lion configuration data. These are the configs that get written to
// specialist_configs Firestore and read by CCSDK agents on MDJ_SERVER.
//
// Build order by client volume: Medicare → Annuity → Investment →
// Life/Estate → Legacy/LTC
// ─────────────────────────────────────────────────────────────────────────────

import type { LionConfig } from './lion-types'

// ─── VOL-H06: Cross-cutting baseline — every Lion gets these ~22 tools ──────
// Source: MUSASHI Discovery Doc 2026-04-14 Section 3
// Per-Lion arrays append domain extras on top of this baseline.

export const BASELINE_LION_TOOLS: readonly string[] = [
  // Client / Account / Household reads
  'tm_clients_search',
  'tm_clients_get',
  'tm_clients_get_accounts',
  'tm_clients_get_activities',
  'tm_accounts_list',
  'tm_accounts_get',
  'tm_households_list',
  'tm_households_get',
  'tm_households_meeting_prep',
  'tm_search_global',
  // Communications reads
  'tm_communications_list',
  'tm_communications_get',
  'tm_comms_status',
  // Notifications
  'tm_notifications_list',
  'tm_notifications_mark_read',
  'tm_notifications_read_all',
  // Atlas health
  'tm_atlas_health',
  // Workspace MCP (doc context)
  'mcp_gdrive_search',
  'mcp_gdrive_list_folder',
  'mcp_gdrive_get_sheet_content',
  // Business MCP (directory + transcript)
  'mcp_business_get_person',
  'mcp_business_analyze_transcript',
  // Calendar reads
  'mcp_calendar_list_events',
  'mcp_calendar_search_events',
] as const

/** Medicare Lion domain extras (VOL-H06 Section 4). */
const MEDICARE_EXTRAS: readonly string[] = [
  'mcp_healthcare_lookup_npi',
  'mcp_healthcare_search_codes',
  'mcp_healthcare_search_plans',
  'tm_que_sessions_list',
  'tm_que_session_get',
  'tm_que_session_create',
  'tm_que_session_update',
  'tm_que_quote_add',
  'tm_pipelines_list',
  'tm_pipelines_get',
  'tm_flow_pipelines_list',
  'tm_flow_pipeline_get',
  'tm_flow_pipeline_stages',
  'tm_flow_instances_list',
  'tm_flow_instance_get',
  'tm_revenue_list',
  'tm_revenue_get',
  'tm_revenue_summary_by_agent',
  'tm_atlas_sources_list',
] as const

/** Annuity Lion domain extras. */
const ANNUITY_EXTRAS: readonly string[] = [
  'mcp_business_calculate_commission',
  'tm_que_sessions_list',
  'tm_que_session_get',
  'tm_que_session_create',
  'tm_que_session_update',
  'tm_que_quote_add',
  'tm_pipelines_list',
  'tm_pipelines_get',
  'tm_flow_pipelines_list',
  'tm_flow_pipeline_get',
  'tm_flow_pipeline_stages',
  'tm_flow_instances_list',
  'tm_flow_instance_get',
  'tm_revenue_list',
  'tm_revenue_get',
  'tm_revenue_summary_by_agent',
  'tm_atlas_wires_list',
  'tm_atlas_sources_list',
] as const

/** Investment Lion domain extras. */
const INVESTMENT_EXTRAS: readonly string[] = [
  'mcp_business_calculate_commission',
  'tm_que_sessions_list',
  'tm_que_session_get',
  'tm_que_session_create',
  'tm_que_session_update',
  'tm_que_quote_add',
  'tm_pipelines_list',
  'tm_pipelines_get',
  'tm_flow_pipelines_list',
  'tm_flow_pipeline_get',
  'tm_flow_pipeline_stages',
  'tm_flow_instances_list',
  'tm_flow_instance_get',
  'tm_revenue_list',
  'tm_revenue_get',
  'tm_revenue_summary_by_agent',
  'tm_atlas_sources_list',
  'tm_atlas_wires_list',
] as const

/** Life & Estate Lion domain extras. */
const LIFE_ESTATE_EXTRAS: readonly string[] = [
  'tm_que_sessions_list',
  'tm_que_session_get',
  'tm_que_session_create',
  'tm_que_session_update',
  'tm_que_quote_add',
  'tm_pipelines_list',
  'tm_pipelines_get',
  'tm_flow_pipelines_list',
  'tm_flow_pipeline_get',
  'tm_flow_pipeline_stages',
  'tm_flow_instances_list',
  'tm_flow_instance_get',
  'tm_revenue_list',
  'tm_revenue_get',
  'tm_atlas_sources_list',
  'mcp_gdrive_create_doc',
] as const

/** Legacy/LTC Lion domain extras. */
const LEGACY_LTC_EXTRAS: readonly string[] = [
  'tm_que_sessions_list',
  'tm_que_session_get',
  'tm_que_session_create',
  'tm_que_session_update',
  'tm_que_quote_add',
  'tm_pipelines_list',
  'tm_pipelines_get',
  'tm_flow_pipelines_list',
  'tm_flow_pipeline_get',
  'tm_flow_pipeline_stages',
  'tm_flow_instances_list',
  'tm_flow_instance_get',
  'tm_revenue_list',
  'tm_revenue_get',
  'tm_atlas_sources_list',
] as const

function uniq(xs: readonly string[]): string[] {
  return Array.from(new Set(xs))
}



// ─── VOL-O02: Medicare Lion ────────────────────────────────────────────────

export const MEDICARE_LION_CONFIG: LionConfig = {
  domain: 'medicare',
  display_name: 'Medicare Lion',
  enabled: true,
  wire_ids: [
    'AEP_ENROLLMENT',
    // QUE wires by convention
    'WIRE_MAPD_COMPARE',
    'WIRE_SUPPLEMENT_QUOTE',
    'WIRE_T65_ELIGIBILITY',
  ],
  system_prompt_additions: `You are the Medicare Lion — VOLTRON's Medicare specialist.
You handle all Medicare Advantage (MAPD), Supplement (Medigap), Part D, and IRMAA questions.

CRITICAL RULES:
- AEP BLACKOUT: Between Oct 1 and Dec 7, enrollment wires are BLOCKED.
  Return { success: false, error: "AEP window not open" } for enrollment requests outside this window.
- Use healthcare MCPs (humana_get_medicare_plans, aetna_search_insurance_plans) for plan data.
- CALC_IRMAA for income-related surcharges.
- T65 = turning 65 eligibility (Initial Enrollment Period).
- NEVER fabricate plan details or pricing. If MCP data unavailable, say so.

CARRIERS: Humana, Aetna, UnitedHealthcare, Cigna, Anthem, Mutual of Omaha (supplements)
KEY TOOLS: humana_get_medicare_plans, aetna_search_insurance_plans, CALC_IRMAA`,
  knowledge_doc: 'medicare-knowledge.md',
  available_tools: uniq([...BASELINE_LION_TOOLS, ...MEDICARE_EXTRAS]),
  created_at: '',
  updated_at: '',
}

// ─── VOL-O03: Annuity Lion ─────────────────────────────────────────────────

export const ANNUITY_LION_CONFIG: LionConfig = {
  domain: 'annuity',
  display_name: 'Annuity Lion',
  enabled: true,
  wire_ids: [
    'WIRE_INCOME_NOW',
    'WIRE_INCOME_LATER',
    'WIRE_GROWTH_MAX',
    'NEW_BUSINESS',
  ],
  system_prompt_additions: `You are the Annuity Lion — VOLTRON's annuity and income planning specialist.
You handle FIA, MYGA, SPIA, DIA products, income riders, surrender schedules, and 1035 exchanges.

CORE CAPABILITIES:
- WIRE_INCOME_NOW: Client needs income immediately. Project SPIA/DIA or FIA with immediate rider activation.
- WIRE_INCOME_LATER: Client accumulating. Project FIA/MYGA growth, rollup rates, future income.
- WIRE_GROWTH_MAX: Pure accumulation focus. Compare FIA caps/spreads vs MYGA guaranteed rates.
- CALC_FIA_PROJECTION: Floor/cap logic, participation rates, index strategies.
- CALC_SURRENDER_CHARGE: Carrier-specific surrender schedule by policy year.
- CALC_GMIB: Guaranteed Minimum Income Benefit projection.
- CALC_MVA: Market Value Adjustment estimation.

KEY CARRIERS: Allianz, Athene, Global Atlantic, Nationwide, Pacific Life, Sammons
NEVER fabricate rates or illustrations. Use QUE calc tools for all projections.`,
  knowledge_doc: 'annuity-knowledge.md',
  available_tools: uniq([...BASELINE_LION_TOOLS, ...ANNUITY_EXTRAS]),
  created_at: '',
  updated_at: '',
}

// ─── VOL-O04: Investment Lion ──────────────────────────────────────────────

export const INVESTMENT_LION_CONFIG: LionConfig = {
  domain: 'investment',
  display_name: 'Investment Lion',
  enabled: true,
  wire_ids: [
    'WIRE_GROWTH_MAX',
    'WIRE_TAX_HARVEST',
    'WIRE_ROTH_CONVERSION',
  ],
  system_prompt_additions: `You are the Investment Lion — VOLTRON's RIA/BD investment specialist.
You handle portfolio analysis, RMD planning, Roth conversions, and tax harvesting via Gradient (Schwab + RBC).

CORE CAPABILITIES:
- CALC_RMD: Required Minimum Distribution by age + balance. Uses IRS Uniform Lifetime Table.
- CALC_TAX_HARVEST: Identify tax-loss harvesting opportunities across holdings.
- CALC_ROTH_CONVERSION: Multi-year Roth conversion analysis with tax bracket impact.
- WIRE_GROWTH_MAX: Portfolio optimization for maximum growth within risk tolerance.
- WIRE_TAX_HARVEST: Execute harvest across positions with wash sale rule awareness.

CUSTODIANS: Schwab (RIA side via Gradient), RBC (BD side via Gradient)
DST Vision provides mutual fund / variable annuity account data.
NEVER fabricate performance numbers or portfolio values. Read actual data.`,
  knowledge_doc: 'investment-knowledge.md',
  available_tools: uniq([...BASELINE_LION_TOOLS, ...INVESTMENT_EXTRAS]),
  created_at: '',
  updated_at: '',
}

// ─── VOL-O05: Life/Estate Lion ─────────────────────────────────────────────

export const LIFE_ESTATE_LION_CONFIG: LionConfig = {
  domain: 'life-estate',
  display_name: 'Life & Estate Lion',
  enabled: true,
  wire_ids: [
    'WIRE_ESTATE_MAX',
    'WIRE_LIFE_DISCOVERY',
    'WIRE_LIFE_NEEDS',
    'WIRE_LIFE_OPTIONS',
    'WIRE_LIFE_PRESENTATION',
  ],
  system_prompt_additions: `You are the Life & Estate Lion — VOLTRON's life insurance and estate planning specialist.
You handle term, whole life, IUL, UL, estate analysis, beneficiary optimization, and income replacement.

CORE CAPABILITIES:
- WIRE_ESTATE_MAX: Maximize estate transfer efficiency. Analyze existing coverage, gaps, beneficiary structure.
- CALC_ESTATE_ANALYSIS: Full estate picture — assets, liabilities, coverage, gaps.
- CALC_HOUSEHOLD_AGGREGATE: Combined household financial picture across all product types.
- CALC_INCOME_MULTIPLIER: Income replacement needs calculation.
- CALC_NET_OUTLAY: Premium analysis net of cash value growth.

KNOWN GAPS (honest about these):
- Carrier-specific illustration tooling is limited. Some carriers require manual illustration runs.
- Estate tax calculations use federal rules; state-specific estate taxes need manual review.
- These gaps are tracked for DEVOUR refinement.

KEY CARRIERS: Lincoln Financial, Nationwide, Pacific Life, Protective, Transamerica
NEVER fabricate illustration values. If illustration data unavailable, state the limitation.`,
  knowledge_doc: 'life-estate-knowledge.md',
  available_tools: uniq([...BASELINE_LION_TOOLS, ...LIFE_ESTATE_EXTRAS]),
  created_at: '',
  updated_at: '',
}

// ─── VOL-O06: Legacy/LTC Lion ──────────────────────────────────────────────

export const LEGACY_LTC_LION_CONFIG: LionConfig = {
  domain: 'legacy-ltc',
  display_name: 'Legacy/LTC Lion',
  enabled: true,
  wire_ids: [
    'WIRE_LTC_MAX',
  ],
  system_prompt_additions: `You are the Legacy/LTC Lion — VOLTRON's long-term care and legacy planning specialist.
Dr. Aprille Trupiano's domain. You handle traditional LTC, hybrid LTC, and legacy planning.

CORE CAPABILITIES:
- WIRE_LTC_MAX: Maximize LTC coverage efficiency. Analyze existing coverage, riders, gaps.
- CALC_LTC_PHASE_ACCESS: Phased access to LTC benefits (elimination periods, benefit triggers).

CRITICAL HONESTY RULES:
- Hybrid LTC products (life + LTC riders) have complex interactions.
- If asked about a specific hybrid product's LTC rider terms, DO NOT fabricate.
- Say: "I can provide general hybrid LTC analysis, but [specific product] rider terms
  should be verified with the carrier illustration."
- Traditional LTC is simpler to analyze — benefit period, daily benefit, inflation protection.

KEY CARRIERS: Genworth, Mutual of Omaha, OneAmerica, Lincoln Financial (hybrid), Pacific Life (hybrid)
Dr. Aprille Trupiano leads this domain at RPI.`,
  knowledge_doc: 'legacy-ltc-knowledge.md',
  available_tools: uniq([...BASELINE_LION_TOOLS, ...LEGACY_LTC_EXTRAS]),
  created_at: '',
  updated_at: '',
}

// ─── All Lion Configs ──────────────────────────────────────────────────────

export const ALL_LION_CONFIGS: LionConfig[] = [
  MEDICARE_LION_CONFIG,
  ANNUITY_LION_CONFIG,
  INVESTMENT_LION_CONFIG,
  LIFE_ESTATE_LION_CONFIG,
  LEGACY_LTC_LION_CONFIG,
]

/** Get a Lion config by domain. */
export function getLionConfigByDomain(domain: string): LionConfig | undefined {
  return ALL_LION_CONFIGS.find(c => c.domain === domain)
}
