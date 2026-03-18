/**
 * Carrier column mapping configs with format detection.
 *
 * Each carrier definition describes:
 *   - column_map: raw header → canonical field name
 *   - dedup_keys: fields used for duplicate detection
 *   - header_signatures: headers that fingerprint this carrier's export
 *   - default_category: account routing category
 */

export interface CarrierFormatDefinition {
  carrier_id: string
  carrier_name: string
  column_map: Record<string, string>
  dedup_keys: string[]
  header_signatures: string[]
  default_category: string
}

// ============================================================================
// CARRIER FORMAT DEFINITIONS
// ============================================================================

const NORTH_AMERICAN: CarrierFormatDefinition = {
  carrier_id: 'north_american',
  carrier_name: 'North American (FIA/MYGA)',
  column_map: {
    'Policy Number': 'policy_number',
    'Contract Number': 'policy_number',
    'Owner Name': 'owner_name',
    'Owner First Name': 'first_name',
    'Owner Last Name': 'last_name',
    'Insured Name': 'insured_name',
    'Product Name': 'product_type',
    'Product Type': 'product_type',
    'Issue Date': 'effective_date',
    'Status': 'status',
    'Policy Status': 'status',
    'Premium': 'premium',
    'Initial Premium': 'premium',
    'Account Value': 'account_value',
    'Accumulated Value': 'account_value',
    'Agent NPN': 'agent_npn',
    'Writing Agent': 'agent_name',
    'Agent Name': 'agent_name',
    'Surrender Date': 'maturity_date',
    'Free Withdrawal': 'free_withdrawal',
    'State': 'state',
    'Owner State': 'state',
    'Annuitant Name': 'annuitant_name',
  },
  dedup_keys: ['policy_number', 'carrier_id'],
  header_signatures: [
    'Policy Number', 'Owner Name', 'Product Name', 'Issue Date',
    'Account Value', 'Premium', 'Agent NPN', 'Policy Status',
  ],
  default_category: 'annuity',
}

const NASSAU: CarrierFormatDefinition = {
  carrier_id: 'nassau',
  carrier_name: 'Nassau (FIA)',
  column_map: {
    'Contract #': 'policy_number',
    'Contract Number': 'policy_number',
    'Owner': 'owner_name',
    'Owner Name': 'owner_name',
    'Annuitant': 'annuitant_name',
    'Product': 'product_type',
    'Product Name': 'product_type',
    'Effective Date': 'effective_date',
    'Issue Date': 'effective_date',
    'Contract Status': 'status',
    'Status': 'status',
    'Premium Amount': 'premium',
    'Total Premium': 'premium',
    'Contract Value': 'account_value',
    'Accumulation Value': 'account_value',
    'NPN': 'agent_npn',
    'Agent NPN': 'agent_npn',
    'Agent': 'agent_name',
    'Surrender Charge %': 'surrender_charge_pct',
    'Surrender Period End': 'maturity_date',
    'Owner State': 'state',
    'State': 'state',
  },
  dedup_keys: ['policy_number', 'carrier_id'],
  header_signatures: [
    'Contract #', 'Owner', 'Product', 'Effective Date',
    'Contract Value', 'Premium Amount', 'NPN', 'Contract Status',
  ],
  default_category: 'annuity',
}

const JOHN_HANCOCK: CarrierFormatDefinition = {
  carrier_id: 'john_hancock',
  carrier_name: 'John Hancock (Life/IUL)',
  column_map: {
    'Policy Number': 'policy_number',
    'Policy #': 'policy_number',
    'Insured': 'insured_name',
    'Insured Name': 'insured_name',
    'Owner': 'owner_name',
    'Owner Name': 'owner_name',
    'Plan Name': 'product_type',
    'Product': 'product_type',
    'Plan Code': 'plan_code',
    'Policy Date': 'effective_date',
    'Issue Date': 'effective_date',
    'Policy Status': 'status',
    'Status': 'status',
    'Face Amount': 'face_amount',
    'Death Benefit': 'face_amount',
    'Modal Premium': 'premium',
    'Annual Premium': 'premium',
    'Cash Value': 'cash_value',
    'Cash Surrender Value': 'cash_value',
    'Agent Number': 'agent_number',
    'Writing Agent NPN': 'agent_npn',
    'Agent NPN': 'agent_npn',
    'Beneficiary': 'beneficiary',
    'Premium Mode': 'premium_mode',
    'Owner State': 'state',
    'State': 'state',
    'Paid To Date': 'paid_to_date',
  },
  dedup_keys: ['policy_number', 'carrier_id'],
  header_signatures: [
    'Policy Number', 'Insured', 'Plan Name', 'Face Amount',
    'Cash Value', 'Modal Premium', 'Policy Status', 'Policy Date',
  ],
  default_category: 'life',
}

