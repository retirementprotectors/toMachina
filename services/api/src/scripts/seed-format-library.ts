/**
 * Seed ATLAS format_library with 5 GHL export column maps.
 *
 * Reads actual CSV headers from the export files, computes SHA-256
 * fingerprints using the same algorithm as packages/core/src/atlas/introspect.ts,
 * and writes format documents to Firestore format_library collection.
 *
 * Run: npx tsx services/api/src/scripts/seed-format-library.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ---------------------------------------------------------------------------
// Fingerprint — mirrors packages/core/src/atlas/introspect.ts
// ---------------------------------------------------------------------------
function hashHeaderFingerprint(headers: string[]): string {
  const normalized = headers.map(h => h.trim().toLowerCase()).sort().join('|')
  return createHash('sha256').update(normalized).digest('hex')
}

// ---------------------------------------------------------------------------
// CSV header parser — handles quoted fields with commas
// ---------------------------------------------------------------------------
function parseCsvHeaderLine(line: string): string[] {
  const headers: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      headers.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  headers.push(current.trim()) // last field
  return headers
}

// ---------------------------------------------------------------------------
// Read first line of a CSV file
// ---------------------------------------------------------------------------
async function readCsvHeaders(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    })
    rl.on('line', (line) => {
      rl.close()
      resolve(parseCsvHeaderLine(line))
    })
    rl.on('error', reject)
    rl.on('close', () => {}) // no-op to prevent unhandled
  })
}

// ---------------------------------------------------------------------------
// Format definitions
// ---------------------------------------------------------------------------
interface FormatDef {
  format_id: string
  name: string
  file_path: string
  target_collection: string
  account_category?: string
  column_map: Record<string, string>
}

const FORMATS: FormatDef[] = [
  // -----------------------------------------------------------------------
  // 1. GHL Contacts
  // -----------------------------------------------------------------------
  {
    format_id: 'ghl_contacts_client_list',
    name: 'GHL Contacts — Client List Export',
    file_path: '/Users/joshd.millang/Downloads/Export_Contacts_Client List_Mar_2026_10_06_PM.csv',
    target_collection: 'clients',
    column_map: {
      'Contact Id': 'ghl_contact_id',
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Phone': 'phone',
      'Email': 'email',
      'Date of Birth': 'date_of_birth',
      'Gender': 'gender',
      'Marital Status': 'marital_status',
      'Street Address': 'address_street',
      'Street Address 2': 'address_street2',
      'City': 'address_city',
      'State (Selector)': 'address_state',
      'Postal Code': 'address_zip',
      'County (Text)': 'address_county',
      'Client Status': 'client_status',
      'Book Of Business': 'book_of_business',
      'Preferred Name': 'preferred_name',
      'Middle Name': 'middle_name',
      'Alternate Phone': 'alternate_phone',
      'Secondary Email': 'secondary_email',
      'Phone Type': 'phone_type',
      'Timezone': 'timezone',
      'Tags': 'tags',
      'Created': 'ghl_created_at',
      'Last Activity': 'ghl_last_activity',
      'Opportunities': 'ghl_opportunities',
      'Assigned To': 'ghl_assigned_to',
      'Updated': 'ghl_updated_at',
      'Social Security Number': 'ssn',
      'Medicare #': 'medicare_number',
      'Active Client- File Location': 'acf_link',
      'JIRA- PPL Key': 'jira_key',
    },
  },

  // -----------------------------------------------------------------------
  // 2. GHL Medicare
  // -----------------------------------------------------------------------
  {
    format_id: 'ghl_medicare_accounts',
    name: 'GHL Medicare — Account Records Export',
    file_path: '/Users/joshd.millang/Downloads/records (3).csv',
    target_collection: 'accounts',
    account_category: 'medicare',
    column_map: {
      'Record ID': 'ghl_object_id',
      'Policy #': 'policy_number',
      'Carrier Parent (Charter)': 'carrier_name',
      'Plan Name (EXACT!)': 'plan_name',
      'Type- CORE': 'core_product_type',
      'Type- Ancillary': 'ancillary_type',
      'CMS Plan Code (EXACT!)': 'cms_plan_code',
      'MAPD Type': 'mapd_type',
      'Plan Letter': 'plan_letter',
      'Effective Date ( CDT )': 'effective_date',
      'Status': 'status',
      'Market': 'market',
      'Book of Business': 'book_of_business',
      'Premium Mode': 'premium_mode',
      'Monthly Premium (Medical)': 'monthly_premium',
      'Annualized Premium (Attained)': 'annualized_premium',
      'Planned Premium (Attained)': 'planned_premium',
      'Annualized Premium- Commissionable (Issued)': 'commissionable_premium',
      'Underwriting Status': 'underwriting_status',
      'ACF Link': 'acf_link',
      'Contacts (Associated Contacts) IDs': 'ghl_contact_id',
      'Contacts (Associated Contacts)': 'ghl_contact_name',
      'Created At ( CDT )': 'ghl_created_at',
      'Updated At ( CDT )': 'ghl_updated_at',
      'Cumulative Rate Increase': 'cumulative_rate_increase',
      'Approved Rate Action- New Premium': 'approved_rate_new_premium',
      'Approved Rate Action- Effective Date ( CDT )': 'approved_rate_effective_date',
      'Guaranteed Issue Available?': 'guaranteed_issue',
      'Part B Giveback ($)': 'part_b_giveback',
      'Discounts- Type': 'discount_type',
      'Discounts- TOTAL (%/ Policy)': 'discount_total',
      'JIRA Issue Key (MEDICARE)': 'jira_key',
    },
  },

  // -----------------------------------------------------------------------
  // 3. GHL Life
  // -----------------------------------------------------------------------
  {
    format_id: 'ghl_life_accounts',
    name: 'GHL Life — Account Records Export',
    file_path: '/Users/joshd.millang/Downloads/records (2).csv',
    target_collection: 'accounts',
    account_category: 'life',
    column_map: {
      'Record ID': 'ghl_object_id',
      'Policy #': 'policy_number',
      'Carrier': 'carrier_name',
      'Product Name': 'product_name',
      'Type': 'policy_type',
      'Issue Date ( CDT )': 'issue_date',
      'Status': 'status',
      'Market': 'market',
      'Book of Business': 'book_of_business',
      'Data Source': 'data_source',
      'As-Of Date ( CDT )': 'as_of_date',
      'Cash Value': 'cash_value',
      'NET Cash Surrender Value': 'net_csv',
      'Death Benefit': 'death_benefit',
      'NET Death Benefit': 'net_death_benefit',
      'Scheduled Premium': 'scheduled_premium',
      'ANNUALIZED Premium': 'annualized_premium',
      'Premium Mode': 'premium_mode',
      'DB Option': 'db_option',
      'MEC (Modified Endowment Contract)': 'mec',
      'Underwriting Status': 'underwriting_status',
      'Policy Owner (if different than Applicant)': 'policy_owner',
      'Insured (if different than Owner)': 'insured_other',
      'Joint Owner': 'joint_owner',
      'Joint Insured': 'joint_insured',
      'Long Term Care Benefit': 'ltc_benefit',
      'ACF Link': 'acf_link',
      'Loan Balance': 'loan_balance',
      'Loan Outstanding Interest': 'loan_interest',
      'Loan Interest Rate (%)': 'loan_rate',
      'Contacts (Associated Contacts) IDs': 'ghl_contact_id',
      'Contacts (Associated Contacts)': 'ghl_contact_name',
      'Created At ( CDT )': 'ghl_created_at',
      'Updated At ( CDT )': 'ghl_updated_at',
      'JIRA Issue Key (LIFE)': 'jira_key',
      'Primary- 1 (Name)': 'beneficiary_primary_1_name',
      'Primary- 1 (%)': 'beneficiary_primary_1_pct',
      'Primary- 2 (Name)': 'beneficiary_primary_2_name',
      'Primary- 2 (%)': 'beneficiary_primary_2_pct',
      'Primary- 3 (Name)': 'beneficiary_primary_3_name',
      'Primary- 3 (%)': 'beneficiary_primary_3_pct',
      'Primary- 4 (Name)': 'beneficiary_primary_4_name',
      'Primary- 4 (%)': 'beneficiary_primary_4_pct',
      'Contingent- 1 (Name)': 'beneficiary_contingent_1_name',
      'Contingent- 1 (%)': 'beneficiary_contingent_1_pct',
      'Contingent- 2 (Name)': 'beneficiary_contingent_2_name',
      'Contingent- 2 (%)': 'beneficiary_contingent_2_pct',
      'Contingent- 3 (Name)': 'beneficiary_contingent_3_name',
      'Contingent- 3 (%)': 'beneficiary_contingent_3_pct',
      'Contingent- 4 (Name)': 'beneficiary_contingent_4_name',
      'Contingent- 4 (%)': 'beneficiary_contingent_4_pct',
    },
  },

  // -----------------------------------------------------------------------
  // 4. GHL Investment
  // -----------------------------------------------------------------------
  {
    format_id: 'ghl_investment_accounts',
    name: 'GHL Investment — Account Records Export',
    file_path: '/Users/joshd.millang/Downloads/records (4).csv',
    target_collection: 'accounts',
    account_category: 'investment',
    column_map: {
      'Record ID': 'ghl_object_id',
      'Account #': 'account_number',
      'Account Type': 'account_type',
      'Tax Status': 'tax_status',
      'Account Registration': 'account_registration',
      'Status': 'status',
      'Market': 'market',
      'Book of Business': 'book_of_business',
      'Data Source': 'data_source',
      'Account Value': 'account_value',
      'Net Deposits': 'net_deposits',
      'BD/ RIA Firm': 'investment_firm',
      'Custodian': 'custodian',
      'Broker/ Advisor of Record (Retail Agency/ Firm)': 'advisor_of_record',
      'As-Of Date ( CDT )': 'as_of_date',
      'Opened Date ( CDT )': 'opened_date',
      'Advisory Fees (Annualized $)': 'advisory_fees',
      'Advisory Fees (Calculated %)': 'advisory_fee_pct',
      'Return % (Cumulative)': 'return_cumulative',
      'Return % (Annualized)': 'return_annualized',
      '12.31.Prior Year [FAIR MARKET VALUE]': 'prior_year_fmv',
      '12.31.Current Year [AGE | DIVISOR]': 'current_year_age_divisor',
      'Current Year RMD [CALCULATED]': 'rmd_calculated',
      'Current Year RMD [TAKEN]': 'rmd_taken',
      'Current Year RMD [REMAINING]': 'rmd_remaining',
      'Systematic RMD Setup?': 'rmd_systematic',
      'RMD Satisfied?': 'rmd_satisfied',
      'Contacts (Associated Contacts) IDs': 'ghl_contact_id',
      'Contacts (Associated Contacts)': 'ghl_contact_name',
      'Created At ( CDT )': 'ghl_created_at',
      'Updated At ( CDT )': 'ghl_updated_at',
    },
  },

  // -----------------------------------------------------------------------
  // 5. GHL Annuity
  // -----------------------------------------------------------------------
  {
    format_id: 'ghl_annuity_accounts',
    name: 'GHL Annuity — Account Records Export',
    file_path: '/Users/joshd.millang/Downloads/records.csv',
    target_collection: 'accounts',
    account_category: 'annuity',
    column_map: {
      'Record ID': 'ghl_object_id',
      'Account #': 'account_number',
      'Carrier': 'carrier_name',
      'Product Name': 'product_name',
      'Type': 'account_type',
      'Tax Status': 'tax_status',
      'Issue Date ( CDT )': 'issue_date',
      'Status': 'status',
      'Market': 'market',
      'Book of Business': 'book_of_business',
      'Data Source': 'data_source',
      'As-Of Date ( CDT )': 'as_of_date',
      'Account Value': 'account_value',
      'Surrender Value': 'surrender_value',
      'Death Benefit': 'death_benefit',
      'Net Deposits': 'net_deposits',
      'Benefit Base': 'benefit_base',
      'Income Benefit': 'income_benefit',
      'Payment Amount': 'payment_amount',
      'Payment Mode': 'payment_mode',
      'Joint Owner': 'joint_owner',
      'Joint Annuitant': 'joint_annuitant',
      'Account Owner (if different than Applicant)': 'account_owner',
      'Annuitant (if different than Owner)': 'annuitant_other',
      'ACF Link': 'acf_link',
      'Long Term Care Benefit': 'ltc_benefit',
      'Contacts (Associated Contacts) IDs': 'ghl_contact_id',
      'Contacts (Associated Contacts)': 'ghl_contact_name',
      'JIRA Issue Key (ANNUITY)': 'jira_key',
      'Created At ( CDT )': 'ghl_created_at',
      'Updated At ( CDT )': 'ghl_updated_at',
      'Primary- 1 (Name)': 'beneficiary_primary_1_name',
      'Primary- 1 (%)': 'beneficiary_primary_1_pct',
      'Primary- 2 (Name)': 'beneficiary_primary_2_name',
      'Primary- 2 (%)': 'beneficiary_primary_2_pct',
      'Primary- 3 (Name)': 'beneficiary_primary_3_name',
      'Primary- 3 (%)': 'beneficiary_primary_3_pct',
      'Primary- 4 (Name)': 'beneficiary_primary_4_name',
      'Primary- 4 (%)': 'beneficiary_primary_4_pct',
      'Contingent- 1 (Name)': 'beneficiary_contingent_1_name',
      'Contingent- 1 (%)': 'beneficiary_contingent_1_pct',
      'Contingent- 2 (Name)': 'beneficiary_contingent_2_name',
      'Contingent- 2 (%)': 'beneficiary_contingent_2_pct',
      'Contingent- 3 (Name)': 'beneficiary_contingent_3_name',
      'Contingent- 3 (%)': 'beneficiary_contingent_3_pct',
      'Contingent- 4 (Name)': 'beneficiary_contingent_4_name',
      'Contingent- 4 (%)': 'beneficiary_contingent_4_pct',
      'Systematic RMD Setup?': 'rmd_systematic',
      'RMD Satisfied?': 'rmd_satisfied',
    },
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const now = new Date().toISOString()
  const batch = db.batch()
  const results: { format_id: string; fingerprint: string; field_count: number; header_count: number }[] = []

  for (const fmt of FORMATS) {
    console.log(`\nProcessing: ${fmt.name}`)
    console.log(`  File: ${fmt.file_path}`)

    // Read actual CSV headers
    const headers = await readCsvHeaders(fmt.file_path)
    console.log(`  Headers found: ${headers.length}`)

    // Compute fingerprint from ALL headers (not just mapped ones)
    const fingerprint = hashHeaderFingerprint(headers)
    console.log(`  Fingerprint: ${fingerprint.substring(0, 16)}...`)

    // Build the document
    const doc: Record<string, unknown> = {
      format_id: fmt.format_id,
      name: fmt.name,
      source_type: 'GHL_EXPORT',
      target_collection: fmt.target_collection,
      header_fingerprint: fingerprint,
      column_map: fmt.column_map,
      field_count: Object.keys(fmt.column_map).length,
      total_csv_headers: headers.length,
      unmapped_headers: headers.filter(h => !fmt.column_map[h]),
      created_at: now,
      status: 'ACTIVE',
    }

    if (fmt.account_category) {
      doc.account_category = fmt.account_category
    }

    // Use format_id as document ID for deterministic references
    const ref = db.collection('format_library').doc(fmt.format_id)
    batch.set(ref, doc)

    results.push({
      format_id: fmt.format_id,
      fingerprint,
      field_count: Object.keys(fmt.column_map).length,
      header_count: headers.length,
    })
  }

  // Commit all 5 documents
  await batch.commit()

  console.log('\n========================================')
  console.log('FORMAT LIBRARY SEED COMPLETE')
  console.log('========================================\n')

  for (const r of results) {
    console.log(`  ${r.format_id}`)
    console.log(`    Fingerprint: ${r.fingerprint}`)
    console.log(`    Mapped: ${r.field_count} / ${r.header_count} headers`)
    console.log('')
  }

  console.log(`Total: ${results.length} formats written to format_library collection`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
