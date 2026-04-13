/**
 * Seed script: Load 300+ DEX field mappings into Firestore dex_field_mappings.
 * Full 15-column schema: mapping_id, form_id, form_name, field_name, field_type,
 * data_source, required, default_value, notes, status, input_type, options, label,
 * help_text, validation.
 *
 * Run: npx tsx scripts/seed-dex-mappings.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const COLLECTION = 'dex_field_mappings'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Mapping {
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
  options: string
  label: string
  help_text: string
  validation: string
}

function m(
  mapping_id: string,
  form_id: string,
  form_name: string,
  field_name: string,
  field_type: string,
  data_source: string,
  required: boolean,
  input_type: string,
  label: string,
  opts?: {
    default_value?: string
    notes?: string
    options?: string[]
    help_text?: string
    validation?: Record<string, unknown>
  },
): Mapping {
  const o = opts || {}
  return {
    mapping_id,
    form_id,
    form_name,
    field_name,
    field_type,
    data_source,
    required,
    default_value: o.default_value || '',
    notes: o.notes || '',
    status: 'ACTIVE',
    input_type,
    options: o.options ? JSON.stringify(o.options) : '',
    label,
    help_text: o.help_text || '',
    validation: o.validation ? JSON.stringify(o.validation) : '',
  }
}

// ---------------------------------------------------------------------------
// Common person fields (reused across many forms)
// ---------------------------------------------------------------------------
function personBlock(prefix: string, form_id: string, form_name: string, startIdx: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'first_name', 'text', 'client.first_name', true, 'text', 'First Name'),
    m(p(startIdx + 1), form_id, form_name, 'middle_name', 'text', 'client.middle_name', false, 'text', 'Middle Name'),
    m(p(startIdx + 2), form_id, form_name, 'last_name', 'text', 'client.last_name', true, 'text', 'Last Name'),
    m(p(startIdx + 3), form_id, form_name, 'suffix', 'text', 'client.suffix', false, 'dropdown', 'Suffix', { options: ['Jr.', 'Sr.', 'II', 'III', 'IV'] }),
    m(p(startIdx + 4), form_id, form_name, 'dob', 'date', 'client.dob', true, 'date', 'Date of Birth', { help_text: 'MM/DD/YYYY format' }),
    m(p(startIdx + 5), form_id, form_name, 'ssn', 'ssn', 'input.ssn', true, 'ssn', 'Social Security Number', { help_text: 'Will be masked on display', validation: { required: true, pattern: '^\\d{3}-?\\d{2}-?\\d{4}$' } }),
    m(p(startIdx + 6), form_id, form_name, 'gender', 'text', 'client.gender', false, 'radio', 'Gender', { options: ['Male', 'Female', 'Other', 'Prefer not to say'] }),
    m(p(startIdx + 7), form_id, form_name, 'marital_status', 'text', 'client.marital_status', false, 'dropdown', 'Marital Status', { options: ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic Partner'] }),
    m(p(startIdx + 8), form_id, form_name, 'citizenship', 'text', 'client.citizenship', true, 'dropdown', 'Citizenship', { options: ['US Citizen', 'Permanent Resident', 'Non-Resident Alien'], default_value: 'US Citizen' }),
  ]
}

function addressBlock(prefix: string, form_id: string, form_name: string, startIdx: number, source = 'client'): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'address_line1', 'text', `${source}.address`, true, 'text', 'Street Address'),
    m(p(startIdx + 1), form_id, form_name, 'address_line2', 'text', `${source}.address2`, false, 'text', 'Apt/Suite/Unit'),
    m(p(startIdx + 2), form_id, form_name, 'city', 'text', `${source}.city`, true, 'text', 'City'),
    m(p(startIdx + 3), form_id, form_name, 'state', 'text', `${source}.state`, true, 'state', 'State'),
    m(p(startIdx + 4), form_id, form_name, 'zip', 'text', `${source}.zip`, true, 'text', 'ZIP Code', { validation: { required: true, pattern: '^\\d{5}(-\\d{4})?$' } }),
    m(p(startIdx + 5), form_id, form_name, 'country', 'text', `${source}.country`, false, 'text', 'Country', { default_value: 'US' }),
  ]
}

function contactBlock(prefix: string, form_id: string, form_name: string, startIdx: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'phone_home', 'phone', 'client.phone', false, 'phone', 'Home Phone'),
    m(p(startIdx + 1), form_id, form_name, 'phone_mobile', 'phone', 'client.mobile', false, 'phone', 'Mobile Phone'),
    m(p(startIdx + 2), form_id, form_name, 'phone_business', 'phone', 'client.work_phone', false, 'phone', 'Business Phone'),
    m(p(startIdx + 3), form_id, form_name, 'email', 'email', 'client.email', false, 'email', 'Email Address'),
  ]
}

function employmentBlock(prefix: string, form_id: string, form_name: string, startIdx: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'employment_status', 'text', 'client.employment_status', true, 'dropdown', 'Employment Status', { options: ['Employed', 'Self-Employed', 'Retired', 'Unemployed', 'Student'] }),
    m(p(startIdx + 1), form_id, form_name, 'employer_name', 'text', 'client.employer', false, 'text', 'Employer Name', { help_text: 'Required if employed' }),
    m(p(startIdx + 2), form_id, form_name, 'occupation', 'text', 'client.occupation', false, 'text', 'Occupation'),
    m(p(startIdx + 3), form_id, form_name, 'years_employed', 'text', 'client.years_employed', false, 'text', 'Years Employed'),
  ]
}

function idBlock(prefix: string, form_id: string, form_name: string, startIdx: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'id_type', 'text', 'input.id_type', true, 'dropdown', 'ID Type', { options: ['Driver License', 'State ID', 'Passport', 'Military ID'] }),
    m(p(startIdx + 1), form_id, form_name, 'id_number', 'text', 'input.id_number', true, 'text', 'ID Number'),
    m(p(startIdx + 2), form_id, form_name, 'id_state', 'text', 'input.id_state', false, 'state', 'Issuing State'),
    m(p(startIdx + 3), form_id, form_name, 'id_expiration', 'date', 'input.id_expiration', true, 'date', 'ID Expiration Date'),
  ]
}

function beneficiaryBlock(prefix: string, form_id: string, form_name: string, startIdx: number, num: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  const label = num === 1 ? 'Primary' : `Contingent ${num - 1}`
  const off = (num - 1) * 5
  return [
    m(p(startIdx + off), form_id, form_name, `beneficiary_${num}_name`, 'text', `input.bene_${num}_name`, num === 1, 'text', `${label} Beneficiary Name`),
    m(p(startIdx + off + 1), form_id, form_name, `beneficiary_${num}_type`, 'text', `input.bene_${num}_type`, num === 1, 'dropdown', `${label} Beneficiary Type`, { options: ['Primary', 'Contingent'] }),
    m(p(startIdx + off + 2), form_id, form_name, `beneficiary_${num}_relationship`, 'text', `input.bene_${num}_rel`, num === 1, 'dropdown', `${label} Relationship`, { options: ['Spouse', 'Child', 'Parent', 'Sibling', 'Other Family', 'Non-Family', 'Trust', 'Estate', 'Charity'] }),
    m(p(startIdx + off + 3), form_id, form_name, `beneficiary_${num}_percentage`, 'percent', `input.bene_${num}_pct`, num === 1, 'percent', `${label} Percentage`, { validation: { required: num === 1, min: 0, max: 100 } }),
    m(p(startIdx + off + 4), form_id, form_name, `beneficiary_${num}_dob`, 'date', `input.bene_${num}_dob`, false, 'date', `${label} Date of Birth`),
  ]
}

function firmBlock(prefix: string, form_id: string, form_name: string, startIdx: number, firmSuffix = ''): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  const nameKey = firmSuffix ? `firm.name_${firmSuffix}` : 'firm.name'
  const crdKey = firmSuffix ? `firm.crd_${firmSuffix}` : 'firm.crd_gs'
  return [
    m(p(startIdx), form_id, form_name, 'firm_name', 'text', nameKey, true, 'text', 'Firm Name'),
    m(p(startIdx + 1), form_id, form_name, 'firm_crd', 'text', crdKey, true, 'text', 'Firm CRD'),
    m(p(startIdx + 2), form_id, form_name, 'firm_address', 'text', 'firm.address', true, 'text', 'Firm Address'),
    m(p(startIdx + 3), form_id, form_name, 'firm_city', 'text', 'firm.city', true, 'text', 'Firm City'),
    m(p(startIdx + 4), form_id, form_name, 'firm_state', 'text', 'firm.state', true, 'state', 'Firm State'),
    m(p(startIdx + 5), form_id, form_name, 'firm_zip', 'text', 'firm.zip', true, 'text', 'Firm ZIP'),
    m(p(startIdx + 6), form_id, form_name, 'firm_phone', 'phone', 'firm.phone', true, 'phone', 'Firm Phone'),
  ]
}

function advisorBlock(prefix: string, form_id: string, form_name: string, startIdx: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'advisor_name', 'text', 'advisor.name', true, 'text', 'Advisor Name'),
    m(p(startIdx + 1), form_id, form_name, 'advisor_crd', 'text', 'advisor.crd_number', true, 'text', 'Advisor CRD'),
    m(p(startIdx + 2), form_id, form_name, 'advisor_email', 'email', 'advisor.email', false, 'email', 'Advisor Email'),
    m(p(startIdx + 3), form_id, form_name, 'advisor_phone', 'phone', 'advisor.phone', false, 'phone', 'Advisor Phone'),
  ]
}

function signatureBlock(prefix: string, form_id: string, form_name: string, startIdx: number): Mapping[] {
  const p = (i: number) => `${prefix}${String(i).padStart(3, '0')}`
  return [
    m(p(startIdx), form_id, form_name, 'client_signature', 'signature', 'input.client_sig', true, 'signature', 'Client Signature'),
    m(p(startIdx + 1), form_id, form_name, 'client_signature_date', 'date', 'input.client_sig_date', true, 'date', 'Client Signature Date'),
    m(p(startIdx + 2), form_id, form_name, 'advisor_signature', 'signature', 'input.advisor_sig', true, 'signature', 'Advisor Signature'),
    m(p(startIdx + 3), form_id, form_name, 'advisor_signature_date', 'date', 'input.advisor_sig_date', true, 'date', 'Advisor Signature Date'),
  ]
}

// ---------------------------------------------------------------------------
// Full 300+ field mapping dataset
// ---------------------------------------------------------------------------

const ALL_MAPPINGS: Mapping[] = [
  // =========================================================================
  // FORM_0001 — Client Account Form (Firm:Client)
  // 40 fields: person + address + contact + employment + ID + financials + sigs
  // =========================================================================
  ...personBlock('MAP_0001_', 'FORM_0001', 'Client Account Form', 1),
  ...addressBlock('MAP_0001_', 'FORM_0001', 'Client Account Form', 10),
  ...contactBlock('MAP_0001_', 'FORM_0001', 'Client Account Form', 16),
  ...employmentBlock('MAP_0001_', 'FORM_0001', 'Client Account Form', 20),
  ...idBlock('MAP_0001_', 'FORM_0001', 'Client Account Form', 24),
  m('MAP_0001_028', 'FORM_0001', 'Client Account Form', 'annual_income', 'currency', 'client.annual_income', true, 'currency', 'Annual Income', { validation: { required: true, min: 0 } }),
  m('MAP_0001_029', 'FORM_0001', 'Client Account Form', 'net_worth', 'currency', 'client.net_worth', true, 'currency', 'Net Worth', { validation: { required: true, min: 0 } }),
  m('MAP_0001_030', 'FORM_0001', 'Client Account Form', 'liquid_net_worth', 'currency', 'client.liquid_net_worth', true, 'currency', 'Liquid Net Worth', { validation: { required: true, min: 0 } }),
  m('MAP_0001_031', 'FORM_0001', 'Client Account Form', 'tax_bracket', 'percent', 'client.tax_bracket', false, 'percent', 'Tax Bracket %'),
  m('MAP_0001_032', 'FORM_0001', 'Client Account Form', 'investment_experience', 'text', 'client.investment_experience', true, 'dropdown', 'Investment Experience', { options: ['None', 'Limited (1-3 yrs)', 'Moderate (3-10 yrs)', 'Extensive (10+ yrs)'] }),
  m('MAP_0001_033', 'FORM_0001', 'Client Account Form', 'risk_tolerance', 'text', 'client.risk_tolerance', true, 'radio', 'Risk Tolerance', { options: ['Conservative', 'Moderate', 'Aggressive', 'Speculative'] }),
  m('MAP_0001_034', 'FORM_0001', 'Client Account Form', 'investment_objective', 'text', 'client.investment_objective', true, 'dropdown', 'Investment Objective', { options: ['Capital Preservation', 'Income', 'Growth & Income', 'Growth', 'Speculation'] }),
  m('MAP_0001_035', 'FORM_0001', 'Client Account Form', 'time_horizon', 'text', 'client.time_horizon', true, 'dropdown', 'Time Horizon', { options: ['Short-term (0-3 yrs)', 'Medium-term (3-7 yrs)', 'Long-term (7+ yrs)'] }),
  m('MAP_0001_036', 'FORM_0001', 'Client Account Form', 'account_type', 'text', 'input.registration_type', true, 'dropdown', 'Account Type', { options: ['Traditional IRA', 'Roth IRA', 'Individual', 'Joint WROS', 'Trust', '401k/ERISA'] }),
  m('MAP_0001_037', 'FORM_0001', 'Client Account Form', 'politically_exposed', 'text', 'input.pep', true, 'radio', 'Politically Exposed Person', { options: ['Yes', 'No'], default_value: 'No', help_text: 'Are you or a family member a senior political figure?' }),
  m('MAP_0001_038', 'FORM_0001', 'Client Account Form', 'industry_affiliated', 'text', 'input.finra_affiliated', true, 'radio', 'FINRA/Exchange Affiliated', { options: ['Yes', 'No'], default_value: 'No' }),
  ...signatureBlock('MAP_0001_', 'FORM_0001', 'Client Account Form', 39),

  // =========================================================================
  // FORM_0002 — Legal Entity Client Account Form
  // 20 fields: entity info + authorized signer + sigs
  // =========================================================================
  m('MAP_0002_001', 'FORM_0002', 'Legal Entity Client Account Form', 'entity_name', 'text', 'client.entity_name', true, 'text', 'Entity Name'),
  m('MAP_0002_002', 'FORM_0002', 'Legal Entity Client Account Form', 'entity_type', 'text', 'input.entity_type', true, 'dropdown', 'Entity Type', { options: ['Corporation', 'LLC', 'Partnership', 'Trust', 'Non-Profit', 'Government', 'Other'] }),
  m('MAP_0002_003', 'FORM_0002', 'Legal Entity Client Account Form', 'ein', 'text', 'input.ein', true, 'text', 'EIN/Tax ID', { validation: { required: true, pattern: '^\\d{2}-?\\d{7}$' } }),
  m('MAP_0002_004', 'FORM_0002', 'Legal Entity Client Account Form', 'state_of_formation', 'text', 'input.state_of_formation', true, 'state', 'State of Formation'),
  m('MAP_0002_005', 'FORM_0002', 'Legal Entity Client Account Form', 'date_of_formation', 'date', 'input.date_of_formation', true, 'date', 'Date of Formation'),
  ...addressBlock('MAP_0002_', 'FORM_0002', 'Legal Entity Client Account Form', 6),
  m('MAP_0002_012', 'FORM_0002', 'Legal Entity Client Account Form', 'authorized_signer_name', 'text', 'input.auth_signer_name', true, 'text', 'Authorized Signer Name'),
  m('MAP_0002_013', 'FORM_0002', 'Legal Entity Client Account Form', 'authorized_signer_title', 'text', 'input.auth_signer_title', true, 'text', 'Signer Title'),
  m('MAP_0002_014', 'FORM_0002', 'Legal Entity Client Account Form', 'authorized_signer_phone', 'phone', 'input.auth_signer_phone', true, 'phone', 'Signer Phone'),
  m('MAP_0002_015', 'FORM_0002', 'Legal Entity Client Account Form', 'authorized_signer_email', 'email', 'input.auth_signer_email', true, 'email', 'Signer Email'),
  m('MAP_0002_016', 'FORM_0002', 'Legal Entity Client Account Form', 'purpose_of_account', 'text', 'input.purpose', true, 'dropdown', 'Purpose of Account', { options: ['Investment', 'Operating', 'Retirement Plan', 'Trust Administration'] }),
  ...signatureBlock('MAP_0002_', 'FORM_0002', 'Legal Entity Client Account Form', 17),

  // =========================================================================
  // FORM_0003 — COMRA
  // 15 fields
  // =========================================================================
  m('MAP_0003_001', 'FORM_0003', 'COMRA', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0003_002', 'FORM_0003', 'COMRA', 'client_ssn', 'ssn', 'input.ssn', true, 'ssn', 'SSN'),
  m('MAP_0003_003', 'FORM_0003', 'COMRA', 'previous_carrier', 'text', 'account.previous_carrier', false, 'text', 'Previous Carrier'),
  m('MAP_0003_004', 'FORM_0003', 'COMRA', 'policy_number', 'text', 'account.policy_number', false, 'text', 'Policy/Account Number'),
  m('MAP_0003_005', 'FORM_0003', 'COMRA', 'product_transferred', 'text', 'account.product_type', true, 'text', 'Product Type'),
  m('MAP_0003_006', 'FORM_0003', 'COMRA', 'transfer_type', 'text', 'input.transfer_type', true, 'dropdown', 'Transfer Type', { options: ['Full', 'Partial'] }),
  m('MAP_0003_007', 'FORM_0003', 'COMRA', 'transfer_amount', 'currency', 'input.transfer_amount', false, 'currency', 'Transfer Amount', { help_text: 'Required for partial transfers' }),
  m('MAP_0003_008', 'FORM_0003', 'COMRA', 'reason_for_transfer', 'text', 'input.transfer_reason', false, 'dropdown', 'Reason', { options: ['Better service', 'Better products', 'Fee reduction', 'Advisor recommendation', 'Other'] }),
  ...firmBlock('MAP_0003_', 'FORM_0003', 'COMRA', 9),
  ...signatureBlock('MAP_0003_', 'FORM_0003', 'COMRA', 12, ),

  // =========================================================================
  // FORM_0010 — GWM TAF
  // 15 fields
  // =========================================================================
  ...firmBlock('MAP_0010_', 'FORM_0010', 'Gradient Wealth Management TAF', 1, 'gwm'),
  ...advisorBlock('MAP_0010_', 'FORM_0010', 'Gradient Wealth Management TAF', 8),
  m('MAP_0010_012', 'FORM_0010', 'Gradient Wealth Management TAF', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0010_013', 'FORM_0010', 'Gradient Wealth Management TAF', 'account_number', 'text', 'account.account_number', false, 'text', 'Account Number'),
  m('MAP_0010_014', 'FORM_0010', 'Gradient Wealth Management TAF', 'transaction_description', 'text', 'input.transaction_desc', true, 'textarea', 'Transaction Description'),
  ...signatureBlock('MAP_0010_', 'FORM_0010', 'Gradient Wealth Management TAF', 15),

  // =========================================================================
  // FORM_0011 — Investment Advisory Agreement
  // 12 fields
  // =========================================================================
  m('MAP_0011_001', 'FORM_0011', 'Investment Advisory Agreement', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0011_002', 'FORM_0011', 'Investment Advisory Agreement', 'effective_date', 'date', 'account.effective_date', true, 'date', 'Effective Date'),
  m('MAP_0011_003', 'FORM_0011', 'Investment Advisory Agreement', 'fee_percent', 'percent', 'account.fee_percent', true, 'percent', 'Advisory Fee %', { validation: { required: true, min: 0, max: 3 }, help_text: 'Annual advisory fee as percentage' }),
  m('MAP_0011_004', 'FORM_0011', 'Investment Advisory Agreement', 'fee_schedule', 'text', 'input.fee_schedule', true, 'dropdown', 'Fee Schedule', { options: ['Quarterly in Advance', 'Quarterly in Arrears', 'Monthly'] }),
  m('MAP_0011_005', 'FORM_0011', 'Investment Advisory Agreement', 'assets_under_mgmt', 'currency', 'input.aum', true, 'currency', 'Assets Under Management'),
  m('MAP_0011_006', 'FORM_0011', 'Investment Advisory Agreement', 'investment_strategy', 'text', 'input.strategy', true, 'dropdown', 'Investment Strategy', { options: ['Conservative', 'Balanced', 'Growth', 'Aggressive Growth', 'Custom'] }),
  m('MAP_0011_007', 'FORM_0011', 'Investment Advisory Agreement', 'discretionary', 'text', 'input.discretionary', true, 'radio', 'Discretionary Authority', { options: ['Yes', 'No'], help_text: 'Can advisor trade without prior client approval?' }),
  m('MAP_0011_008', 'FORM_0011', 'Investment Advisory Agreement', 'trading_auth', 'text', 'input.trading_auth', true, 'checkbox', 'Trading Authorization Granted'),
  ...signatureBlock('MAP_0011_', 'FORM_0011', 'Investment Advisory Agreement', 9),

  // =========================================================================
  // FORM_0012 — GI Disclosure Statement
  // 6 fields
  // =========================================================================
  m('MAP_0012_001', 'FORM_0012', 'GI Disclosure Statement', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0012_002', 'FORM_0012', 'GI Disclosure Statement', 'date_received', 'date', 'input.date_received', true, 'date', 'Date Received'),
  m('MAP_0012_003', 'FORM_0012', 'GI Disclosure Statement', 'acknowledged', 'checkbox', 'input.disclosure_ack', true, 'checkbox', 'Client Acknowledges Receipt'),
  ...signatureBlock('MAP_0012_', 'FORM_0012', 'GI Disclosure Statement', 4).slice(0, 2),

  // =========================================================================
  // FORM_0013 — GI Investment Proposal
  // 10 fields
  // =========================================================================
  m('MAP_0013_001', 'FORM_0013', 'GI Investment Proposal', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0013_002', 'FORM_0013', 'GI Investment Proposal', 'proposal_date', 'date', 'input.proposal_date', true, 'date', 'Proposal Date'),
  m('MAP_0013_003', 'FORM_0013', 'GI Investment Proposal', 'investment_amount', 'currency', 'input.investment_amount', true, 'currency', 'Investment Amount'),
  m('MAP_0013_004', 'FORM_0013', 'GI Investment Proposal', 'proposed_allocation', 'text', 'input.allocation', true, 'textarea', 'Proposed Allocation', { help_text: 'Describe asset allocation breakdown' }),
  m('MAP_0013_005', 'FORM_0013', 'GI Investment Proposal', 'risk_profile', 'text', 'client.risk_tolerance', true, 'dropdown', 'Risk Profile', { options: ['Conservative', 'Moderate', 'Aggressive', 'Speculative'] }),
  m('MAP_0013_006', 'FORM_0013', 'GI Investment Proposal', 'time_horizon', 'text', 'client.time_horizon', true, 'dropdown', 'Time Horizon', { options: ['Short-term', 'Medium-term', 'Long-term'] }),
  ...signatureBlock('MAP_0013_', 'FORM_0013', 'GI Investment Proposal', 7),

  // =========================================================================
  // FORM_0020 — RBC TAF
  // 14 fields
  // =========================================================================
  ...firmBlock('MAP_0020_', 'FORM_0020', 'RBC TAF', 1),
  ...advisorBlock('MAP_0020_', 'FORM_0020', 'RBC TAF', 8),
  m('MAP_0020_012', 'FORM_0020', 'RBC TAF', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0020_013', 'FORM_0020', 'RBC TAF', 'transaction_type', 'text', 'input.transaction_type', true, 'dropdown', 'Transaction Type', { options: ['New Account', 'Transfer', 'Distribution', 'Contribution', 'Rebalance'] }),
  ...signatureBlock('MAP_0020_', 'FORM_0020', 'RBC TAF', 14),

  // =========================================================================
  // FORM_0030 — SchwabOne Account Application
  // 30 fields
  // =========================================================================
  ...personBlock('MAP_0030_', 'FORM_0030', 'SchwabOne Account Application', 1),
  ...addressBlock('MAP_0030_', 'FORM_0030', 'SchwabOne Account Application', 10),
  ...contactBlock('MAP_0030_', 'FORM_0030', 'SchwabOne Account Application', 16),
  ...employmentBlock('MAP_0030_', 'FORM_0030', 'SchwabOne Account Application', 20),
  ...idBlock('MAP_0030_', 'FORM_0030', 'SchwabOne Account Application', 24),
  ...signatureBlock('MAP_0030_', 'FORM_0030', 'SchwabOne Account Application', 28),

  // =========================================================================
  // FORM_0031 — Schwab IRA Account Application
  // 30 fields
  // =========================================================================
  ...personBlock('MAP_0031_', 'FORM_0031', 'Schwab IRA Account Application', 1),
  ...addressBlock('MAP_0031_', 'FORM_0031', 'Schwab IRA Account Application', 10),
  ...contactBlock('MAP_0031_', 'FORM_0031', 'Schwab IRA Account Application', 16),
  m('MAP_0031_020', 'FORM_0031', 'Schwab IRA Account Application', 'ira_type', 'text', 'input.registration_type', true, 'dropdown', 'IRA Type', { options: ['Traditional IRA', 'Roth IRA', 'SEP IRA', 'SIMPLE IRA'] }),
  m('MAP_0031_021', 'FORM_0031', 'Schwab IRA Account Application', 'contribution_year', 'text', 'input.contribution_year', false, 'text', 'Contribution Year'),
  m('MAP_0031_022', 'FORM_0031', 'Schwab IRA Account Application', 'contribution_amount', 'currency', 'input.contribution_amount', false, 'currency', 'Contribution Amount'),
  ...beneficiaryBlock('MAP_0031_', 'FORM_0031', 'Schwab IRA Account Application', 23, 1),
  ...beneficiaryBlock('MAP_0031_', 'FORM_0031', 'Schwab IRA Account Application', 23, 2),
  ...signatureBlock('MAP_0031_', 'FORM_0031', 'Schwab IRA Account Application', 34),

  // =========================================================================
  // FORM_0033 — ACAT Transfer (Schwab)
  // 12 fields
  // =========================================================================
  m('MAP_0033_001', 'FORM_0033', 'Account Transfer - ACAT', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0033_002', 'FORM_0033', 'Account Transfer - ACAT', 'current_custodian', 'text', 'account.custodian', true, 'text', 'Current Custodian'),
  m('MAP_0033_003', 'FORM_0033', 'Account Transfer - ACAT', 'current_account_number', 'text', 'account.account_number', true, 'text', 'Current Account Number'),
  m('MAP_0033_004', 'FORM_0033', 'Account Transfer - ACAT', 'transfer_type', 'text', 'input.transfer_type', true, 'radio', 'Transfer Type', { options: ['Full', 'Partial'] }),
  m('MAP_0033_005', 'FORM_0033', 'Account Transfer - ACAT', 'receiving_account', 'text', 'input.receiving_account', false, 'text', 'Receiving Account Number'),
  m('MAP_0033_006', 'FORM_0033', 'Account Transfer - ACAT', 'transfer_date', 'date', 'input.transfer_date', true, 'date', 'Requested Transfer Date'),
  m('MAP_0033_007', 'FORM_0033', 'Account Transfer - ACAT', 'registration_match', 'text', 'input.reg_match', true, 'radio', 'Registration Match', { options: ['Yes', 'No'], help_text: 'Does the receiving account registration match?' }),
  m('MAP_0033_008', 'FORM_0033', 'Account Transfer - ACAT', 'special_instructions', 'text', 'input.special_instructions', false, 'textarea', 'Special Instructions'),
  ...signatureBlock('MAP_0033_', 'FORM_0033', 'Account Transfer - ACAT', 9),

  // =========================================================================
  // FORM_0034 — Transfer on Death Beneficiary (Schwab)
  // 15 fields (3 beneficiaries)
  // =========================================================================
  m('MAP_0034_001', 'FORM_0034', 'Transfer on Death Beneficiary', 'account_number', 'text', 'account.account_number', true, 'text', 'Account Number'),
  m('MAP_0034_002', 'FORM_0034', 'Transfer on Death Beneficiary', 'account_holder', 'text', 'client.full_name', true, 'text', 'Account Holder Name'),
  ...beneficiaryBlock('MAP_0034_', 'FORM_0034', 'Transfer on Death Beneficiary', 3, 1),
  ...beneficiaryBlock('MAP_0034_', 'FORM_0034', 'Transfer on Death Beneficiary', 3, 2),
  ...signatureBlock('MAP_0034_', 'FORM_0034', 'Transfer on Death Beneficiary', 14).slice(0, 2),

  // =========================================================================
  // FORM_0041 — Carrier Application
  // 25 fields
  // =========================================================================
  ...personBlock('MAP_0041_', 'FORM_0041', 'Carrier Application', 1),
  ...addressBlock('MAP_0041_', 'FORM_0041', 'Carrier Application', 10),
  ...contactBlock('MAP_0041_', 'FORM_0041', 'Carrier Application', 16),
  m('MAP_0041_020', 'FORM_0041', 'Carrier Application', 'product_name', 'text', 'account.product_name', true, 'text', 'Product Name'),
  m('MAP_0041_021', 'FORM_0041', 'Carrier Application', 'premium_amount', 'currency', 'input.premium', true, 'currency', 'Premium Amount'),
  m('MAP_0041_022', 'FORM_0041', 'Carrier Application', 'payment_mode', 'text', 'input.payment_mode', true, 'dropdown', 'Payment Mode', { options: ['Annual', 'Semi-Annual', 'Quarterly', 'Monthly', 'Single Premium'] }),
  m('MAP_0041_023', 'FORM_0041', 'Carrier Application', 'funding_source', 'text', 'input.funding_source', true, 'dropdown', 'Funding Source', { options: ['Check', 'Wire Transfer', '1035 Exchange', 'Rollover', 'Transfer'] }),
  m('MAP_0041_024', 'FORM_0041', 'Carrier Application', 'replacement', 'text', 'input.is_replacement', true, 'radio', 'Is This a Replacement?', { options: ['Yes', 'No'], help_text: 'Is this replacing an existing policy or contract?' }),
  ...signatureBlock('MAP_0041_', 'FORM_0041', 'Carrier Application', 25),

  // =========================================================================
  // FORM_0050 — Beneficiary Designation Form
  // 14 fields
  // =========================================================================
  m('MAP_0050_001', 'FORM_0050', 'Beneficiary Designation Form', 'policy_owner', 'text', 'client.full_name', true, 'text', 'Policy Owner'),
  m('MAP_0050_002', 'FORM_0050', 'Beneficiary Designation Form', 'policy_number', 'text', 'account.policy_number', true, 'text', 'Policy Number'),
  ...beneficiaryBlock('MAP_0050_', 'FORM_0050', 'Beneficiary Designation Form', 3, 1),
  ...beneficiaryBlock('MAP_0050_', 'FORM_0050', 'Beneficiary Designation Form', 3, 2),
  ...signatureBlock('MAP_0050_', 'FORM_0050', 'Beneficiary Designation Form', 14).slice(0, 2),

  // =========================================================================
  // FORM_0051 — Certificate of Investment Powers (Trust)
  // 10 fields
  // =========================================================================
  m('MAP_0051_001', 'FORM_0051', 'Certificate of Investment Powers', 'trust_name', 'text', 'input.trust_name', true, 'text', 'Trust Name'),
  m('MAP_0051_002', 'FORM_0051', 'Certificate of Investment Powers', 'trust_date', 'date', 'input.trust_date', true, 'date', 'Trust Date', { help_text: 'Date trust was established' }),
  m('MAP_0051_003', 'FORM_0051', 'Certificate of Investment Powers', 'trust_type', 'text', 'input.trust_type', true, 'dropdown', 'Trust Type', { options: ['Revocable Living Trust', 'Irrevocable Trust', 'Testamentary Trust', 'Special Needs Trust', 'Charitable Trust'] }),
  m('MAP_0051_004', 'FORM_0051', 'Certificate of Investment Powers', 'trustee_name', 'text', 'input.trustee_name', true, 'text', 'Trustee Name'),
  m('MAP_0051_005', 'FORM_0051', 'Certificate of Investment Powers', 'trustee_title', 'text', 'input.trustee_title', false, 'text', 'Trustee Title'),
  m('MAP_0051_006', 'FORM_0051', 'Certificate of Investment Powers', 'grantor_name', 'text', 'client.full_name', true, 'text', 'Grantor Name'),
  m('MAP_0051_007', 'FORM_0051', 'Certificate of Investment Powers', 'investment_powers', 'text', 'input.investment_powers', true, 'checkboxes', 'Investment Powers Granted', { options: ['Buy/Sell Securities', 'Open/Close Accounts', 'Margin Trading', 'Options Trading', 'Alternative Investments'] }),
  m('MAP_0051_008', 'FORM_0051', 'Certificate of Investment Powers', 'trustee_signature', 'signature', 'input.trustee_sig', true, 'signature', 'Trustee Signature'),
  m('MAP_0051_009', 'FORM_0051', 'Certificate of Investment Powers', 'trustee_sig_date', 'date', 'input.trustee_sig_date', true, 'date', 'Trustee Signature Date'),
  m('MAP_0051_010', 'FORM_0051', 'Certificate of Investment Powers', 'notarized', 'checkbox', 'input.notarized', false, 'checkbox', 'Notarized', { help_text: 'Check if document has been notarized' }),

  // =========================================================================
  // Disclosure forms — lightweight (signature + ack fields)
  // =========================================================================
  // FORM_0060 — GS Client Relationship Summary (CRS)
  m('MAP_0060_001', 'FORM_0060', 'GS Client Relationship Summary', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0060_002', 'FORM_0060', 'GS Client Relationship Summary', 'date_received', 'date', 'input.date_received', true, 'date', 'Date Received'),
  m('MAP_0060_003', 'FORM_0060', 'GS Client Relationship Summary', 'ack_received', 'checkbox', 'input.crs_ack', true, 'checkbox', 'Client Acknowledges Receipt'),
  m('MAP_0060_004', 'FORM_0060', 'GS Client Relationship Summary', 'client_signature', 'signature', 'input.client_sig', true, 'signature', 'Client Signature'),
  m('MAP_0060_005', 'FORM_0060', 'GS Client Relationship Summary', 'signature_date', 'date', 'input.client_sig_date', true, 'date', 'Signature Date'),

  // FORM_0061 — GI Privacy Policy
  m('MAP_0061_001', 'FORM_0061', 'GI Privacy Policy', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0061_002', 'FORM_0061', 'GI Privacy Policy', 'date_received', 'date', 'input.date_received', true, 'date', 'Date Received'),
  m('MAP_0061_003', 'FORM_0061', 'GI Privacy Policy', 'ack_received', 'checkbox', 'input.privacy_ack', true, 'checkbox', 'Client Acknowledges Receipt'),

  // FORM_0062 — GI Form CRS
  m('MAP_0062_001', 'FORM_0062', 'GI Form CRS', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0062_002', 'FORM_0062', 'GI Form CRS', 'date_received', 'date', 'input.date_received', true, 'date', 'Date Received'),
  m('MAP_0062_003', 'FORM_0062', 'GI Form CRS', 'ack_received', 'checkbox', 'input.gi_crs_ack', true, 'checkbox', 'Client Acknowledges Receipt'),

  // FORM_0063 — GI Form ADV
  m('MAP_0063_001', 'FORM_0063', 'GI Form ADV', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0063_002', 'FORM_0063', 'GI Form ADV', 'date_received', 'date', 'input.date_received', true, 'date', 'Date Received'),
  m('MAP_0063_003', 'FORM_0063', 'GI Form ADV', 'ack_received', 'checkbox', 'input.gi_adv_ack', true, 'checkbox', 'Client Acknowledges Receipt'),

  // FORM_0064 — 408(b)(2) Disclosure
  m('MAP_0064_001', 'FORM_0064', '408(b)(2) Disclosure', 'plan_name', 'text', 'input.plan_name', true, 'text', 'Plan Name'),
  m('MAP_0064_002', 'FORM_0064', '408(b)(2) Disclosure', 'plan_sponsor', 'text', 'input.plan_sponsor', true, 'text', 'Plan Sponsor'),
  m('MAP_0064_003', 'FORM_0064', '408(b)(2) Disclosure', 'service_provider', 'text', 'firm.name', true, 'text', 'Service Provider'),
  m('MAP_0064_004', 'FORM_0064', '408(b)(2) Disclosure', 'compensation_desc', 'text', 'input.compensation_desc', true, 'textarea', 'Compensation Description'),
  m('MAP_0064_005', 'FORM_0064', '408(b)(2) Disclosure', 'date_provided', 'date', 'input.date_provided', true, 'date', 'Date Provided'),

  // =========================================================================
  // RBC Forms
  // =========================================================================
  // FORM_0021 — RBC Individual/Joint
  ...personBlock('MAP_0021_', 'FORM_0021', 'RBC Individual/Joint Account Application', 1),
  ...addressBlock('MAP_0021_', 'FORM_0021', 'RBC Individual/Joint Account Application', 10),
  ...contactBlock('MAP_0021_', 'FORM_0021', 'RBC Individual/Joint Account Application', 16),
  ...signatureBlock('MAP_0021_', 'FORM_0021', 'RBC Individual/Joint Account Application', 20),

  // FORM_0022 — RBC IRA
  ...personBlock('MAP_0022_', 'FORM_0022', 'RBC IRA Account Application', 1),
  ...addressBlock('MAP_0022_', 'FORM_0022', 'RBC IRA Account Application', 10),
  m('MAP_0022_016', 'FORM_0022', 'RBC IRA Account Application', 'ira_type', 'text', 'input.registration_type', true, 'dropdown', 'IRA Type', { options: ['Traditional IRA', 'Roth IRA'] }),
  ...beneficiaryBlock('MAP_0022_', 'FORM_0022', 'RBC IRA Account Application', 17, 1),
  ...signatureBlock('MAP_0022_', 'FORM_0022', 'RBC IRA Account Application', 22),

  // FORM_0025 — RBC Beneficiary
  m('MAP_0025_001', 'FORM_0025', 'RBC Beneficiary Designation', 'account_number', 'text', 'account.account_number', true, 'text', 'Account Number'),
  m('MAP_0025_002', 'FORM_0025', 'RBC Beneficiary Designation', 'account_holder', 'text', 'client.full_name', true, 'text', 'Account Holder'),
  ...beneficiaryBlock('MAP_0025_', 'FORM_0025', 'RBC Beneficiary Designation', 3, 1),
  ...beneficiaryBlock('MAP_0025_', 'FORM_0025', 'RBC Beneficiary Designation', 3, 2),
  ...signatureBlock('MAP_0025_', 'FORM_0025', 'RBC Beneficiary Designation', 14).slice(0, 2),

  // FORM_0035 — Schwab ACH
  m('MAP_0035_001', 'FORM_0035', 'Schwab ACH', 'account_holder', 'text', 'client.full_name', true, 'text', 'Account Holder'),
  m('MAP_0035_002', 'FORM_0035', 'Schwab ACH', 'schwab_account', 'text', 'account.account_number', true, 'text', 'Schwab Account Number'),
  m('MAP_0035_003', 'FORM_0035', 'Schwab ACH', 'bank_name', 'text', 'input.bank_name', true, 'text', 'Bank Name'),
  m('MAP_0035_004', 'FORM_0035', 'Schwab ACH', 'routing_number', 'text', 'input.routing_number', true, 'text', 'Routing Number', { validation: { required: true, pattern: '^\\d{9}$' } }),
  m('MAP_0035_005', 'FORM_0035', 'Schwab ACH', 'bank_account_number', 'text', 'input.bank_account', true, 'text', 'Bank Account Number'),
  m('MAP_0035_006', 'FORM_0035', 'Schwab ACH', 'bank_account_type', 'text', 'input.bank_account_type', true, 'radio', 'Account Type', { options: ['Checking', 'Savings'] }),
  ...signatureBlock('MAP_0035_', 'FORM_0035', 'Schwab ACH', 7).slice(0, 2),

  // FORM_0026 — RBC ACH
  m('MAP_0026_001', 'FORM_0026', 'RBC ACH Authorization', 'account_holder', 'text', 'client.full_name', true, 'text', 'Account Holder'),
  m('MAP_0026_002', 'FORM_0026', 'RBC ACH Authorization', 'rbc_account', 'text', 'account.account_number', true, 'text', 'RBC Account Number'),
  m('MAP_0026_003', 'FORM_0026', 'RBC ACH Authorization', 'bank_name', 'text', 'input.bank_name', true, 'text', 'Bank Name'),
  m('MAP_0026_004', 'FORM_0026', 'RBC ACH Authorization', 'routing_number', 'text', 'input.routing_number', true, 'text', 'Routing Number', { validation: { required: true, pattern: '^\\d{9}$' } }),
  m('MAP_0026_005', 'FORM_0026', 'RBC ACH Authorization', 'bank_account_number', 'text', 'input.bank_account', true, 'text', 'Bank Account Number'),
  m('MAP_0026_006', 'FORM_0026', 'RBC ACH Authorization', 'bank_account_type', 'text', 'input.bank_account_type', true, 'radio', 'Account Type', { options: ['Checking', 'Savings'] }),
  ...signatureBlock('MAP_0026_', 'FORM_0026', 'RBC ACH Authorization', 7).slice(0, 2),

  // FORM_0052 — L-Share Letter
  m('MAP_0052_001', 'FORM_0052', 'L-Share Letter', 'client_name', 'text', 'client.full_name', true, 'text', 'Client Name'),
  m('MAP_0052_002', 'FORM_0052', 'L-Share Letter', 'product_name', 'text', 'account.product_name', true, 'text', 'Product Name'),
  m('MAP_0052_003', 'FORM_0052', 'L-Share Letter', 'surrender_schedule', 'text', 'input.surrender_schedule', true, 'textarea', 'Surrender Schedule', { help_text: 'Describe the L-share surrender schedule' }),
  m('MAP_0052_004', 'FORM_0052', 'L-Share Letter', 'annual_fee', 'percent', 'input.annual_fee', true, 'percent', 'Annual M&E Fee'),
  m('MAP_0052_005', 'FORM_0052', 'L-Share Letter', 'reason_for_lshare', 'text', 'input.lshare_reason', true, 'textarea', 'Reason for L-Share Selection', { help_text: 'Explain why L-share is suitable for this client' }),
  m('MAP_0052_006', 'FORM_0052', 'L-Share Letter', 'client_acknowledged', 'checkbox', 'input.lshare_ack', true, 'checkbox', 'Client Acknowledges L-Share Terms'),
  ...signatureBlock('MAP_0052_', 'FORM_0052', 'L-Share Letter', 7),
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${ALL_MAPPINGS.length} field mappings into ${COLLECTION}...`)

  // Firestore batch limit is 500
  const BATCH_SIZE = 450
  let total = 0

  for (let i = 0; i < ALL_MAPPINGS.length; i += BATCH_SIZE) {
    const chunk = ALL_MAPPINGS.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    const now = new Date().toISOString()

    for (const mapping of chunk) {
      batch.set(db.collection(COLLECTION).doc(mapping.mapping_id), {
        ...mapping,
        created_at: now,
        updated_at: now,
      })
    }

    await batch.commit()
    total += chunk.length
    console.log(`  Committed batch: ${total}/${ALL_MAPPINGS.length}`)
  }

  console.log(`Done. ${total} mappings seeded with full 15-column schema.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