const CONSOLIDATED: CarrierFormatDefinition = {
  carrier_id: 'consolidated',
  carrier_name: 'Consolidated (Multi-line)',
  column_map: {
    'Policy/Contract Number': 'policy_number',
    'Policy Number': 'policy_number',
    'Contract Number': 'policy_number',
    'Client Name': 'owner_name',
    'Owner Name': 'owner_name',
    'Client First Name': 'first_name',
    'Client Last Name': 'last_name',
    'Line of Business': 'line_of_business',
    'LOB': 'line_of_business',
    'Product Type': 'product_type',
    'Product Name': 'product_type',
    'Carrier': 'carrier_name',
    'Carrier Name': 'carrier_name',
    'Effective Date': 'effective_date',
    'Issue Date': 'effective_date',
    'Status': 'status',
    'Account Status': 'status',
    'Premium': 'premium',
    'Annual Premium': 'premium',
    'Account Value': 'account_value',
    'Face Amount': 'face_amount',
    'Agent NPN': 'agent_npn',
    'Agent Name': 'agent_name',
    'Owner State': 'state',
    'State': 'state',
    'Client Email': 'email',
    'Client Phone': 'phone',
  },
  dedup_keys: ['policy_number', 'carrier_name'],
  header_signatures: [
    'Policy/Contract Number', 'Client Name', 'Line of Business',
    'Carrier', 'Product Type', 'Effective Date', 'Account Value', 'Premium',
  ],
  default_category: 'annuity',
}

const SCHWAB: CarrierFormatDefinition = {
  carrier_id: 'schwab',
  carrier_name: 'Schwab (Investments)',
  column_map: {
    'Account Number': 'account_number',
    'Account #': 'account_number',
    'Account Name': 'owner_name',
    'Account Owner': 'owner_name',
    'Account Type': 'account_type_detail',
    'Registration': 'registration_type',
    'Custodian': 'custodian',
    'Rep Code': 'rep_code',
    'Rep Name': 'agent_name',
    'Advisor': 'agent_name',
    'Advisor NPN': 'agent_npn',
    'Market Value': 'market_value',
    'Total Value': 'market_value',
    'Cash Balance': 'cash_balance',
    'Opening Date': 'effective_date',
    'Open Date': 'effective_date',
    'Status': 'status',
    'Account Status': 'status',
    'Fee Schedule': 'fee_schedule',
    'Management Fee': 'management_fee',
    'Model Portfolio': 'model_portfolio',
    'State': 'state',
    'SSN Last 4': 'ssn_last4',
    'Tax ID Last 4': 'ssn_last4',
  },
  dedup_keys: ['account_number', 'carrier_id'],
  header_signatures: [
    'Account Number', 'Account Name', 'Account Type', 'Rep Code',
    'Market Value', 'Cash Balance', 'Opening Date', 'Fee Schedule',
  ],
  default_category: 'investments',
}

const RBC: CarrierFormatDefinition = {
  carrier_id: 'rbc',
  carrier_name: 'RBC (BD)',
  column_map: {
    'Account Number': 'account_number',
    'Account #': 'account_number',
    'Client Name': 'owner_name',
    'Account Holder': 'owner_name',
    'Account Registration': 'registration_type',
    'Account Type': 'account_type_detail',
    'Rep ID': 'rep_code',
    'Representative': 'agent_name',
    'Branch': 'branch',
    'Total Assets': 'market_value',
    'Total Market Value': 'market_value',
    'Cash': 'cash_balance',
    'Inception Date': 'effective_date',
    'Open Date': 'effective_date',
    'Status': 'status',
    'Account Status': 'status',
    'Fee Type': 'fee_schedule',
    'State': 'state',
    'Zip': 'zip',
  },
  dedup_keys: ['account_number', 'carrier_id'],
  header_signatures: [
    'Account Number', 'Client Name', 'Account Registration', 'Rep ID',
    'Total Assets', 'Branch', 'Inception Date', 'Account Status',
  ],
  default_category: 'investments',
}

