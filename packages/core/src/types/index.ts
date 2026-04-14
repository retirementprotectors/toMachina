// Core types for toMachina — derived from TAB_SCHEMAS in CORE_Database.gs

// Domain extensions (modular types grouped in sibling files)
export * from './farm-holdings'

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface Client {
  client_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  dob: string
  ssn_last4?: string
  status: string
  client_classification: string
  source: string
  /** UUID of the assigned user (from users collection, user_id field). Replaces legacy agent_id. */
  assigned_user_id?: string
  /** @deprecated Legacy field — use assigned_user_id instead. Points to row_N in old agents collection. */
  agent_id?: string
  /** FK to households collection — links this client to their household group. */
  household_id?: string
  /**
   * Farm + ag real-estate holdings per client. Added for SPR-FARMLAND-
   * VALUATION-001 (ZRD-PLATFORM-FARMLAND-VALUATION-API). Each entry is a
   * single parcel; values are maintained by SUPER_FARMLAND_VALUATION
   * against the `farmland_values` cache collection. See
   * `./farm-holdings.ts` for the element shape.
   */
  farm_holdings?: import('./farm-holdings').FarmHolding[]
  created_at: string
  updated_at: string
  [key: string]: unknown // 107 total fields
}

/**
 * @deprecated The agents collection is being replaced. Internal team members are
 * now tracked via `users` with `is_agent: true`. External producers use the `producers`
 * collection. This interface is retained for backward compatibility during the transition.
 */
