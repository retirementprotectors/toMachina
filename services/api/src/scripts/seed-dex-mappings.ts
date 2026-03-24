/**
 * DEX Field Mappings Seeder — PDF field-to-data-source mappings
 *
 * Seeds the `dex_field_mappings` Firestore collection with field mappings
 * for forms that have known PDF field names. Merges data from:
 *   1. DEX_FieldMappings.gs (GAS source — data source definitions)
 *   2. /tmp/nbx-kits/field-map.js (PDF field discovery — actual PDF field names)
 *   3. /tmp/nbx-kits/fill-final.js (fill logic — confirmed field name -> value patterns)
 *
 * Key discoveries from PDF field discovery:
 *   - CAF "Home Phone" field is actually the EMAIL position
 *   - CAF P2 grid uses numbered fields (1, 1_2, 1_3, ... undefined_8, etc.)
 *   - CAF P3 Trusted Contact shares "First Name" with P1 owner
 *   - TAF has extremely long field names (full label text as field name)
 *   - TAF P3 grid has fee comparison fields Gradient flagged as critical
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-dex-mappings.ts --all
 *   npx tsx services/api/src/scripts/seed-dex-mappings.ts --form=FORM_0002
 *   npx tsx services/api/src/scripts/seed-dex-mappings.ts --all --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { COLLECTIONS } from '../../../../packages/core/src/dex/config'
import { FieldType, InputType, MappingStatus } from '../../../../packages/core/src/dex/types'

// ============================================================================
// Constants
// ============================================================================

const BATCH_LIMIT = 500

// ============================================================================
// Types
// ============================================================================

interface MappingEntry {
  mapping_id: string
  form_id: string
  form_name: string
  field_name: string
  field_type: string
  data_source: string
  required: boolean
  default_value: string
  notes: string
  status: string
  input_type: string
  options: string[]
  label: string
  help_text: string
  validation: Record<string, unknown>
}

// ============================================================================
// Helper
// ============================================================================

function m(
  seq: number,
  formId: string,
  formName: string,
  fieldName: string,
  fieldType: string,
  dataSource: string,
  required: boolean,
  label: string,
  opts?: {
    default_value?: string
    notes?: string
    status?: string
    input_type?: string
    options?: string[]
    help_text?: string
    validation?: Record<string, unknown>
  },
): MappingEntry {
  const formSeq = formId.replace('FORM_', '')
  return {
    mapping_id: `MAP_${formSeq}_${String(seq).padStart(3, '0')}`,
    form_id: formId,
    form_name: formName,
    field_name: fieldName,
    field_type: fieldType,
    data_source: dataSource,
    required,
    default_value: opts?.default_value ?? '',
    notes: opts?.notes ?? '',
    status: opts?.status ?? MappingStatus.AUTO_FILL,
    input_type: opts?.input_type ?? fieldType,
    options: opts?.options ?? [],
    label,
    help_text: opts?.help_text ?? '',
    validation: opts?.validation ?? {},
  }
}

// ============================================================================
// CAF Mappings (FORM_0002) — 50+ fields from PDF discovery
// ============================================================================

const CAF_FORM_ID = 'FORM_0002'
const CAF_NAME = 'Client Account Form (CAF)'

const CAF_MAPPINGS: MappingEntry[] = [
  // P1 — Owner Section
  m(1, CAF_FORM_ID, CAF_NAME, 'OwnerCustodianCompanyPartnershipTrust', FieldType.TEXT, 'client.display_name', true, 'Owner / Custodian / Company Name', { notes: 'Full name line. Fill: lastName + spaces + firstName.' }),
  m(2, CAF_FORM_ID, CAF_NAME, 'Last Name', FieldType.TEXT, 'client.last_name', true, 'Last Name'),
  m(3, CAF_FORM_ID, CAF_NAME, 'First Name', FieldType.TEXT, 'client.first_name', true, 'First Name', { notes: 'Shares field name with P3 Trusted Contact First Name. pdf-lib sets the FIRST occurrence.' }),
  m(4, CAF_FORM_ID, CAF_NAME, 'SSNTIN', FieldType.SSN, 'client.ssn', true, 'SSN / TIN', { status: MappingStatus.PENDING_DATA, help_text: 'Collected securely at generation time.' }),

  // P1 — Address
  m(5, CAF_FORM_ID, CAF_NAME, 'Home Address', FieldType.TEXT, 'client.address', true, 'Home Address'),
  m(6, CAF_FORM_ID, CAF_NAME, 'City', FieldType.TEXT, 'client.city', true, 'City'),
  // State/Zip on P1 are NOT named fields in the PDF — they are label-only

  // P1 — Contact: "Home Phone" = EMAIL position (confirmed by PDF discovery)
  m(7, CAF_FORM_ID, CAF_NAME, 'Home Phone', FieldType.EMAIL, 'client.email', true, 'Email Address', { notes: 'MISLEADING FIELD NAME: "Home Phone" in the PDF actually maps to the Email field position. Confirmed by visual inspection.' }),

  // P1 — USA Patriot Act / ID
  m(8, CAF_FORM_ID, CAF_NAME, 'ID', FieldType.TEXT, 'client.dl_number', false, 'ID Number', { notes: 'Drivers License / Passport / State ID number.' }),
  m(9, CAF_FORM_ID, CAF_NAME, 'StateCountry', FieldType.TEXT, 'client.dl_state', false, 'ID State/Country', { input_type: InputType.STATE }),
  m(10, CAF_FORM_ID, CAF_NAME, 'Expiration Date', FieldType.DATE, 'client.dl_expiry', false, 'ID Expiration Date'),

  // P1 — Employment
  m(11, CAF_FORM_ID, CAF_NAME, 'Occupation', FieldType.TEXT, 'client.occupation', false, 'Occupation'),
  m(12, CAF_FORM_ID, CAF_NAME, 'Employer', FieldType.TEXT, 'client.employer', false, 'Employer'),
  m(13, CAF_FORM_ID, CAF_NAME, 'State', FieldType.TEXT, 'client.emp_state', false, 'Employment State', { notes: 'This "State" field is under the Employment section, not the address section.' }),
  m(14, CAF_FORM_ID, CAF_NAME, 'Text2', FieldType.TEXT, 'client.emp_city', false, 'Employment City', { notes: 'Generic field name "Text2" = employment city.' }),
  m(15, CAF_FORM_ID, CAF_NAME, 'Text4', FieldType.TEXT, 'client.emp_zip', false, 'Employment Zip', { notes: 'Generic field name "Text4" = employment zip.' }),

  // P2 — Income Grid (Owner #1 column)
  m(16, CAF_FORM_ID, CAF_NAME, '1', FieldType.CURRENCY, 'client.annual_income', false, 'Annual Income (Owner #1)', { notes: 'P2 grid. Column: Owner #1. Row: Annual Income.' }),
  m(17, CAF_FORM_ID, CAF_NAME, '1_2', FieldType.CURRENCY, 'input.annual_income_owner2', false, 'Annual Income (Owner #2)', { status: MappingStatus.USER_INPUT }),
  m(18, CAF_FORM_ID, CAF_NAME, '1_3', FieldType.CURRENCY, 'input.annual_income_jointly', false, 'Annual Income (Jointly)', { status: MappingStatus.USER_INPUT }),
  m(19, CAF_FORM_ID, CAF_NAME, '1_4', FieldType.CURRENCY, 'input.annual_income_total', false, 'Annual Income (Total)', { status: MappingStatus.USER_INPUT }),
  m(20, CAF_FORM_ID, CAF_NAME, '2', FieldType.CURRENCY, 'client.annual_net_income', false, 'Annual Net Income (Owner #1)'),
  m(21, CAF_FORM_ID, CAF_NAME, '2_2', FieldType.CURRENCY, 'input.annual_net_income_owner2', false, 'Annual Net Income (Owner #2)', { status: MappingStatus.USER_INPUT }),
  m(22, CAF_FORM_ID, CAF_NAME, '2_3', FieldType.CURRENCY, 'input.annual_net_income_jointly', false, 'Annual Net Income (Jointly)', { status: MappingStatus.USER_INPUT }),
  m(23, CAF_FORM_ID, CAF_NAME, '2_4', FieldType.CURRENCY, 'input.annual_net_income_total', false, 'Annual Net Income (Total)', { status: MappingStatus.USER_INPUT }),

  // P2 — Assets Grid (Owner #1 column)
  m(24, CAF_FORM_ID, CAF_NAME, 'undefined_8', FieldType.CURRENCY, 'client.checking_savings', false, 'Checking/Savings (Owner #1)', { notes: 'PDF field named "undefined_8" = Checking/Savings Owner#1 column.' }),
  m(25, CAF_FORM_ID, CAF_NAME, '1_5', FieldType.CURRENCY, 'input.checking_savings_owner2', false, 'Checking/Savings (Owner #2)', { status: MappingStatus.USER_INPUT }),
  m(26, CAF_FORM_ID, CAF_NAME, '1_6', FieldType.CURRENCY, 'input.checking_savings_jointly', false, 'Checking/Savings (Jointly)', { status: MappingStatus.USER_INPUT }),
  m(27, CAF_FORM_ID, CAF_NAME, '1_7', FieldType.CURRENCY, 'input.checking_savings_total', false, 'Checking/Savings (Total)', { status: MappingStatus.USER_INPUT }),

  m(28, CAF_FORM_ID, CAF_NAME, 'NQ Investments Mutual Funds Stocks ETFs etc 1', FieldType.CURRENCY, 'client.nq_investments', false, 'NQ Investments (Owner #1)', { notes: 'Long field name from PDF.' }),
  m(29, CAF_FORM_ID, CAF_NAME, '2_5', FieldType.CURRENCY, 'input.nq_investments_owner2', false, 'NQ Investments (Owner #2)', { status: MappingStatus.USER_INPUT }),
  m(30, CAF_FORM_ID, CAF_NAME, '2_6', FieldType.CURRENCY, 'input.nq_investments_jointly', false, 'NQ Investments (Jointly)', { status: MappingStatus.USER_INPUT }),
  m(31, CAF_FORM_ID, CAF_NAME, '2_7', FieldType.CURRENCY, 'input.nq_investments_total', false, 'NQ Investments (Total)', { status: MappingStatus.USER_INPUT }),

  m(32, CAF_FORM_ID, CAF_NAME, 'NQ Investments Mutual Funds Stocks ETFs etc 2', FieldType.CURRENCY, 'client.annuities_nq', false, 'Annuities NQ (Owner #1)'),
  m(33, CAF_FORM_ID, CAF_NAME, 'NQ Investments Mutual Funds Stocks ETFs etc 3', FieldType.CURRENCY, 'client.retirement_accounts', false, 'Retirement Accounts (Owner #1)'),

  m(34, CAF_FORM_ID, CAF_NAME, '1_8', FieldType.CURRENCY, 'client.other_assets', false, 'Other Assets (Owner #1)'),
  m(35, CAF_FORM_ID, CAF_NAME, '2_8', FieldType.CURRENCY, 'input.sub_totals', false, 'Sub-Totals (Owner #1)', { status: MappingStatus.USER_INPUT }),

  // P2 — Totals
  m(36, CAF_FORM_ID, CAF_NAME, 'For GWM should match amount entered on Investment Advisory Agreement', FieldType.CURRENCY, 'client.total_investable', false, 'Total Investable Assets', { notes: 'Long PDF field name. Should match IAA amount for GWM.' }),
  m(37, CAF_FORM_ID, CAF_NAME, 'undefined_9', FieldType.CURRENCY, 'client.residence_value', false, 'Primary Residence Value'),
  m(38, CAF_FORM_ID, CAF_NAME, 'undefined_10', FieldType.CURRENCY, 'client.liabilities', false, 'Liabilities'),
  m(39, CAF_FORM_ID, CAF_NAME, 'undefined_11', FieldType.CURRENCY, 'client.net_worth', false, 'Net Worth'),
  m(40, CAF_FORM_ID, CAF_NAME, 'undefined_12', FieldType.CURRENCY, 'client.liquid_net_worth', false, 'Liquid Net Worth'),

  // P2 — COMRA
  m(41, CAF_FORM_ID, CAF_NAME, 'undefined_13', FieldType.DATE, 'client.comra_date', false, 'COMRA Date'),
  m(42, CAF_FORM_ID, CAF_NAME, 'undefined_14', FieldType.TEXT, 'client.comra_score', false, 'COMRA Score'),

  // P3 — Trusted Contact
  m(43, CAF_FORM_ID, CAF_NAME, 'Last Name_3', FieldType.TEXT, 'client.tc_last_name', false, 'Trusted Contact Last Name'),
  m(44, CAF_FORM_ID, CAF_NAME, 'Middle Name', FieldType.TEXT, 'client.tc_middle_name', false, 'Trusted Contact Middle Name'),
  m(45, CAF_FORM_ID, CAF_NAME, 'Address', FieldType.TEXT, 'client.tc_address', false, 'Trusted Contact Address'),
  m(46, CAF_FORM_ID, CAF_NAME, 'City_3', FieldType.TEXT, 'client.tc_city', false, 'Trusted Contact City'),
  m(47, CAF_FORM_ID, CAF_NAME, 'State_3', FieldType.TEXT, 'client.tc_state', false, 'Trusted Contact State', { input_type: InputType.STATE }),
  m(48, CAF_FORM_ID, CAF_NAME, 'ZIP Code', FieldType.TEXT, 'client.tc_zip', false, 'Trusted Contact Zip'),
  m(49, CAF_FORM_ID, CAF_NAME, 'Country', FieldType.TEXT, 'client.tc_country', false, 'Trusted Contact Country', { default_value: 'USA' }),
  m(50, CAF_FORM_ID, CAF_NAME, 'Work Phone', FieldType.PHONE, 'client.tc_work_phone', false, 'Trusted Contact Work Phone'),
  m(51, CAF_FORM_ID, CAF_NAME, 'Home Phone_3', FieldType.PHONE, 'client.tc_home_phone', false, 'Trusted Contact Home Phone'),
  m(52, CAF_FORM_ID, CAF_NAME, 'Mobile Phone', FieldType.PHONE, 'client.tc_mobile', false, 'Trusted Contact Mobile'),
  m(53, CAF_FORM_ID, CAF_NAME, 'Email Address', FieldType.EMAIL, 'client.tc_email', false, 'Trusted Contact Email'),
  m(54, CAF_FORM_ID, CAF_NAME, 'Relationship to Primary ApplicantCoApplicant', FieldType.TEXT, 'client.tc_relationship', false, 'Trusted Contact Relationship', { input_type: InputType.DROPDOWN, options: ['Spouse', 'Child', 'Parent', 'Sibling', 'Other Family', 'Attorney', 'CPA', 'Other'] }),
]

// ============================================================================
// GWM TAF Mappings (FORM_0004) — 30+ fields from PDF discovery
// ============================================================================

const TAF_FORM_ID = 'FORM_0004'
const TAF_NAME = 'Gradient Wealth Management TAF'

const TAF_MAPPINGS: MappingEntry[] = [
  // Header / Account Info
  m(1, TAF_FORM_ID, TAF_NAME, 'Account TitleRow1', FieldType.TEXT, 'account.account_title', true, 'Account Title'),
  m(2, TAF_FORM_ID, TAF_NAME, ' of years as a clientRow1', FieldType.TEXT, 'client.years_as_client', false, 'Years as Client', { notes: 'Field name has leading space.' }),
  m(3, TAF_FORM_ID, TAF_NAME, 'Date of client meetingRow1', FieldType.DATE, 'input.meeting_date', true, 'Date of Client Meeting', { status: MappingStatus.USER_INPUT }),
  m(4, TAF_FORM_ID, TAF_NAME, 'Delivery Date of Form CRSRow1', FieldType.DATE, 'input.crs_delivery_date', true, 'CRS Delivery Date', { status: MappingStatus.USER_INPUT }),
  m(5, TAF_FORM_ID, TAF_NAME, 'COMRA ScoreDateRow1', FieldType.TEXT, 'client.comra_score', false, 'COMRA Score'),
  m(6, TAF_FORM_ID, TAF_NAME, 'COMRA ScoreDateRow1_2', FieldType.DATE, 'client.comra_date', false, 'COMRA Date'),
  m(7, TAF_FORM_ID, TAF_NAME, 'Asset Management Services specify the Money ManagersPlatformRow1', FieldType.TEXT, 'input.money_managers', false, 'Money Managers/Platform', { status: MappingStatus.USER_INPUT }),
  m(8, TAF_FORM_ID, TAF_NAME, 'fill_19', FieldType.CURRENCY, 'input.transaction_amount', true, 'Transaction Amount', { status: MappingStatus.USER_INPUT }),

  // Investment Goals (rank order 1-4)
  m(9, TAF_FORM_ID, TAF_NAME, 'Wealth Preservation eg Estate Planning Family Business etc', FieldType.TEXT, 'input.goal_wealth_rank', false, 'Goal: Wealth Preservation (Rank)', { status: MappingStatus.USER_INPUT, help_text: 'Rank 1-4' }),
  m(10, TAF_FORM_ID, TAF_NAME, 'Accumulation eg Retirement Large Purchase etc', FieldType.TEXT, 'input.goal_accumulation_rank', false, 'Goal: Accumulation (Rank)', { status: MappingStatus.USER_INPUT }),
  m(11, TAF_FORM_ID, TAF_NAME, 'Retirement Income eg Financial Independence Systematic Savings Annuitization etc', FieldType.TEXT, 'input.goal_retirement_rank', false, 'Goal: Retirement Income (Rank)', { status: MappingStatus.USER_INPUT }),
  m(12, TAF_FORM_ID, TAF_NAME, 'Other eg Managing Risk Tax Relief Education Funding NearTerm Liquidity', FieldType.TEXT, 'input.goal_other_rank', false, 'Goal: Other (Rank)', { status: MappingStatus.USER_INPUT }),

  m(13, TAF_FORM_ID, TAF_NAME, 'Explanation', FieldType.TEXT, 'input.goal_explanation', false, 'Goals Explanation', { status: MappingStatus.USER_INPUT, input_type: InputType.TEXTAREA }),

  // BI Narrative (the big one)
  m(14, TAF_FORM_ID, TAF_NAME, 'Briefly describe how this recommendation is in the Best Interest of the client in the space below This summary should include details of the customers needs and the factors that led to this recommendationtransactions  Additional sections below must be completed to provide additional detail regarding fees products considered and attributes of currentproposed products see grid  If this transaction is part of a rollover additional information regarding the customers plan will need to be completed later in this formRow1', FieldType.TEXT, 'input.bi_narrative', true, 'Best Interest Narrative', { status: MappingStatus.USER_INPUT, input_type: InputType.TEXTAREA, help_text: 'Describe how this recommendation is in the best interest of the client. Include customer needs and factors leading to this recommendation.', notes: 'Extremely long PDF field name — the entire label text becomes the field identifier.' }),

  // Product Comparison
  m(15, TAF_FORM_ID, TAF_NAME, 'What other available products or product companies were considered as part of this recommendation why were they not selectedRow1', FieldType.TEXT, 'input.products_considered', true, 'Products Considered', { status: MappingStatus.USER_INPUT, input_type: InputType.TEXTAREA }),

  // Source of Funds
  m(16, TAF_FORM_ID, TAF_NAME, 'Qualified Assets eg IRA Roth IRA 401k 403b 457 Pension Plan Other', FieldType.CURRENCY, 'input.qualified_assets', false, 'Qualified Assets Source', { status: MappingStatus.USER_INPUT }),
  m(17, TAF_FORM_ID, TAF_NAME, 'NonQualified Assets eg Bank or Brokerage Account', FieldType.CURRENCY, 'input.nonqualified_assets', false, 'Non-Qualified Assets Source', { status: MappingStatus.USER_INPUT }),

  // P3 Grid — Product Comparison (Current vs Proposed)
  m(18, TAF_FORM_ID, TAF_NAME, 'Current PlanProductList ProductVendor', FieldType.TEXT, 'input.current_vendor', false, 'Current Product/Vendor', { status: MappingStatus.USER_INPUT }),
  m(19, TAF_FORM_ID, TAF_NAME, 'Proposed ProductList ProductVendor', FieldType.TEXT, 'input.proposed_vendor', false, 'Proposed Product/Vendor', { status: MappingStatus.USER_INPUT }),
  m(20, TAF_FORM_ID, TAF_NAME, 'Current PlanProductBenefits', FieldType.TEXT, 'input.current_benefits', false, 'Current Benefits', { status: MappingStatus.USER_INPUT }),
  m(21, TAF_FORM_ID, TAF_NAME, 'Proposed ProductBenefits', FieldType.TEXT, 'input.proposed_benefits', false, 'Proposed Benefits', { status: MappingStatus.USER_INPUT }),
  m(22, TAF_FORM_ID, TAF_NAME, 'Current PlanProductRestrictionsLimitations', FieldType.TEXT, 'input.current_restrictions', false, 'Current Restrictions', { status: MappingStatus.USER_INPUT }),
  m(23, TAF_FORM_ID, TAF_NAME, 'Proposed ProductRestrictionsLimitations', FieldType.TEXT, 'input.proposed_restrictions', false, 'Proposed Restrictions', { status: MappingStatus.USER_INPUT }),
  m(24, TAF_FORM_ID, TAF_NAME, 'Current PlanProductTax Considerations', FieldType.TEXT, 'input.current_tax', false, 'Current Tax Considerations', { status: MappingStatus.USER_INPUT }),
  m(25, TAF_FORM_ID, TAF_NAME, 'Proposed ProductTax Considerations', FieldType.TEXT, 'input.proposed_tax', false, 'Proposed Tax Considerations', { status: MappingStatus.USER_INPUT }),

  // P3 Grid — Fee Section (CRITICAL — Gradient flagged these as missing)
  m(26, TAF_FORM_ID, TAF_NAME, 'Current PlanProductInvestment Advisory', FieldType.PERCENT, 'input.current_advisory_fee', false, 'Current Investment Advisory Fee', { status: MappingStatus.USER_INPUT, notes: 'CRITICAL: Gradient flagged missing fees. Must be filled.' }),
  m(27, TAF_FORM_ID, TAF_NAME, 'Not ApplicableInvestment Advisory', FieldType.PERCENT, 'input.proposed_advisory_fee', false, 'Proposed Investment Advisory Fee', { status: MappingStatus.USER_INPUT }),
  m(28, TAF_FORM_ID, TAF_NAME, 'Current PlanProductGWM Advisory Fee', FieldType.PERCENT, 'input.current_gwm_fee', false, 'Current GWM Advisory Fee', { status: MappingStatus.USER_INPUT }),
  m(29, TAF_FORM_ID, TAF_NAME, 'Not ApplicableGWM Advisory Fee', FieldType.PERCENT, 'input.proposed_gwm_fee', false, 'Proposed GWM Advisory Fee', { status: MappingStatus.USER_INPUT }),
  m(30, TAF_FORM_ID, TAF_NAME, 'Current PlanProductTPMM Fee', FieldType.PERCENT, 'input.current_tpmm_fee', false, 'Current TPMM Fee', { status: MappingStatus.USER_INPUT }),
  m(31, TAF_FORM_ID, TAF_NAME, 'Not ApplicableTPMM Fee', FieldType.PERCENT, 'input.proposed_tpmm_fee', false, 'Proposed TPMM Fee', { status: MappingStatus.USER_INPUT }),
  m(32, TAF_FORM_ID, TAF_NAME, 'Current PlanProduct of tradesyear', FieldType.TEXT, 'input.current_trades_year', false, 'Current # Trades/Year', { status: MappingStatus.USER_INPUT }),
  m(33, TAF_FORM_ID, TAF_NAME, 'Not Applicable of tradesyear', FieldType.TEXT, 'input.proposed_trades_year', false, 'Proposed # Trades/Year', { status: MappingStatus.USER_INPUT }),

  // Rep Acknowledgements
  m(34, TAF_FORM_ID, TAF_NAME, 'accurate and applicable to this transaction If there have been any material changes or the CAF is older than three years an updated CAF is required', FieldType.DATE, 'input.caf_date', false, 'CAF Date Confirmation', { status: MappingStatus.USER_INPUT, notes: 'Confirms CAF is current.' }),
  m(35, TAF_FORM_ID, TAF_NAME, 'by email Email Address_2', FieldType.EMAIL, 'client.email', false, 'Delivery Email', { notes: 'Email for document delivery.' }),
]

// ============================================================================
// COMRA Mappings (FORM_0001) — Firm-level data
// ============================================================================

const COMRA_FORM_ID = 'FORM_0001'
const COMRA_NAME = 'COMRA - Client Onboarding & Mutual Risk Assessment'

const COMRA_MAPPINGS: MappingEntry[] = [
  m(1, COMRA_FORM_ID, COMRA_NAME, 'client_name', FieldType.TEXT, 'client.display_name', true, 'Client Name'),
  m(2, COMRA_FORM_ID, COMRA_NAME, 'advisor_name', FieldType.TEXT, 'advisor.display_name', true, 'Advisor Name'),
  m(3, COMRA_FORM_ID, COMRA_NAME, 'advisor_crd', FieldType.TEXT, 'advisor.crd_number', true, 'Advisor CRD Number'),
  m(4, COMRA_FORM_ID, COMRA_NAME, 'firm_name', FieldType.TEXT, 'firm.name', true, 'Firm Name', { default_value: 'Gradient Securities' }),
  m(5, COMRA_FORM_ID, COMRA_NAME, 'date', FieldType.DATE, 'input.assessment_date', true, 'Assessment Date', { status: MappingStatus.USER_INPUT }),
  m(6, COMRA_FORM_ID, COMRA_NAME, 'risk_score', FieldType.TEXT, 'input.risk_score', true, 'Risk Score', { status: MappingStatus.USER_INPUT, help_text: 'Score from COMRA risk questionnaire.' }),
  m(7, COMRA_FORM_ID, COMRA_NAME, 'risk_tolerance', FieldType.TEXT, 'input.risk_tolerance', true, 'Risk Tolerance', { status: MappingStatus.USER_INPUT, input_type: InputType.DROPDOWN, options: ['Conservative', 'Moderately Conservative', 'Moderate', 'Moderately Aggressive', 'Aggressive'] }),
  m(8, COMRA_FORM_ID, COMRA_NAME, 'time_horizon', FieldType.TEXT, 'input.time_horizon', true, 'Time Horizon', { status: MappingStatus.USER_INPUT, input_type: InputType.DROPDOWN, options: ['< 3 years', '4-6 years', '7-10 years', '> 10 years'] }),
  m(9, COMRA_FORM_ID, COMRA_NAME, 'investment_experience', FieldType.TEXT, 'input.investment_experience', false, 'Investment Experience', { status: MappingStatus.USER_INPUT, input_type: InputType.DROPDOWN, options: ['None', 'Limited', 'Moderate', 'Extensive'] }),
  m(10, COMRA_FORM_ID, COMRA_NAME, 'investment_objective', FieldType.TEXT, 'input.investment_objective', true, 'Investment Objective', { status: MappingStatus.USER_INPUT, input_type: InputType.DROPDOWN, options: ['Preservation of Capital', 'Income', 'Growth and Income', 'Growth', 'Speculation'] }),
]

// ============================================================================
// IAA Mappings (FORM_0012) — Advisory Agreement
// ============================================================================

const IAA_FORM_ID = 'FORM_0012'
const IAA_NAME = 'Investment Advisory Agreement (IAA)'

const IAA_MAPPINGS: MappingEntry[] = [
  m(1, IAA_FORM_ID, IAA_NAME, 'client_name', FieldType.TEXT, 'client.display_name', true, 'Client Name'),
  m(2, IAA_FORM_ID, IAA_NAME, 'account_title', FieldType.TEXT, 'account.account_title', true, 'Account Title'),
  m(3, IAA_FORM_ID, IAA_NAME, 'account_number', FieldType.TEXT, 'account.account_number', false, 'Account Number'),
  m(4, IAA_FORM_ID, IAA_NAME, 'advisory_fee', FieldType.PERCENT, 'input.advisory_fee', true, 'Advisory Fee %', { status: MappingStatus.USER_INPUT }),
  m(5, IAA_FORM_ID, IAA_NAME, 'assets_under_management', FieldType.CURRENCY, 'input.aum', true, 'Assets Under Management', { status: MappingStatus.USER_INPUT, notes: 'Should match CAF Total Investable for GWM.' }),
  m(6, IAA_FORM_ID, IAA_NAME, 'advisor_name', FieldType.TEXT, 'advisor.display_name', true, 'Advisor Name'),
  m(7, IAA_FORM_ID, IAA_NAME, 'advisor_crd', FieldType.TEXT, 'advisor.crd_number', true, 'Advisor CRD'),
  m(8, IAA_FORM_ID, IAA_NAME, 'firm_name', FieldType.TEXT, 'firm.name_gwm', true, 'Firm Name', { default_value: 'Gradient Wealth Management' }),
  m(9, IAA_FORM_ID, IAA_NAME, 'effective_date', FieldType.DATE, 'input.effective_date', true, 'Effective Date', { status: MappingStatus.USER_INPUT }),
  m(10, IAA_FORM_ID, IAA_NAME, 'fee_schedule', FieldType.TEXT, 'input.fee_schedule', false, 'Fee Schedule', { status: MappingStatus.USER_INPUT, input_type: InputType.TEXTAREA }),
]

// ============================================================================
// Schwab LPOA Mappings (FORM_0014)
// ============================================================================

const LPOA_FORM_ID = 'FORM_0014'
const LPOA_NAME = 'Schwab LPOA (Limited Power of Attorney)'

const LPOA_MAPPINGS: MappingEntry[] = [
  m(1, LPOA_FORM_ID, LPOA_NAME, 'account_number', FieldType.TEXT, 'account.account_number', true, 'Account Number'),
  m(2, LPOA_FORM_ID, LPOA_NAME, 'account_title', FieldType.TEXT, 'account.account_title', true, 'Account Title'),
  m(3, LPOA_FORM_ID, LPOA_NAME, 'client_name', FieldType.TEXT, 'client.display_name', true, 'Client Name'),
  m(4, LPOA_FORM_ID, LPOA_NAME, 'advisor_name', FieldType.TEXT, 'advisor.display_name', true, 'Advisor Name'),
  m(5, LPOA_FORM_ID, LPOA_NAME, 'advisor_crd', FieldType.TEXT, 'advisor.crd_number', true, 'Advisor CRD'),
  m(6, LPOA_FORM_ID, LPOA_NAME, 'firm_name', FieldType.TEXT, 'firm.name_gwm', true, 'Firm Name', { default_value: 'Gradient Wealth Management' }),
  m(7, LPOA_FORM_ID, LPOA_NAME, 'firm_address', FieldType.TEXT, 'firm.address', true, 'Firm Address'),
  m(8, LPOA_FORM_ID, LPOA_NAME, 'date', FieldType.DATE, 'input.effective_date', true, 'Effective Date', { status: MappingStatus.USER_INPUT }),
]

// ============================================================================
// Aggregate all mappings
// ============================================================================

const ALL_MAPPINGS: MappingEntry[] = [
  ...CAF_MAPPINGS,
  ...TAF_MAPPINGS,
  ...COMRA_MAPPINGS,
  ...IAA_MAPPINGS,
  ...LPOA_MAPPINGS,
]

// ============================================================================
// CLI
// ============================================================================

interface CliArgs {
  all: boolean
  dryRun: boolean
  form?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { all: false, dryRun: false }

  for (const arg of args) {
    if (arg === '--all') result.all = true
    else if (arg === '--dry-run') result.dryRun = true
    else if (arg.startsWith('--form=')) {
      result.form = arg.split('=')[1]
    }
  }

  return result
}

// ============================================================================
// Seed Logic
// ============================================================================

async function seedMappings(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean,
  formFilter?: string,
): Promise<number> {
  const now = new Date().toISOString()

  const mappings = formFilter
    ? ALL_MAPPINGS.filter((m) => m.form_id === formFilter)
    : ALL_MAPPINGS

  if (mappings.length === 0) {
    console.log(`  No mappings found${formFilter ? ` for form ${formFilter}` : ''}`)
    return 0
  }

  const writes = mappings.map((mapping) => ({
    docId: mapping.mapping_id,
    data: {
      ...mapping,
      created_at: now,
      updated_at: now,
      _created_by: 'seed-dex-mappings',
    },
  }))

  if (dryRun) {
    console.log(`[DRY RUN] Would write ${writes.length} docs to ${COLLECTIONS.FIELD_MAPPINGS}:`)
    // Group by form for readability
    const byForm: Record<string, number> = {}
    for (const mapping of mappings) {
      byForm[`${mapping.form_id} (${mapping.form_name})`] = (byForm[`${mapping.form_id} (${mapping.form_name})`] || 0) + 1
    }
    for (const [form, count] of Object.entries(byForm)) {
      console.log(`  ${form}: ${count} fields`)
    }
    return writes.length
  }

  // Batched writes
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_LIMIT)

    for (const w of chunk) {
      const ref = db.collection(COLLECTIONS.FIELD_MAPPINGS).doc(w.docId)
      batch.set(ref, w.data)
    }

    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} docs)`)
  }

  return writes.length
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  if (!args.all && !args.form) {
    console.error('Usage:')
    console.error('  npx tsx services/api/src/scripts/seed-dex-mappings.ts --all')
    console.error('  npx tsx services/api/src/scripts/seed-dex-mappings.ts --form=FORM_0002')
    console.error('  npx tsx services/api/src/scripts/seed-dex-mappings.ts --all --dry-run')
    process.exit(1)
  }

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      initializeApp({ credential: cert(serviceAccount) })
    } else {
      initializeApp()
    }
  }
  const db = getFirestore()

  console.log(`\nSeeding DEX field mappings${args.form ? ` (form: ${args.form})` : ' (all forms)'}${args.dryRun ? ' [DRY RUN]' : ''}...\n`)

  const count = await seedMappings(db, args.dryRun, args.form)

  // Print summary
  const byForm: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const filtered = args.form ? ALL_MAPPINGS.filter((m) => m.form_id === args.form) : ALL_MAPPINGS
  for (const mapping of filtered) {
    byForm[mapping.form_name] = (byForm[mapping.form_name] || 0) + 1
    byStatus[mapping.status] = (byStatus[mapping.status] || 0) + 1
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`TOTAL: ${count} field mappings seeded to ${COLLECTIONS.FIELD_MAPPINGS}`)
  console.log('')
  console.log('By form:')
  for (const [form, n] of Object.entries(byForm).sort()) {
    console.log(`  ${form}: ${n} fields`)
  }
  console.log('')
  console.log('By status:')
  for (const [st, n] of Object.entries(byStatus).sort()) {
    console.log(`  ${st}: ${n}`)
  }
  if (args.dryRun) console.log('\n[DRY RUN - no data was written to Firestore]')
  console.log('')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