const DST_VISION: CarrierFormatDefinition = {
  carrier_id: 'dst_vision',
  carrier_name: 'DST Vision (Mutual Fund/VA)',
  column_map: {
    'Account Number': 'account_number',
    'Account #': 'account_number',
    'Registration Name': 'owner_name',
    'Account Owner': 'owner_name',
    'Fund Name': 'product_type',
    'Fund Family': 'fund_family',
    'CUSIP': 'cusip',
    'Share Class': 'share_class',
    'Units/Shares': 'shares',
    'Market Value': 'market_value',
    'NAV': 'nav',
    'Cost Basis': 'cost_basis',
    'Account Type': 'account_type_detail',
    'Registration Type': 'registration_type',
    'Dealer Number': 'rep_code',
    'Rep Number': 'rep_code',
    'Rep Name': 'agent_name',
    'Inception Date': 'effective_date',
    'Status': 'status',
    'State': 'state',
    'SSN': 'ssn_last4',
  },
  dedup_keys: ['account_number', 'cusip', 'carrier_id'],
  header_signatures: [
    'Account Number', 'Registration Name', 'Fund Name', 'CUSIP',
    'Share Class', 'Market Value', 'NAV', 'Dealer Number',
  ],
  default_category: 'investments',
}

const MEDICARE_GENERIC: CarrierFormatDefinition = {
  carrier_id: 'medicare_generic',
  carrier_name: 'Medicare Generic',
  column_map: {
    'Member ID': 'member_id',
    'Medicare ID': 'member_id',
    'Beneficiary Name': 'owner_name',
    'Member Name': 'owner_name',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Plan Name': 'product_type',
    'Plan Type': 'plan_type',
    'Carrier': 'carrier_name',
    'Carrier Name': 'carrier_name',
    'Effective Date': 'effective_date',
    'Enrollment Date': 'effective_date',
    'Disenrollment Date': 'termination_date',
    'Status': 'status',
    'Enrollment Status': 'status',
    'Monthly Premium': 'premium',
    'Premium': 'premium',
    'Agent NPN': 'agent_npn',
    'Writing Agent': 'agent_name',
    'Agent Name': 'agent_name',
    'County': 'county',
    'State': 'state',
    'Zip': 'zip',
    'DOB': 'dob',
    'Date of Birth': 'dob',
    'Phone': 'phone',
  },
  dedup_keys: ['member_id', 'carrier_name', 'effective_date'],
  header_signatures: [
    'Member ID', 'Beneficiary Name', 'Plan Name', 'Plan Type',
    'Enrollment Date', 'Monthly Premium', 'Agent NPN', 'Enrollment Status',
  ],
  default_category: 'medicare',
}

const HUMANA_MAPD: CarrierFormatDefinition = {
  carrier_id: 'humana_mapd',
  carrier_name: 'Humana (MAPD/PDP)',
  column_map: {
    // Member identity
    'MbrLastName': 'last_name',
    'MbrFirstName': 'first_name',
    'MbrMiddleInit': 'middle_initial',
    'Humana ID': 'member_id',
    'Medicare No': 'medicare_id',
    'Medicaid ID': 'medicaid_id',
    // Contact
    'Primary Phone': 'phone',
    'Secondary Phone': 'phone_secondary',
    'Email': 'email',
    'Gender': 'gender',
    'Birth Date': 'dob',
    'Age': 'age',
    // Mail address
    'Mail Address': 'address_line1',
    'Mail Address 2': 'address_line2',
    'Mail City': 'city',
    'Mail State': 'state',
    'Mail ZipCd': 'zip',
    'Mail Cnty': 'county',
    // Resident address
    'Resident Address': 'resident_address_line1',
    'Resident City': 'resident_city',
    'Resident State': 'resident_state',
    'Resident Zip Code': 'resident_zip',
    'Resident County': 'resident_county',
    // Policy details
    'Status': 'status',
    'Status Date': 'status_date',
    'Status Description': 'status_description',
    'Effective Date': 'effective_date',
    'Inactive Date': 'termination_date',
    'Deceased Date': 'deceased_date',
    'CoverageType': 'coverage_type',
    'Plan Type': 'plan_type',
    'SalesProduct': 'product_type',
    'Plan Name': 'plan_name',
    'Signature Date': 'submitted_date',
    'Contract-PBP-Segment ID': 'cms_plan_code',
    'Election Code': 'election_type',
    'PlanYear': 'plan_year',
    // Agent/Producer
    'NPN': 'agent_npn',
    'Servicing Agent': 'servicing_agent',
    'Servicing Agent SAN': 'servicing_agent_san',
    'AOR Name': 'agent_name',
    'AOR SAN': 'agent_san',
    // Financials
    'Current Premium': 'monthly_premium',
    'Current Balance': 'current_balance',
    'Past Due Balance': 'past_due_balance',
    // Enrollment metadata
    'Application Source': 'application_source',
    'Application ID': 'application_id',
    'PCP': 'pcp',
    'Network': 'network',
    'Pref Lang': 'preferred_language',
    'Veteran': 'veteran_status',
    'Low Income Subsidy': 'lis_status',
  },
  dedup_keys: ['member_id', 'carrier_id', 'effective_date'],
  header_signatures: [
    'MbrLastName', 'MbrFirstName', 'Humana ID', 'Medicare No',
    'CoverageType', 'SalesProduct', 'Servicing Agent', 'AOR Name',
  ],
  default_category: 'medicare',
}