export interface Agent {
  agent_id: string
  first_name: string
  last_name: string
  email: string
  npn: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Producer {
  producer_id: string
  first_name: string
  last_name: string
  email: string
  npn: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Account {
  account_id: string
  client_id: string
  account_type: string
  carrier: string
  product: string
  policy_number: string
  status: string
  premium: number
  face_amount: number
  effective_date: string
  /** Underwriting charter legal entity (e.g., "Accendo Insurance Company") */
  carrier_charter?: string
  /** NAIC code for the underwriting charter */
  naic_code?: string
  /** Carrier doc ID in Firestore carriers collection */
  carrier_id?: string
  rider_name?: string
  rider_activated?: boolean
  income_base?: number
  income_amount?: number
  payment_mode?: string
  rider_fee?: number
  payout_rate?: number
  rollup_rate?: number
  death_benefit?: number
  cash_value?: number
  surrender_value?: number
  account_value?: number
  // Premium fields
  /** Billing frequency — Monthly, Quarterly, Semi-Annual, Annual */
  premium_mode?: string
  /** Per-payment premium amount (e.g., $9.32/month) */
  modal_premium?: number
  /** Next scheduled premium payment amount */
  scheduled_premium?: number
  /** Cumulative lifetime premiums paid */
  total_premiums_paid?: number
  /** Annual premium — life/medicare only. For annuities, use net_deposits. */
  annual_premium?: number
  /** Net deposit amount — annuity products only */
  net_deposits?: number
  // Banking fields
  bank_name?: string
  routing_number?: string
  account_number?: string
  apy?: number
  maturity_date?: string
  term_months?: number
  fdic_insured?: boolean
  account_subtype?: string
  // Liability fields
  lender?: string
  loan_type?: string
  original_amount?: number
  current_balance?: number
  interest_rate?: number
  monthly_payment?: number
  payoff_date?: string
  collateral?: string

  // ═══════════════════════════════════════════════════════════════════
  // GHL Field Map additions (103 new fields, 2026-04-11)
  // Source: JDM's GHL white label screenshots, mapped by MEGAZORD CIO
  // These are ADDITIVE to the existing locked schemas — no deletions.
  // ═══════════════════════════════════════════════════════════════════

  // ── General additions (shared across product types) ───────────────
  /** Underwriting status (dropdown — e.g., "Approved", "Pending") */
  underwriting_status?: string
  /** Tax status (dropdown — e.g., "IRA", "Non-Qualified", "Roth") */
  tax_status?: string
  /** Product type/subtype (e.g., "FIA (Fixed Indexed)", "Advisory (Fee-Based)") */
  product_type?: string
  /** Product name (e.g., "Income Pay Pro", "Retirement Cornerstone") */
  product_name?: string
  /** Policy subtype (e.g., "Whole Life", "Term", "UL") */
  policy_type?: string
  /** Issue date (when policy was issued) */
  issue_date?: string
  /** Submitted date */
  submitted_date?: string
  /** As-of date for current values */
  as_of_date?: string
  /** Market (Internal/External/Affiliate) */
  market?: string
  /** Book of business identifier */
  book_of_business?: string
  /** Data source (e.g., "Carrier - Statement") */
  data_source?: string
  /** Agent writing number */
  agent_writing_number?: string

  // ── Current Values additions (Annuity) ────────────────────────────
  /** Cumulative return percentage */
  return_pct_cumulative?: number
  /** Annualized return percentage */
  return_pct_annualized?: number
  /** Benefit base for income rider calculations */
  benefit_base?: number
  /** Income benefit value */
  income_benefit?: number
  /** Long-term care benefit value */
  ltc_benefit?: number
  /** Death benefit option type (A=Level, B=Increasing, C=Return of Premium) */
  death_benefit_option?: string

  // ── Parties additions ─────────────────────────────────────────────
  /** Owner name (if different from applicant) */
  owner_name?: string
  /** Joint owner name */
  joint_owner_name?: string
  /** Annuitant name (if different from owner) — annuity only */
  annuitant_name?: string
  /** Joint annuitant — annuity only */
  joint_annuitant?: string
  /** Insured name — life only */
  insured_name?: string
  /** Primary beneficiary name (summary — full detail in Beni Center) */
  primary_beneficiary?: string
  /** Primary beneficiary percentage */
  primary_beneficiary_pct?: number

  // ── Contract Elements — Surrender + Bonus (Annuity) ───────────────
  /** Surrender charge schedule by year (array of percentages, Year 1-15) */
  surrender_schedule?: number[]
  /** Premium bonus dollar amount */
  premium_bonus_amount?: number
  /** Premium bonus percentage */
  premium_bonus_pct?: number
  /** Bonus vesting schedule by year (array of percentages, Year 1-11) */
  vesting_schedule?: number[]

  // ── Contract Elements — Riders (Annuity) ──────────────────────────
  /** Riders array — Income, Death Benefit, LTC riders as nested objects */
  riders?: Array<{
    /** Rider type: 'income' | 'death_benefit' | 'ltc' */
    type: string
    /** Exact rider name (e.g., "GWLB") */
    name: string
    /** Individual or Joint */
    individual_joint?: string
    /** Whether rider is activated */
    activated?: boolean
    /** Annual fee percentage */
    fee_pct?: number
    /** Up-front bonus amount or percentage */
    upfront_bonus?: number
    /** Deferral bonus percentage */
    deferral_bonus_pct?: number
    /** Number of deferral years */
    deferral_years?: number
    /** Compound or Simple interest */
    compound_or_simple?: string
    /** Payout years (for DB/LTC riders) */
    payout_years?: number
    /** Age-banded payout factors */
    payout_bands?: Array<{
      start_age: number
      end_age: number
      payout_factor: number
    }>
  }>

  // ── Fixed Annuity / MYGA Rates ────────────────────────────────────
  /** MYGA guaranteed rate */
  myga_rate?: number
  /** MYGA guarantee period (years) */
  myga_guarantee_period?: number
  /** Fixed annuity 1st year bonus percentage */
  fixed_annuity_1st_year_bonus?: number
  /** Fixed annuity 1st year total percentage */
  fixed_annuity_1st_year_total?: number
  /** Fixed annuity current rate percentage */
  fixed_annuity_current_rate?: number
  /** Fixed annuity guaranteed rate percentage */
  fixed_annuity_guaranteed_rate?: number

  // ── SPIA Details ──────────────────────────────────────────────────
  /** SPIA payment amount (per payment) */
  spia_payment_amount?: number
  /** SPIA payment mode */
  spia_payment_mode?: string
  /** SPIA payment frequency */
  spia_payment_frequency?: string
  /** SPIA payout options */
  spia_payout_options?: string

  // ── Account CashFlow (shared: Annuity + Investment) ───────────────
  /** Gross income amount per payment */
  income_gross?: number
  /** Income payment frequency */
  income_frequency?: string
  /** Gross income annualized */
  income_annualized?: number
  /** Federal withholding amount */
  income_fed_wh?: number
  /** State withholding amount */
  income_state_wh?: number
  /** Other/fixed withholding amount */
  income_other_wh?: number
  /** Net income amount per payment */
  income_net?: number
  /** Income type */
  income_type?: string
  /** Income location */
  income_location?: string
  /** Income as percentage of CSV (calculated) */
  income_pct_csv?: number

  // ── Investment-specific ───────────────────────────────────────────
  /** Date account was opened (Investment) */
  opened_date?: string
  /** ADF link (Investment) */
  adf_link?: string
  /** Advisory fees annualized dollar amount */
  advisory_fees_annualized?: number
  /** Advisory fees calculated percentage */
  advisory_fees_pct?: number
  /** Advisory fees calculation method */
  advisory_fees_calculation?: string
  /** Account registration type (e.g., "N2 (Individual)") */
  account_registration?: string
  /** BD / RIA firm name */
  bd_ria_firm?: string
  /** Custodian (e.g., "Charles Schwab") */
  custodian?: string
  /** Broker/Advisor of Record */
  broker_of_record?: string
  /** RPI portfolio identifier */
  rpi_portfolio?: string
  /** Fund family (direct holdings) */
  fund_family?: string
  /** Account registration detail */
  registration_detail?: string
  /** Estate tax ID (estate accounts only) */
  estate_tax_id?: string
  /** Decedent first name (estate accounts only) */
  decedent_first_name?: string
  /** Decedent middle name */
  decedent_middle_name?: string
  /** Decedent last name */
  decedent_last_name?: string
  /** Decedent SSN — PHI, mask in display */
  decedent_ssn?: string
  /** Decedent date of birth — PHI, mask in display */
  decedent_dob?: string
  /** Decedent date of death */
  decedent_dod?: string

  // ── Medicare Med Supp additions (gaps in locked schema) ───────────
  /** Preferred draft date for premium payments */
  preferred_draft_date?: string
  /** Planned premium at attained age */
  planned_premium_attained?: number
  /** Commissionable premium at issued rate */
  commissionable_premium_issued?: number
  /** Annualized rate increases history */
  annualized_rate_increases?: string
  /** Approved rate action — new premium amount */
  approved_rate_action_premium?: number
  /** Approved rate action — effective date */
  approved_rate_action_date?: string
  /** Discount types applied */
  discounts_type?: string
  /** Total discount percentage (policy level) */
  discounts_total_pct?: number
  /** Whether guaranteed issue is available */
  guaranteed_issue_available?: boolean

  // ── Life additions (gaps in locked schema) ─────────────────────────
  /** Approved underwriting class (e.g., "Standard | Non-Tobacco") */
  underwriting_approved?: string
  /** Projected underwriting class */
  underwriting_projected?: string
  /** ROPY level term period (years) — Return of Premium */
  ropy_level_term_period?: number
  /** In-force illustration scenarios */
  illustrations?: Array<{
    /** Scenario type: 'current' | 'face_solve' | 'premium_solve' | 'lower_face' | 'zero_premium' | 'term_doc' */
    scenario: string
    death_benefit?: number
    annualized_premium?: number
    /** 1035 exchange net cash value */
    net_cash_1035x?: number
    lapse_age_current?: number
    lapse_age_guaranteed?: number
    /** Term doc page specific fields */
    conversion_age?: number
    conversion_rules?: string
    new_annualized_premium?: number
    new_death_benefit?: number
  }>
  // ── Life — Dividend Details (fills the TBD section from locked schema) ──
  /** Dividend option 1 */
  dividend_option_1?: string
  /** Dividend option 2 */
  dividend_option_2?: string
  /** Current dividend balance */
  dividend_balance?: number
  /** Last year's dividend amount */
  last_year_dividend?: number
  /** Last year's paid-up additions increase */
  last_year_pua_increase?: number
  /** Current year's dividend amount */
  current_year_dividend?: number
  /** Current year's paid-up additions increase */
  current_year_pua_increase?: number

  // ── Existing fields (unchanged) ───────────────────────────────────
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Opportunity {
  opportunity_id: string
  client_id?: string
  agent_id?: string
  /** Admin staff processing this opportunity (separate from agent_id who wrote the policy) */
  assignee_id?: string
  stage: string
  pipeline: string
  value: number
  source: string
  /** Pipeline-specific data fields (e.g. policy_number, premium, tax_status) */
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Revenue {
  revenue_id: string
  account_id: string
  agent_id: string
  amount: number
  revenue_type: string
  period: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface User {
  email: string
  /** Stable UUID for cross-collection references. All 14 users already have this populated. */
  user_id?: string
  first_name: string
  last_name: string
  role: string
  level: number
  division: string
  unit: string
  manager_email: string
  status: string
  entitlements: string[]
  slack_id?: string
  phone?: string
  job_title?: string
  aliases?: string[]
  personal_email?: string
  location?: string
  /** National Producer Number — only relevant when is_agent is true. */
  npn?: string
  /** Whether this user is a licensed insurance agent eligible for client assignment. */
  is_agent?: boolean
  /** Whether this user is a Registered Rep (Series 7 — BD side: Gradient Securities, RBC). */
  is_rr?: boolean
  /** Whether this user is an Investment Advisor Rep (Series 65/66 — RIA side: Gradient Wealth, Schwab). */
  is_iar?: boolean
  hire_date?: string
  google_chat_id?: string
  employee_profile?: Record<string, unknown>
  module_permissions?: Record<string, string[]>
  [key: string]: unknown
}

export interface Carrier {
  carrier_id: string
  name: string
  naic_code?: string
  parent_carrier?: string
  product_types?: string[]
  status: string
  am_best_rating?: string
  website?: string
  contact_phone?: string
  contact_email?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Product {
  product_id: string
  carrier_id: string
  name: string
  product_type: string
  core_product_type?: string
  status: string
  description?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface OrgUnit {
  entity_id: string
  entity_type: string
  name: string
  parent_id?: string
  manager_email?: string
  slack_channel_id?: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Campaign {
  campaign_id: string
  name: string
  campaign_name?: string
  type: string
  campaign_type?: string
  status: string
  trigger_type?: string
  audience?: string
  template_ids?: string[]
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Template {
  template_id: string
  name: string
  template_name?: string
  type: string
  template_type?: string
  channel: string
  campaign_id?: string
  subject?: string
  body?: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CaseTask {
  task_id: string
  client_id?: string
  account_id?: string
  title: string
  task_type?: string
  description?: string
  status: string
  priority?: string
  assigned_to?: string
  due_date?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Communication {
  comm_id: string
  communication_id?: string
  client_id?: string
  channel: string
  direction: string
  subject?: string
  body?: string
  status: string
  sent_at?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface CompGrid {
  grid_id: string
  carrier_id: string
  product_type: string
  level: string
  rate: number
  effective_date?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface AtlasSource {
  source_id: string
  name: string
  type: string
  category: string
  status: string
  frequency?: string
  last_pull?: string
  owner?: string
  description?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FlowPipeline {
  pipeline_key: string
  name: string
  description?: string
  status: string
  stages?: string[]
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FlowInstance {
  instance_id: string
  pipeline_key: string
  subject_type: string
  subject_id: string
  current_stage: string
  status: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// --- Builder 2: Additional entity types ---

export interface Pipeline {
  pipeline_id: string
  pipeline_name: string
  status: string
  pipeline_type: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Relationship {
  relationship_id: string
  client_id: string
  related_client_id?: string
  relationship_type: string
  created_at: string
  [key: string]: unknown
}

export interface Activity {
  activity_id: string
  client_id: string
  activity_type: string
  description: string
  created_at: string
  [key: string]: unknown
}

export interface ContentBlock {
  block_id: string
  block_name: string
  block_type: string
  content: string
  [key: string]: unknown
}

export interface SourceRegistry {
  source_id: string
  source_name: string
  source_type: string
  status: string
  [key: string]: unknown
}

// --- Householding ---

export interface Household {
  household_id: string
  household_name: string
  primary_contact_id: string
  primary_contact_name?: string
  members: HouseholdMember[]
  address?: string
  city?: string
  state?: string
  zip?: string
  household_status: string
  assigned_user_id?: string
  acf_folder_id?: string
  acf_folder_url?: string
  aggregate_financials?: HouseholdFinancials
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface HouseholdMember {
  client_id: string
  client_name?: string
  role: 'primary' | 'spouse' | 'child' | 'parent' | 'sibling' | 'other'
  relationship: string
  added_at: string
}

export interface HouseholdFinancials {
  combined_income?: number
  combined_net_worth?: number
  combined_investable_assets?: number
  filing_status?: string
  total_accounts?: number
  total_premium?: number
  total_face_amount?: number
  last_calculated?: string
}

// ============================================================================
// ENTITLEMENT TYPES
// ============================================================================

export type UserLevel = 'OWNER' | 'EXECUTIVE' | 'LEADER' | 'USER'

export interface Entitlement {
  moduleKey: string
  suite: string
  minLevel: number
  status: 'LIVE' | 'BETA' | 'DISABLED'
}

// ============================================================================
// API RESPONSE TYPE (Builder 3)
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// DEDUP/MATCH TYPES (Builder 3)
// ============================================================================

export type DedupTier = 'MERGED' | 'MERGED_NOTIFY' | 'REVIEW_NEEDED' | 'INSERTED'

export interface DedupResult {
  tier: DedupTier
  score: number
  method: string
  existingId?: string
  mergedFields?: string[]
}

// ============================================================================
// INTAKE STATUSES (Builder 3)
// ============================================================================

export const INTAKE_STATUSES = [
  'Pending',
  'Processing',
  'Approved',
  'Rejected',
  'Needs Review',
  'Error',
  'Complete',
] as const

export type IntakeStatus = typeof INTAKE_STATUSES[number]

// ============================================================================
// CLIENT STATUSES
// ============================================================================

export const CLIENT_STATUSES = [
  'Active',
  'Active - Affiliate (OK to Market)',
  'Active - Affiliate (Do Not Market)',
  'Prospect',
  'Inactive',
  'Inactive - Fired',
  'Inactive - Deceased',
  'Inactive - Complaint',
  'Unknown',
] as const

export type ClientStatus = typeof CLIENT_STATUSES[number]

// ============================================================================
// ACCOUNT STATUSES
// ============================================================================

export const ACCOUNT_STATUSES = [
  'Active',
  'Pending',
  'Inactive',
  'Terminated',
  'Surrendered',
  'Cancelled',
  'Lapsed',
  'Matured',
  'Deceased',
  'Claim',
  'Unknown',
] as const

export type AccountStatus = typeof ACCOUNT_STATUSES[number]

// ============================================================================
// ACCOUNT TYPE CATEGORIES (Builder 3)
// ============================================================================

export const ACCOUNT_TYPE_CATEGORIES = [
  'Annuity',
  'Life',
  'Medicare',
  'Investments',
  'Banking',
  'Liabilities',
] as const

export type AccountTypeCategory = typeof ACCOUNT_TYPE_CATEGORIES[number]

// ============================================================================
// ACCESS CENTER TYPES
// ============================================================================

export type AccessStatus = 'active' | 'pending' | 'expired' | 'not_started'
export type AccessType = 'api' | 'portal'
export type AccessCategory = 'medicare' | 'annuity' | 'life' | 'investment' | 'financial' | 'government' | 'other'

export interface AccessItem {
  access_id: string
  client_id: string
  type: AccessType
  service_name: string
  subheading?: string
  category: AccessCategory
  carrier_id?: string
  product_type?: string
  status: AccessStatus
  portal_url?: string
  username?: string
  auth_status: 'none' | 'sent' | 'on_file'
  auth_doc_url?: string
  last_verified?: string
  last_login?: string
  notes?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// ============================================================================
// PROZONE TYPES
// ============================================================================

export interface Territory {
  territory_id: string
  territory_name: string
  state: string
  region?: string
  counties: TerritoryCounty[]
  zones: Zone[]
  status: 'Active' | 'Inactive'
  created_at: string
  updated_at: string
}

export interface TerritoryCounty {
  county: string
  zone_id: string
  client_count?: number
}

export interface Zone {
  zone_id: string
  zone_name: string
  territory_id: string
  resolution_type: 'county' | 'zip'
  assignments: ZoneAssignment[]
}

export interface ZoneAssignment {
  county?: string
  zip?: string
  zone_id: string
}

export interface SpecialistConfig {
  config_id: string
  user_id: string
  specialist_name: string
  territory_id: string
  origin_zip: string
  tier_map: TierMapEntry[]
  office_days: string[]
  field_days: string[]
  slot_templates: SlotTemplate[]
  meeting_criteria: MeetingCriteria
  zone_lead_criteria: ZoneLeadCriteria
  calendar_booking_url?: string
  team: TeamMember[]
  status: 'Active' | 'Inactive'
  created_at: string
  updated_at: string
}

export interface TierMapEntry {
  zone_id: string
  county?: string
  tier: 'I' | 'II' | 'III' | 'IV'
  drive_minutes: number
  slots_per_day: number
  first_slot: string
  last_slot: string
}

export interface SlotTemplate {
  tier: 'I' | 'II' | 'III' | 'IV'
  slots_per_day: number
  first_slot: string
  last_slot: string
  slot_duration_minutes: number
  departure_time?: string
  return_time?: string
}

export interface MeetingCriteria {
  field: { active_la: boolean; intra_territory: boolean; max_age: number }
  office: { active_la: boolean; min_age?: number; outer_zone: boolean }
}

export interface ZoneLeadCriteria {
  active_medicare_all: boolean
  active_la_80plus: boolean
  no_core_under_80: boolean
}

export interface TeamMember {
  user_id: string
  name: string
  role: 'coordinator' | 'associate'
}

// ============================================================================
// GUARDIAN — Data Protection Engine
// ============================================================================

export type {
  GuardianAudit,
  GuardianFinding,
  DataSnapshot,
  CollectionSnapshot,
  GuardianWrite,
  AnomalyAlert,
  AnomalyType,
  CollectionSchema,
  CollectionAuditResult,
  AuditReport,
  GuardianPhase,
  FindingSeverity,
  FindingCategory,
  FindingStatus,
  PhaseTransitionResult,
} from './guardian'

export {
  GUARDIAN_PHASES,
  GUARDIAN_PHASE_ORDER,
  FINDING_SEVERITIES,
  FINDING_CATEGORIES,
  FINDING_STATUSES,
  ANOMALY_TYPES,
} from './guardian'
