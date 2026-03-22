/**
 * CoF Parmenter Agency Book of Business Import
 *
 * Source: /tmp/parmenter_agency.xlsx (2,192 CoF life insurance policies)
 * Target: Firestore (claude-mcp-484718)
 * Agent: Shane Parmenter (shane@retireprotected.com)
 *
 * Steps:
 *   1. Load + normalize XLSX
 *   2. Match against existing Firestore accounts
 *   3. Create new clients (unmatched)
 *   4. Create new accounts (unmatched policies)
 *   5. Enrich existing accounts (matched policies)
 *   6. DeDup scan
 *   7. Report
 *   8. ATLAS source_registry entry
 *   9. FORGE tracker_item
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, WriteBatch } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

// Firebase init
if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// XLSX loaded from /tmp (already installed there)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('/tmp/node_modules/xlsx')

// ============================================================================
// TYPES
// ============================================================================

interface RawRow {
  'Court Number': string | number
  'Policy Number': string
  'Owner First': string
  'Owner Last': string
  'Insured First': string
  'Insured Last': string
  'DOB': string
  'Gender': string
  'Address 1': string
  'Address 2': string | null
  'Address 3': string | null
  'Owner City': string
  'Owner State': string
  'RES State': string
  'Owner Zip': string | number
  'Owner Phone': string | null
  'Owner Email': string | null
  'LOB': string
  'Product Code': string
  'Description': string
  'Product Name': string
  'Issue Date': string
  'Paid To Date': string
  'Face': number
  'Modal Premium': number
  'Annual Premium': number
  'Billing Mode': string
  'Cash Value': number
  'Fund Value': number
  'PUA Rider Face': number
  'PUA Face Dividends': number
  'Annuity Balance': number
  'Loan Interest Balance': number
  'Loan Balance': number
  'Fund Valuation Date': string | null
  'Fund Balance': number | null
  'Current Interest Rate': number | null
  'Guaranteed Interest Rate': number | null
  'UL Death Benefit': number
  [key: string]: unknown
}

interface NormalizedPolicy {
  policy_number: string
  policy_number_stripped: string
  lob: string
  product_code: string
  product_name: string
  description: string
  issue_date: string
  paid_to_date: string
  face_value: number
  annual_premium: number
  modal_premium: number
  billing_mode: string
  cash_value: number
  fund_value: number
  annuity_balance: number
  loan_balance: number
  loan_interest_balance: number
  death_benefit: number
  pua_rider_face: number
  pua_face_dividends: number
  court_number: string
  account_type_category: string
  product_type: string
}

interface NormalizedClient {
  first_name: string
  last_name: string
  dob: string
  gender: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  client_key: string
  policies: NormalizedPolicy[]
}

interface ExistingAccount {
  doc_id: string
  client_id: string
  path: string
  data: Record<string, unknown>
}

// ============================================================================
// HELPERS
// ============================================================================

function properCase(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toString()
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase())
    .trim()
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.toString().replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

function convertDate(raw: string | null | undefined): string {
  if (!raw) return ''
  const str = raw.toString().trim()
  // MM/DD/YYYY → YYYY-MM-DD
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, m, d, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return str
}

function safeFloat(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val))
  return isNaN(n) ? 0 : n
}

function stripLeadingZeros(policyNum: string): string {
  return policyNum.replace(/^0+/, '') || '0'
}

function lobToCategory(lob: string): string {
  const map: Record<string, string> = { L: 'life', A: 'annuity', U: 'life', H: 'life', I: 'investment' }
  return map[lob] || 'life'
}

function lobToProductType(lob: string): string {
  const map: Record<string, string> = { L: 'Life', A: 'Annuity', U: 'Life', H: 'Life', I: 'Investment' }
  return map[lob] || 'Life'
}

// ============================================================================
// STEP 1: Load + Normalize
// ============================================================================

function loadAndNormalize(): NormalizedClient[] {
  console.log('\n[STEP 1] Loading and normalizing XLSX...')
  const wb = XLSX.readFile('/tmp/parmenter_agency.xlsx')
  // CRITICAL: raw: false forces all cells to text. Without this, phone numbers
  // get read as floats and lose last 1-3 digits due to precision. (TRK-441)
  const rows: RawRow[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: null })
  console.log(`  Loaded ${rows.length} rows from XLSX`)

  // Group by unique owner (first + last + DOB = client key)
  const clientMap = new Map<string, NormalizedClient>()

  for (const row of rows) {
    const firstName = properCase(row['Owner First'])
    const lastName = properCase(row['Owner Last'])
    const dob = convertDate(row['DOB'])
    const clientKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob}`

    const policy: NormalizedPolicy = {
      policy_number: String(row['Policy Number'] || ''),
      policy_number_stripped: stripLeadingZeros(String(row['Policy Number'] || '')),
      lob: String(row['LOB'] || 'L'),
      product_code: String(row['Product Code'] || ''),
      product_name: String(row['Product Name'] || ''),
      description: String(row['Description'] || ''),
      issue_date: convertDate(row['Issue Date']),
      paid_to_date: convertDate(row['Paid To Date']),
      face_value: safeFloat(row['Face']),
      annual_premium: safeFloat(row['Annual Premium']),
      modal_premium: safeFloat(row['Modal Premium']),
      billing_mode: String(row['Billing Mode'] || ''),
      cash_value: safeFloat(row['Cash Value']),
      fund_value: safeFloat(row['Fund Value']),
      annuity_balance: safeFloat(row['Annuity Balance']),
      loan_balance: safeFloat(row['Loan Balance']),
      loan_interest_balance: safeFloat(row['Loan Interest Balance']),
      death_benefit: safeFloat(row['UL Death Benefit']),
      pua_rider_face: safeFloat(row['PUA Rider Face']),
      pua_face_dividends: safeFloat(row['PUA Face Dividends']),
      court_number: String(row['Court Number'] || ''),
      account_type_category: lobToCategory(String(row['LOB'] || 'L')),
      product_type: lobToProductType(String(row['LOB'] || 'L')),
    }

    if (clientMap.has(clientKey)) {
      clientMap.get(clientKey)!.policies.push(policy)
    } else {
      clientMap.set(clientKey, {
        first_name: firstName,
        last_name: lastName,
        dob,
        gender: String(row['Gender'] || '').toUpperCase(),
        address: properCase(row['Address 1']),
        city: properCase(row['Owner City']),
        state: String(row['Owner State'] || '').toUpperCase(),
        zip: String(row['Owner Zip'] || ''),
        phone: normalizePhone(row['Owner Phone']),
        email: String(row['Owner Email'] || '').toLowerCase().trim(),
        client_key: clientKey,
        policies: [policy],
      })
    }
  }

  const clients = Array.from(clientMap.values())
  const totalPolicies = clients.reduce((sum, c) => sum + c.policies.length, 0)
  console.log(`  Unique clients: ${clients.length}`)
  console.log(`  Total policies: ${totalPolicies}`)
  return clients
}

// ============================================================================
// STEP 2: Match against Firestore
// ============================================================================

async function loadExistingAccounts(): Promise<Map<string, ExistingAccount>> {
  console.log('\n[STEP 2] Loading existing Firestore accounts...')
  const accountMap = new Map<string, ExistingAccount>()

  const snap = await db.collectionGroup('accounts').get()
  console.log(`  Loaded ${snap.size} existing account docs`)

  for (const doc of snap.docs) {
    const data = doc.data()
    const policyNum = String(data.policy_number || '')
    if (!policyNum) continue

    const stripped = stripLeadingZeros(policyNum)
    // Extract client_id from path: clients/{clientId}/accounts/{accountId}
    const pathParts = doc.ref.path.split('/')
    const clientId = pathParts.length >= 2 ? pathParts[1] : ''

    accountMap.set(stripped, {
      doc_id: doc.id,
      client_id: clientId,
      path: doc.ref.path,
      data: data as Record<string, unknown>,
    })
  }

  console.log(`  Policy number index built: ${accountMap.size} entries`)
  return accountMap
}

// ============================================================================
// STEP 3 & 4: Create new clients + accounts
// ============================================================================

async function createNewClientsAndAccounts(
  clients: NormalizedClient[],
  existingAccounts: Map<string, ExistingAccount>,
): Promise<{ newClients: number; newAccounts: number; errors: string[] }> {
  console.log('\n[STEP 3+4] Creating new clients and accounts...')

  const now = new Date().toISOString()
  let newClients = 0
  let newAccounts = 0
  const errors: string[] = []

  // Find clients with ALL policies unmatched
  const unmatchedClients: Array<{ client: NormalizedClient; unmatchedPolicies: NormalizedPolicy[] }> = []

  for (const client of clients) {
    const unmatched = client.policies.filter((p) => !existingAccounts.has(p.policy_number_stripped))
    if (unmatched.length > 0) {
      // Check if ANY policy is matched (means client exists but has new policies)
      const matched = client.policies.filter((p) => existingAccounts.has(p.policy_number_stripped))
      if (matched.length === 0) {
        // Fully new client — no policies match anything
        unmatchedClients.push({ client, unmatchedPolicies: unmatched })
      } else {
        // Existing client with new policies — we need to find their client_id
        const firstMatch = existingAccounts.get(matched[0].policy_number_stripped)!
        for (const pol of unmatched) {
          const accountId = randomUUID()
          const batch = db.batch()
          const ref = db.collection('clients').doc(firstMatch.client_id).collection('accounts').doc(accountId)
          batch.set(ref, {
            account_id: accountId,
            client_id: firstMatch.client_id,
            carrier_name: 'Catholic Order of Foresters',
            policy_number: pol.policy_number,
            product_type: pol.product_type,
            product_name: pol.product_name,
            account_type_category: pol.account_type_category,
            issue_date: pol.issue_date,
            paid_to_date: pol.paid_to_date,
            face_value: pol.face_value,
            annual_premium: pol.annual_premium,
            modal_premium: pol.modal_premium,
            billing_mode: pol.billing_mode,
            cash_value: pol.cash_value,
            fund_value: pol.fund_value,
            annuity_balance: pol.annuity_balance,
            loan_balance: pol.loan_balance,
            loan_interest_balance: pol.loan_interest_balance,
            death_benefit: pol.death_benefit,
            status: 'Active',
            source: 'cof_bob_import',
            import_source: 'cof_bob_import',
            book_of_business: 'Parmenter Agency',
            _cof_enriched_at: now,
            _cof_source: 'parmenter_agency_bob_2026-02-10',
            created_at: now,
            updated_at: now,
          })
          try {
            await batch.commit()
            newAccounts++
          } catch (err) {
            errors.push(`Failed to create account for policy ${pol.policy_number_stripped}: ${err}`)
          }
        }
      }
    }
  }

  console.log(`  Fully new clients to create: ${unmatchedClients.length}`)

  // Create new clients + their accounts in batches
  let batchOps = 0
  let batch = db.batch()

  for (const { client, unmatchedPolicies } of unmatchedClients) {
    const clientId = randomUUID()

    // Create client doc
    const clientRef = db.collection('clients').doc(clientId)
    batch.set(clientRef, {
      client_id: clientId,
      first_name: client.first_name,
      last_name: client.last_name,
      dob: client.dob,
      gender: client.gender,
      address: client.address,
      city: client.city,
      state: client.state,
      zip: client.zip,
      phone: client.phone,
      email: client.email,
      client_status: 'Active',
      client_classification: 'Client',
      book_of_business: 'Parmenter Agency',
      source: 'cof_bob_import',
      import_source: 'cof_bob_import',
      agent_id: 'shane@retireprotected.com',
      carrier_name: 'Catholic Order of Foresters',
      created_at: now,
      updated_at: now,
    })
    batchOps++
    newClients++

    // Create account docs for each policy
    for (const pol of unmatchedPolicies) {
      const accountId = randomUUID()
      const accountRef = db.collection('clients').doc(clientId).collection('accounts').doc(accountId)
      batch.set(accountRef, {
        account_id: accountId,
        client_id: clientId,
        carrier_name: 'Catholic Order of Foresters',
        policy_number: pol.policy_number,
        product_type: pol.product_type,
        product_name: pol.product_name,
        account_type_category: pol.account_type_category,
        issue_date: pol.issue_date,
        paid_to_date: pol.paid_to_date,
        face_value: pol.face_value,
        annual_premium: pol.annual_premium,
        modal_premium: pol.modal_premium,
        billing_mode: pol.billing_mode,
        cash_value: pol.cash_value,
        fund_value: pol.fund_value,
        annuity_balance: pol.annuity_balance,
        loan_balance: pol.loan_balance,
        loan_interest_balance: pol.loan_interest_balance,
        death_benefit: pol.death_benefit,
        status: 'Active',
        source: 'cof_bob_import',
        import_source: 'cof_bob_import',
        book_of_business: 'Parmenter Agency',
        _cof_enriched_at: now,
        _cof_source: 'parmenter_agency_bob_2026-02-10',
        created_at: now,
        updated_at: now,
      })
      batchOps++
      newAccounts++

      // Flush batch at 490 to stay under 500 limit
      if (batchOps >= 490) {
        try {
          await batch.commit()
        } catch (err) {
          errors.push(`Batch commit failed (new clients): ${err}`)
        }
        batch = db.batch()
        batchOps = 0
      }
    }
  }

  // Flush remaining
  if (batchOps > 0) {
    try {
      await batch.commit()
    } catch (err) {
      errors.push(`Final batch commit failed (new clients): ${err}`)
    }
  }

  console.log(`  New clients created: ${newClients}`)
  console.log(`  New accounts created: ${newAccounts}`)
  if (errors.length > 0) console.log(`  Errors: ${errors.length}`)

  return { newClients, newAccounts, errors }
}

// ============================================================================
// STEP 5: Enrich existing accounts
// ============================================================================

interface EnrichmentStats {
  total: number
  cash_value: number
  fund_value: number
  annuity_balance: number
  loan_balance: number
  loan_interest_balance: number
  paid_to_date: number
  annual_premium: number
  modal_premium: number
  billing_mode: number
  face_value: number
  death_benefit: number
  issue_date: number
  product_name: number
  errors: string[]
}

async function enrichExistingAccounts(
  clients: NormalizedClient[],
  existingAccounts: Map<string, ExistingAccount>,
): Promise<EnrichmentStats> {
  console.log('\n[STEP 5] Enriching existing accounts...')

  const now = new Date().toISOString()
  const stats: EnrichmentStats = {
    total: 0,
    cash_value: 0,
    fund_value: 0,
    annuity_balance: 0,
    loan_balance: 0,
    loan_interest_balance: 0,
    paid_to_date: 0,
    annual_premium: 0,
    modal_premium: 0,
    billing_mode: 0,
    face_value: 0,
    death_benefit: 0,
    issue_date: 0,
    product_name: 0,
    errors: [],
  }

  // Collect all matched policies
  const updates: Array<{ path: string; existing: ExistingAccount; policy: NormalizedPolicy }> = []
  for (const client of clients) {
    for (const pol of client.policies) {
      const existing = existingAccounts.get(pol.policy_number_stripped)
      if (existing) {
        updates.push({ path: existing.path, existing, policy: pol })
      }
    }
  }

  console.log(`  Matched policies to enrich: ${updates.length}`)

  // Process in batches of 490
  let batch = db.batch()
  let batchOps = 0

  for (const { path, existing, policy } of updates) {
    const update: Record<string, unknown> = {
      _cof_enriched_at: now,
      _cof_source: 'parmenter_agency_bob_2026-02-10',
      updated_at: now,
    }

    // Always update these if CoF has non-zero value
    if (policy.cash_value !== 0) { update.cash_value = policy.cash_value; stats.cash_value++ }
    if (policy.fund_value !== 0) { update.fund_value = policy.fund_value; stats.fund_value++ }
    if (policy.annuity_balance !== 0) { update.annuity_balance = policy.annuity_balance; stats.annuity_balance++ }
    if (policy.loan_balance !== 0) { update.loan_balance = policy.loan_balance; stats.loan_balance++ }
    if (policy.loan_interest_balance !== 0) { update.loan_interest_balance = policy.loan_interest_balance; stats.loan_interest_balance++ }
    if (policy.paid_to_date) { update.paid_to_date = policy.paid_to_date; stats.paid_to_date++ }
    if (policy.annual_premium !== 0) { update.annual_premium = policy.annual_premium; stats.annual_premium++ }
    if (policy.modal_premium !== 0) { update.modal_premium = policy.modal_premium; stats.modal_premium++ }
    if (policy.billing_mode) { update.billing_mode = policy.billing_mode; stats.billing_mode++ }

    // Only update if existing is empty/zero
    const existingData = existing.data
    if (!existingData.face_value && policy.face_value !== 0) { update.face_value = policy.face_value; stats.face_value++ }
    if (!existingData.death_benefit && policy.death_benefit !== 0) { update.death_benefit = policy.death_benefit; stats.death_benefit++ }
    if (!existingData.issue_date && policy.issue_date) { update.issue_date = policy.issue_date; stats.issue_date++ }
    if (!existingData.product_name && policy.product_name) { update.product_name = policy.product_name; stats.product_name++ }

    const ref = db.doc(path)
    batch.update(ref, update)
    batchOps++
    stats.total++

    if (batchOps >= 490) {
      try {
        await batch.commit()
        process.stdout.write(`  Committed batch (${stats.total} so far)\r`)
      } catch (err) {
        stats.errors.push(`Batch commit failed at ${stats.total}: ${err}`)
      }
      batch = db.batch()
      batchOps = 0
    }
  }

  // Flush remaining
  if (batchOps > 0) {
    try {
      await batch.commit()
    } catch (err) {
      stats.errors.push(`Final batch commit failed: ${err}`)
    }
  }

  console.log(`  Accounts enriched: ${stats.total}`)
  return stats
}

// ============================================================================
// STEP 6: DeDup scan
// ============================================================================

async function dedupScan(): Promise<{ count: number; duplicates: Array<{ policy_number: string; paths: string[] }> }> {
  console.log('\n[STEP 6] Running DeDup scan on CoF accounts...')

  const snap = await db.collectionGroup('accounts')
    .where('carrier_name', '==', 'Catholic Order of Foresters')
    .get()

  console.log(`  Total CoF accounts after import: ${snap.size}`)

  // Group by stripped policy number
  const policyMap = new Map<string, string[]>()
  for (const doc of snap.docs) {
    const policyNum = String(doc.data().policy_number || '')
    const stripped = stripLeadingZeros(policyNum)
    if (!stripped || stripped === '0') continue
    const paths = policyMap.get(stripped) || []
    paths.push(doc.ref.path)
    policyMap.set(stripped, paths)
  }

  const duplicates: Array<{ policy_number: string; paths: string[] }> = []
  for (const [policyNumber, paths] of policyMap) {
    if (paths.length > 1) {
      duplicates.push({ policy_number: policyNumber, paths })
    }
  }

  console.log(`  Duplicate policy numbers found: ${duplicates.length}`)
  return { count: duplicates.length, duplicates }
}

// ============================================================================
// STEP 7: Report
// ============================================================================

function printReport(
  clients: NormalizedClient[],
  existingAccountCount: number,
  newClientCount: number,
  newAccountCount: number,
  enrichStats: EnrichmentStats,
  dedup: { count: number; duplicates: Array<{ policy_number: string; paths: string[] }> },
  errors: string[],
): string {
  const totalPolicies = clients.reduce((sum, c) => sum + c.policies.length, 0)
  const now = new Date().toISOString()

  const report = `
=== COF PARMENTER AGENCY IMPORT REPORT ===
Date: ${now}
Source: Parmenter Agency.xlsx (${totalPolicies} policies)

CLIENTS:
  Existing matched: ${clients.length - newClientCount}
  New created: ${newClientCount}
  Total unique clients in source: ${clients.length}

ACCOUNTS:
  Existing enriched: ${enrichStats.total}
  New created: ${newAccountCount}
  Total policies in source: ${totalPolicies}
  Total CoF accounts in Firestore before: ${existingAccountCount}

ENRICHMENT SUMMARY:
  cash_value updated: ${enrichStats.cash_value} accounts
  fund_value updated: ${enrichStats.fund_value} accounts
  annuity_balance updated: ${enrichStats.annuity_balance} accounts
  loan_balance updated: ${enrichStats.loan_balance} accounts
  loan_interest_balance updated: ${enrichStats.loan_interest_balance} accounts
  paid_to_date updated: ${enrichStats.paid_to_date} accounts
  annual_premium updated: ${enrichStats.annual_premium} accounts
  modal_premium updated: ${enrichStats.modal_premium} accounts
  billing_mode updated: ${enrichStats.billing_mode} accounts
  face_value updated (was empty): ${enrichStats.face_value} accounts
  death_benefit updated (was empty): ${enrichStats.death_benefit} accounts
  issue_date updated (was empty): ${enrichStats.issue_date} accounts
  product_name updated (was empty): ${enrichStats.product_name} accounts

DEDUP:
  Duplicate policy numbers found: ${dedup.count}
${dedup.duplicates.length > 0 ? dedup.duplicates.map((d) => `    Policy ${d.policy_number}: ${d.paths.length} copies`).join('\n') : '    None'}

ERRORS:
${[...errors, ...enrichStats.errors].length > 0 ? [...errors, ...enrichStats.errors].map((e) => `    ${e}`).join('\n') : '    None'}
`
  console.log(report)
  return report
}

// ============================================================================
// STEP 8: Register in ATLAS source_registry
// ============================================================================

async function registerInAtlas(): Promise<void> {
  console.log('\n[STEP 8] Registering in ATLAS source_registry...')
  const now = new Date().toISOString()
  const docId = 'cof-parmenter-agency-bob'

  await db.collection('source_registry').doc(docId).set({
    source_name: 'Catholic Order of Foresters',
    source_type: 'carrier_bob_export',
    data_domain: 'ACCOUNTS',
    carrier_name: 'Catholic Order of Foresters',
    current_source: 'XLSX from carrier portal',
    current_method: 'Manual download',
    current_frequency: 'On-demand',
    current_owner_email: 'johnbehn@retireprotected.com',
    last_pull_at: now,
    portal: 'PRODASHX',
    automation_level: 'Manual',
    gap_status: 'YELLOW',
    priority: 'HIGH',
    notes: 'Parmenter Agency BoB — 2,192 policies. Imported 2026-03-15.',
    status: 'active',
    created_at: now,
    updated_at: now,
  })
  console.log(`  Created source_registry/${docId}`)
}

// ============================================================================
// STEP 9: Create FORGE tracker_item
// ============================================================================

async function createForgeTicket(reportSummary: string): Promise<void> {
  console.log('\n[STEP 9] Creating FORGE tracker item...')

  // Find next TRK number
  const existing = await db.collection('tracker_items').orderBy('item_id', 'desc').limit(1).get()
  let nextNum = 1
  if (!existing.empty) {
    const lastId = (existing.docs[0].data().item_id || 'TRK-000') as string
    nextNum = parseInt(lastId.replace('TRK-', ''), 10) + 1
  }

  const itemId = `TRK-${String(nextNum).padStart(3, '0')}`
  const now = new Date().toISOString()

  await db.collection('tracker_items').doc(itemId).set({
    item_id: itemId,
    title: 'CoF Parmenter Agency BoB Import — 2,192 policies processed',
    description: 'Bulk import of Catholic Order of Foresters Book of Business from Parmenter Agency XLSX export. Enriched existing accounts and created new client/account records.',
    type: 'improve',
    status: 'confirmed',
    portal: 'DATA',
    scope: 'Data',
    component: 'Data Import',
    section: 'CoF',
    sprint_id: null,
    notes: reportSummary.trim(),
    created_by: 'import-pipeline@retireprotected.com',
    created_at: now,
    updated_at: now,
  })
  console.log(`  Created tracker_items/${itemId}`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('========================================')
  console.log('CoF Parmenter Agency BoB Import')
  console.log('Target: Firestore (claude-mcp-484718)')
  console.log('========================================')

  const startTime = Date.now()

  // Step 1: Load + normalize
  const clients = loadAndNormalize()

  // Step 2: Load existing accounts
  const existingAccounts = await loadExistingAccounts()

  // Count existing CoF accounts for report
  let existingCofCount = 0
  for (const [, acct] of existingAccounts) {
    if (acct.data.carrier_name === 'Catholic Order of Foresters') existingCofCount++
  }
  console.log(`  Existing CoF accounts: ${existingCofCount}`)

  // Steps 3+4: Create new clients and accounts
  const { newClients, newAccounts, errors } = await createNewClientsAndAccounts(clients, existingAccounts)

  // Step 5: Enrich existing accounts
  const enrichStats = await enrichExistingAccounts(clients, existingAccounts)

  // Step 6: DeDup scan
  const dedup = await dedupScan()

  // Step 7: Report
  const report = printReport(
    clients,
    existingCofCount,
    newClients,
    newAccounts,
    enrichStats,
    dedup,
    errors,
  )

  // Step 8: ATLAS registration
  await registerInAtlas()

  // Step 9: FORGE ticket
  await createForgeTicket(report)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nImport complete in ${elapsed}s`)
}

main().catch((err) => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