const AETNA_BOB: CarrierFormatDefinition = {
  carrier_id: 'aetna_bob',
  carrier_name: 'Aetna (MedicareApprovedBOBReport)',
  column_map: {
    // Member identity
    'Member ID': 'member_id',
    'Legacy Member ID': 'legacy_member_id',
    'Medicare Number': 'medicare_id',
    'Application ID': 'application_id',
    'First Name': 'first_name',
    'Middle Initial': 'middle_initial',
    'Last Name': 'last_name',
    'Date of Birth': 'dob',
    'Phone Number': 'phone',
    // Address
    'Address Line 1': 'address_line1',
    'Address Line 2': 'address_line2',
    'City': 'city',
    'State': 'state',
    'Zip Code': 'zip',
    // Policy details
    'Application Signed Date': 'submitted_date',
    'Application Received Date': 'application_received_date',
    'Coverage Effective Date': 'effective_date',
    'Member Status': 'status',
    'Term Date': 'termination_date',
    'Term Reason Code': 'term_reason_code',
    'Plan Name': 'plan_name',
    'Plan Effective Date': 'plan_effective_date',
    'Supplement Plans': 'supplement_plans',
    // Agent/Producer
    'Writing Agent NPN': 'agent_npn',
    'Writing Agent TIN': 'agent_tin',
    'Writing Agent First Name': 'agent_first_name',
    'Writing Agent Last Name': 'agent_last_name',
    // Financials
    'Payment Method': 'premium_mode',
    'Bill Option': 'bill_option',
    'Invoice Amount': 'monthly_premium',
    'Invoice Date': 'invoice_date',
    // CMS identifiers
    'CMS Contract Number': 'cms_contract_number',
    'PBP Code': 'cms_plan_code',
    'ID Card Issue Date': 'id_card_issue_date',
    'Affinity Code': 'affinity_code',
    // Producer hierarchy (9 levels)
    'Producer Level 1 Name': 'producer_level1_name',
    'Producer Level 1 TIN/NPN': 'producer_level1_tin_npn',
    'Producer Level 1 Code': 'producer_level1_code',
    'Producer Level 2 Name': 'producer_level2_name',
    'Producer Level 2 TIN/NPN': 'producer_level2_tin_npn',
    'Producer Level 2 Code': 'producer_level2_code',
    'Producer Level 3 Name': 'producer_level3_name',
    'Producer Level 3 TIN/NPN': 'producer_level3_tin_npn',
    'Producer Level 3 Code': 'producer_level3_code',
    'Producer Level 4 Name': 'producer_level4_name',
    'Producer Level 4 TIN/NPN': 'producer_level4_tin_npn',
    'Producer Level 4 Code': 'producer_level4_code',
    'Producer Level 5 Name': 'producer_level5_name',
    'Producer Level 5 TIN/NPN': 'producer_level5_tin_npn',
    'Producer Level 5 Code': 'producer_level5_code',
    'Producer Level 6 Name': 'producer_level6_name',
    'Producer Level 6 TIN/NPN': 'producer_level6_tin_npn',
    'Producer Level 6 Code': 'producer_level6_code',
    'Producer Level 7 Name': 'producer_level7_name',
    'Producer Level 7 TIN/NPN': 'producer_level7_tin_npn',
    'Producer Level 7 Code': 'producer_level7_code',
    'Producer Level 8 Name': 'producer_level8_name',
    'Producer Level 8 TIN/NPN': 'producer_level8_tin_npn',
    'Producer Level 8 Code': 'producer_level8_code',
    'Producer Level 9 Name': 'producer_level9_name',
    'Producer Level 9 TIN/NPN': 'producer_level9_tin_npn',
    'Producer Level 9 Code': 'producer_level9_code',
  },
  dedup_keys: ['member_id', 'carrier_id', 'effective_date'],
  header_signatures: [
    'Member ID', 'Medicare Number', 'Coverage Effective Date', 'Member Status',
    'Writing Agent NPN', 'CMS Contract Number', 'PBP Code', 'Producer Level 1 Name',
  ],
  default_category: 'medicare',
}

