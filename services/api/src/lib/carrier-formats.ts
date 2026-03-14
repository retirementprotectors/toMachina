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
  carrier_name: 'Schwab (BD/RIA)',
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
  default_category: 'bdria',
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
  default_category: 'bdria',
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
  default_category: 'bdria',
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

// ============================================================================
// EXPORTS
// ============================================================================

export const CARRIER_FORMATS: CarrierFormatDefinition[] = [
  NORTH_AMERICAN,
  NASSAU,
  JOHN_HANCOCK,
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