const KANSAS_CITY_LIFE: CarrierFormatDefinition = {
  carrier_id: 'kansas_city_life',
  carrier_name: 'Kansas City Life (Life/Annuity)',
  column_map: {
    // Identity
    'Policy Number': 'policy_number',
    'Policy #': 'policy_number',
    'Insured': 'insured_name',
    'Insured Name': 'insured_name',
    'Birthdate': 'dob',
    'Name': 'insured_name',
    // People
    'Address': 'address_line1',
    'City': 'city',
    'State': 'state',
    'ZIP': 'zip',
    'ZIP+4': 'zip4',
    'Phone Number': 'phone',
    'Issue Age': 'issue_age',
    'SSN': 'ssn_last4',
    'Sex': 'gender',
    // Policy details
    'Plan Name': 'product_type',
    'Plan': 'plan_code',
    'Plan Option': 'plan_option',
    'Policy Type': 'policy_type',
    'Status': 'status',
    'Issue Date': 'effective_date',
    'Maturity Date': 'maturity_date',
    'Last Change Date': 'last_change_date',
    'Risk': 'risk_class',
    'Specified Amount': 'face_amount',
    'Total Premiums Paid': 'total_premiums_paid',
    'Policy Value': 'account_value',
    'Mode': 'premium_mode',
    'Premium Billed': 'premium',
    'Billing Status': 'billing_status',
    // Values
    'Cash Value': 'cash_value',
    'Surrender Value': 'surrender_value',
    'Death Benefit': 'death_benefit',
    'Loan Balance': 'loan_balance',
    'Net Loan Amount': 'net_loan_amount',
    'Loan Proceeds': 'loan_proceeds',
    'Loan Payoff Amount': 'loan_payoff',
    'Interest Rate': 'loan_interest_rate',
    // Guideline
    'Guideline Single': 'guideline_single_premium',
    'Guideline Accumulation Level': 'guideline_accumulation_level',
    // Beneficiaries
    'Beneficiaries': 'beneficiary',
  },
  dedup_keys: ['policy_number', 'carrier_id'],
  header_signatures: [
    'Policy Number', 'Insured', 'Plan Name', 'Specified Amount',
    'Cash Value', 'Death Benefit', 'Issue Date', 'Birthdate',
  ],
  default_category: 'life',
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CARRIER_FORMATS: CarrierFormatDefinition[] = [
  HUMANA_MAPD,
  AETNA_BOB,
  NORTH_AMERICAN,
  NASSAU,
  JOHN_HANCOCK,
  KANSAS_CITY_LIFE,
  CONSOLIDATED,
  SCHWAB,
  RBC,
  DST_VISION,
  MEDICARE_GENERIC,
]

/**
 * Detect the best-matching carrier format from a set of column headers.
 * Returns the format with the highest signature match ratio (minimum 60%).
 */
export function detectCarrierFormat(headers: string[]): CarrierFormatDefinition | null {
  if (!headers || headers.length === 0) return null

  // Normalize incoming headers for comparison
  const normalizedHeaders = new Set(
    headers.map(h => String(h).trim())
  )

  let bestFormat: CarrierFormatDefinition | null = null
  let bestScore = 0

  for (const format of CARRIER_FORMATS) {
    const sigs = format.header_signatures
    let matched = 0

    for (const sig of sigs) {
      // Check exact match first
      if (normalizedHeaders.has(sig)) {
        matched++
        continue
      }
      // Check case-insensitive match
      const sigLower = sig.toLowerCase()
      for (const h of normalizedHeaders) {
        if (h.toLowerCase() === sigLower) {
          matched++
          break
        }
      }
    }

    const score = sigs.length > 0 ? matched / sigs.length : 0

    if (score > bestScore) {
      bestScore = score
      bestFormat = format
    }
  }

  // Require at least 60% signature match
  if (bestScore < 0.6) return null

  return bestFormat
}

/**
 * Map a raw data row to canonical field names using a carrier format definition.
 * Unmapped fields are preserved with their original key prefixed with `_raw_`.
 */
export function mapRowToCanonical(
  row: Record<string, unknown>,
  format: CarrierFormatDefinition
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    carrier_id: format.carrier_id,
    carrier_name: format.carrier_name,
    account_category: format.default_category,
  }

  // Build a case-insensitive lookup of the column map
  const mapLower = new Map<string, string>()
  for (const [rawKey, canonKey] of Object.entries(format.column_map)) {
    mapLower.set(rawKey.toLowerCase(), canonKey)
  }

  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === '') continue

    const canonical = mapLower.get(key.toLowerCase())
    if (canonical) {
      // Don't overwrite if already set (first match wins)
      if (result[canonical] == null) {
        result[canonical] = value
      }
    } else {
      // Preserve unmapped fields
      result[`_raw_${key}`] = value
    }
  }

  return result
}
