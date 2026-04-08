/**
 * ATLAS WIRE_DATA_IMPORT — Full Pipeline Execution
 *
 * Runs all 5 super tools in sequence:
 *   SUPER_EXTRACT → SUPER_VALIDATE → SUPER_NORMALIZE → SUPER_MATCH → SUPER_WRITE
 * Then executes the Firestore write batch.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/atlas-import-run.ts                  # DRY RUN (default)
 *   npx tsx services/api/src/scripts/atlas-import-run.ts --commit         # LIVE WRITE
 */

import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Super tools from packages/core
import { executeValidate } from '@tomachina/core/atlas/super-tools/index'
import { executeNormalize } from '@tomachina/core/atlas/super-tools/index'
import { executeMatch } from '@tomachina/core/atlas/super-tools/index'
import { executeWrite } from '@tomachina/core/atlas/super-tools/index'
import type { SuperToolContext } from '@tomachina/core/atlas/types'
import type { MatchTag } from '@tomachina/core/atlas/super-tools/match'

// Carrier format detection
import { detectCarrierFormat, mapRowToCanonical } from '../lib/carrier-formats.js'

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const COMMIT_MODE = process.argv.includes('--commit')
const IMPORT_SOURCE = 'atlas-wire-aetna-humana-bob-20260317'
const BATCH_SIZE = 400 // Firestore batch limit is 500, leave room

const CSV_FILES = [
  {
    label: 'Humana Active Policies (PDP/MAPD)',
    path: '/Users/joshd.millang/Downloads/Active Policies.csv',
    carrier_override: 'Humana',
  },
  {
    label: 'Aetna BoB — Millang Financial Group LLC',
    path: '/Users/joshd.millang/Downloads/Millang Financial Group LLC_MedicareApprovedBOBReport_20260317.csv',
    carrier_override: 'Aetna',
  },
  {
    label: 'Aetna BoB — Mfg Agency LLC',
    path: '/Users/joshd.millang/Downloads/Mfg Agency LLC_MedicareApprovedBOBReport_20260317.csv',
    carrier_override: 'Aetna',
  },
  {
    label: 'Aetna BoB — Mfg Advisor Network',
    path: '/Users/joshd.millang/Downloads/Mfg Advisor Network_MedicareApprovedBOBReport_20260317.csv',
    carrier_override: 'Aetna',
  },
  {
    label: 'Aetna BoB — JOSH MILLANG',
    path: '/Users/joshd.millang/Downloads/JOSH MILLANG_MedicareApprovedBOBReport_20260317.csv',
    carrier_override: 'Aetna',
  },
]

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------
function parseCsv(filePath: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n')
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line)
    const row: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }
  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Load existing clients from Firestore for matching
// ---------------------------------------------------------------------------
async function loadExistingClients(): Promise<Record<string, unknown>[]> {
  console.log('  Loading existing clients from Firestore...')
  const snap = await db.collection('clients').get()
  const clients = snap.docs.map(d => ({ ...d.data(), client_id: d.id }))
  console.log(`  Loaded ${clients.length} existing clients`)
  return clients
}

// ---------------------------------------------------------------------------
// Load existing Medicare accounts for dedup
// ---------------------------------------------------------------------------
async function loadExistingMedicareAccounts(): Promise<Record<string, unknown>[]> {
  console.log('  Loading existing Medicare accounts...')
  // Use collectionGroup without filter to avoid composite index requirement, filter locally
  const snap = await db.collectionGroup('accounts').get()
  const allAccounts = snap.docs.map(d => ({
    ...d.data(),
    account_id: d.id,
    _doc_path: d.ref.path,
  })) as Array<Record<string, unknown>>
  const medicare = allAccounts.filter(a =>
    String(a['account_type_category'] || '').toLowerCase() === 'medicare'
  )
  console.log(`  Loaded ${medicare.length} Medicare accounts (from ${allAccounts.length} total)`)
  return medicare
}

// ---------------------------------------------------------------------------
// Generate short ID
// ---------------------------------------------------------------------------
function genId(): string {
  return randomBytes(12).toString('hex')
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n' + '█'.repeat(100))
  console.log('  ATLAS WIRE_DATA_IMPORT — FULL PIPELINE')
  console.log(`  Date: ${new Date().toISOString()}`)
  console.log(`  Mode: ${COMMIT_MODE ? '🔴 LIVE WRITE' : '🟡 DRY RUN (use --commit to write)'}`)
  console.log(`  Files: ${CSV_FILES.length}`)
  console.log(`  Import source: ${IMPORT_SOURCE}`)
  console.log('█'.repeat(100))

  // Pre-load existing data for SUPER_MATCH
  const existingClients = await loadExistingClients()
  const existingAccounts = await loadExistingMedicareAccounts()

  // Build dedup set from existing accounts: member_id::carrier::effective_date
  const existingAccountKeys = new Set<string>()
  for (const acct of existingAccounts) {
    const key = [
      String(acct.member_id || acct.medicare_id || '').toLowerCase(),
      String(acct.carrier || '').toLowerCase(),
      String(acct.effective_date || ''),
    ].join('::')
    if (key !== '::::') existingAccountKeys.add(key)
  }
  console.log(`  Dedup index: ${existingAccountKeys.size} existing account keys\n`)

  const context: SuperToolContext = {
    wire_id: 'WIRE_DATA_IMPORT',
    run_id: `run_${Date.now()}`,
    triggered_by: IMPORT_SOURCE,
    target_collection: 'clients',
    target_category: 'medicare',
  }

  // Aggregate stats
  let totalRecords = 0
  let totalQualified = 0
  let totalDisqualified = 0
  let totalExistingMatch = 0
  let totalNewInsert = 0
  let totalSpouse = 0
  let totalDuplicate = 0
  let totalReviewNeeded = 0
  let totalAccountDedup = 0
  let totalCreates = 0
  let totalUpdates = 0
  let totalSkips = 0
  const allWriteOps: Array<{
    operation: string
    clientId: string
    accountId: string
    data: Record<string, unknown>
    reason: string
    tag: MatchTag
  }> = []

  for (const file of CSV_FILES) {
    console.log(`\n${'━'.repeat(100)}`)
    console.log(`  FILE: ${file.label}`)
    console.log(`  PATH: ${file.path}`)
    console.log(`${'━'.repeat(100)}`)

    // =========================================================================
    // STAGE 1: SUPER_EXTRACT
    // =========================================================================
    console.log('\n  [SUPER_EXTRACT] Parsing CSV + detecting carrier format...')
    const { headers, rows } = parseCsv(file.path)
    console.log(`  Parsed ${rows.length} rows, ${headers.length} columns`)
    totalRecords += rows.length

    const format = detectCarrierFormat(headers)
    if (!format) {
      console.log('  ✗ NO FORMAT MATCH — skipping file')
      continue
    }
    console.log(`  ✓ Format: ${format.carrier} (${format.carrier_id})`)

    // Map all rows to canonical fields
    const canonicalRecords = rows.map(row => {
      const mapped = mapRowToCanonical(row, format)
      // Set carrier explicitly
      mapped.carrier = file.carrier_override
      mapped.account_type_category = 'Medicare'
      return mapped
    })

    // =========================================================================
    // STAGE 2: SUPER_VALIDATE
    // =========================================================================
    console.log('\n  [SUPER_VALIDATE] Running qualification gate...')
    const validateResult = await executeValidate({ records: canonicalRecords }, context)
    if (!validateResult.success || !validateResult.data) {
      console.log(`  ✗ Validation failed: ${validateResult.error}`)
      continue
    }
    const { qualified, disqualified } = validateResult.data
    console.log(`  ✓ Qualified: ${qualified.length} | Disqualified: ${disqualified.length}`)
    totalQualified += qualified.length
    totalDisqualified += disqualified.length

    if (disqualified.length > 0) {
      console.log('  Disqualified reasons:')
      const reasonCounts: Record<string, number> = {}
      for (const d of disqualified) {
        reasonCounts[d.reason] = (reasonCounts[d.reason] || 0) + 1
      }
      for (const [reason, count] of Object.entries(reasonCounts)) {
        console.log(`    ${count}x — ${reason}`)
      }
    }

    // =========================================================================
    // STAGE 3: SUPER_NORMALIZE
    // =========================================================================
    console.log('\n  [SUPER_NORMALIZE] Running 16 normalizer types across 90+ fields...')
    const normalizeResult = await executeNormalize({ records: qualified }, context)
    if (!normalizeResult.success || !normalizeResult.data) {
      console.log(`  ✗ Normalize failed: ${normalizeResult.error}`)
      continue
    }
    const normalized = normalizeResult.data.records
    console.log(`  ✓ Normalized ${normalized.length} records | Changes: ${normalizeResult.data.total_changes}`)
    console.log(`    breakdown: fields=${normalizeResult.data.change_breakdown.normalize_data} bob=${normalizeResult.data.change_breakdown.normalize_bob} status=${normalizeResult.data.change_breakdown.normalize_status}`)

    // =========================================================================
    // STAGE 3.5: ACCOUNT-LEVEL DEDUP (before client match)
    // =========================================================================
    console.log('\n  [DEDUP CHECK] Checking against existing account keys...')
    const dedupPassed: Record<string, unknown>[] = []
    let dedupSkipped = 0
    for (const rec of normalized) {
      const key = [
        String(rec.member_id || rec.medicare_id || '').toLowerCase(),
        String(rec.carrier || '').toLowerCase(),
        String(rec.effective_date || ''),
      ].join('::')
      if (existingAccountKeys.has(key)) {
        dedupSkipped++
      } else {
        dedupPassed.push(rec)
        // Add to set to catch cross-file duplicates
        if (key !== '::::') existingAccountKeys.add(key)
      }
    }
    console.log(`  ✓ New: ${dedupPassed.length} | Already exists: ${dedupSkipped}`)
    totalAccountDedup += dedupSkipped

    if (dedupPassed.length === 0) {
      console.log('  All records already imported — skipping to next file')
      continue
    }

    // =========================================================================
    // STAGE 4: SUPER_MATCH
    // =========================================================================
    console.log('\n  [SUPER_MATCH] Matching against existing clients...')
    const matchResult = await executeMatch(
      {
        records: dedupPassed,
        existing_clients: existingClients,
        mode: 'client',
      },
      context
    )
    if (!matchResult.success || !matchResult.data) {
      console.log(`  ✗ Match failed: ${matchResult.error}`)
      continue
    }
    const { matched, summary } = matchResult.data
    console.log(`  ✓ Existing: ${summary.existing_matches} | New: ${summary.new_inserts} | Spouse: ${summary.spouse_prospects} | Dup: ${summary.duplicates} | Review: ${summary.review_needed}`)
    totalExistingMatch += summary.existing_matches
    totalNewInsert += summary.new_inserts
    totalSpouse += summary.spouse_prospects
    totalDuplicate += summary.duplicates
    totalReviewNeeded += summary.review_needed

    // =========================================================================
    // STAGE 5: SUPER_WRITE
    // =========================================================================
    console.log('\n  [SUPER_WRITE] Preparing write batch...')
    const writeInput = matched.map(m => ({
      record: m.record,
      tag: m.tag,
      existing_id: m.existing_id,
    }))
    const writeResult = await executeWrite({ records: writeInput }, context)
    if (!writeResult.success || !writeResult.data) {
      console.log(`  ✗ Write prep failed: ${writeResult.error}`)
      continue
    }
    const { batch, summary: writeSummary } = writeResult.data
    console.log(`  ✓ Creates: ${writeSummary.creates} | Updates: ${writeSummary.updates} | Skips: ${writeSummary.skips}`)
    totalCreates += writeSummary.creates
    totalUpdates += writeSummary.updates
    totalSkips += writeSummary.skips

    // Collect write operations for Firestore execution
    for (const op of batch) {
      if (op.operation === 'SKIP') continue

      // Find the matching tag for this record
      const matchedRec = matched.find(m =>
        m.record.first_name === op.data.first_name &&
        m.record.last_name === op.data.last_name &&
        m.record.member_id === op.data.member_id
      )

      allWriteOps.push({
        operation: op.operation,
        clientId: op.document_id || '',
        accountId: genId(),
        data: op.data,
        reason: op.reason,
        tag: matchedRec?.tag || 'NEW_INSERT',
      })
    }
  }

  // ===========================================================================
  // FINAL REPORT
  // ===========================================================================
  console.log('\n' + '█'.repeat(100))
  console.log('  PIPELINE COMPLETE — SUMMARY')
  console.log('█'.repeat(100))
  console.log(`
  Total CSV records:      ${totalRecords}
  Qualified:              ${totalQualified}
  Disqualified:           ${totalDisqualified}
  Account-level dedup:    ${totalAccountDedup} (already in Firestore)
  ─────────────────────────────────────
  Existing client match:  ${totalExistingMatch}
  New inserts:            ${totalNewInsert}
  Spouse prospects:       ${totalSpouse}
  Internal duplicates:    ${totalDuplicate}
  Review needed:          ${totalReviewNeeded}
  ─────────────────────────────────────
  Write batch:
    Creates:              ${totalCreates}
    Updates:              ${totalUpdates}
    Skips:                ${totalSkips}
  ─────────────────────────────────────
  Net Firestore writes:   ${allWriteOps.length}
  `)

  // ===========================================================================
  // FIRESTORE EXECUTION
  // ===========================================================================
  if (!COMMIT_MODE) {
    console.log('  🟡 DRY RUN — No writes executed.')
    console.log('  Run with --commit to execute Firestore writes.\n')

    // Show sample of what would be written
    const samples = allWriteOps.slice(0, 5)
    if (samples.length > 0) {
      console.log('  Sample write operations:')
      for (const op of samples) {
        const name = `${op.data.first_name} ${op.data.last_name}`
        const carrier = op.data.carrier
        const plan = op.data.plan_name || 'N/A'
        console.log(`    ${op.operation} | ${name} | ${carrier} | ${plan} | ${op.tag}`)
      }
      if (allWriteOps.length > 5) {
        console.log(`    ... and ${allWriteOps.length - 5} more`)
      }
    }
  } else {
    console.log('  🔴 COMMITTING TO FIRESTORE...\n')

    let written = 0
    let clientsCreated = 0
    let accountsCreated = 0
    let accountsUpdated = 0

    // Process in batches
    for (let i = 0; i < allWriteOps.length; i += BATCH_SIZE) {
      const chunk = allWriteOps.slice(i, i + BATCH_SIZE)
      const batch = db.batch()

      for (const op of chunk) {
        if (op.tag === 'NEW_INSERT' || op.tag === 'SPOUSE_PROSPECT') {
          // Create new client + account
          const clientId = genId()
          const accountId = op.accountId

          // Extract client fields from account data
          const clientData: Record<string, unknown> = {
            client_id: clientId,
            first_name: op.data.first_name,
            last_name: op.data.last_name,
            middle_initial: op.data.middle_initial || '',
            dob: op.data.dob || '',
            phone: op.data.phone || '',
            email: op.data.email || '',
            address_line1: op.data.address_line1 || op.data.address || '',
            address_line2: op.data.address_line2 || '',
            city: op.data.city || '',
            state: op.data.state || '',
            zip: op.data.zip || '',
            county: op.data.county || '',
            status: 'Active',
            client_classification: op.tag === 'SPOUSE_PROSPECT' ? 'Prospect' : 'Client',
            import_source: IMPORT_SOURCE,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          }

          if (op.tag === 'SPOUSE_PROSPECT' && op.clientId) {
            clientData.relationship_type = 'spouse'
            clientData.related_client_id = op.clientId
          }

          const clientRef = db.collection('clients').doc(clientId)
          batch.set(clientRef, clientData)
          clientsCreated++

          // Create account under client
          const accountData: Record<string, unknown> = {
            account_id: accountId,
            client_id: clientId,
            carrier: op.data.carrier,
            carrier_id: op.data.carrier_id,
            account_type_category: 'Medicare',
            plan_name: op.data.plan_name || '',
            product_type: op.data.product_type || '',
            member_id: op.data.member_id || '',
            medicare_id: op.data.medicare_id || '',
            effective_date: op.data.effective_date || '',
            termination_date: op.data.termination_date || '',
            status: op.data.status || 'Active',
            monthly_premium: op.data.monthly_premium || 0,
            cms_plan_code: op.data.cms_plan_code || '',
            election_type: op.data.election_type || '',
            agent_npn: op.data.agent_npn || '',
            agent_name: op.data.agent_name || '',
            submitted_date: op.data.submitted_date || '',
            book_of_business: op.data.book_of_business || '',
            import_source: IMPORT_SOURCE,
            _source: 'atlas-wire',
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          }

          // Preserve raw fields (prefixed with _raw_)
          for (const [key, val] of Object.entries(op.data)) {
            if (key.startsWith('_raw_') && val) {
              accountData[key] = val
            }
          }

          const accountRef = clientRef.collection('accounts').doc(accountId)
          batch.set(accountRef, accountData)
          accountsCreated++
        } else if (op.tag === 'EXISTING_MATCH' && op.clientId) {
          // Create account under existing client (fill-blank enrichment)
          const accountId = op.accountId
          const clientRef = db.collection('clients').doc(op.clientId)

          const accountData: Record<string, unknown> = {
            account_id: accountId,
            client_id: op.clientId,
            carrier: op.data.carrier,
            carrier_id: op.data.carrier_id,
            account_type_category: 'Medicare',
            plan_name: op.data.plan_name || '',
            product_type: op.data.product_type || '',
            member_id: op.data.member_id || '',
            medicare_id: op.data.medicare_id || '',
            effective_date: op.data.effective_date || '',
            termination_date: op.data.termination_date || '',
            status: op.data.status || 'Active',
            monthly_premium: op.data.monthly_premium || 0,
            cms_plan_code: op.data.cms_plan_code || '',
            election_type: op.data.election_type || '',
            agent_npn: op.data.agent_npn || '',
            agent_name: op.data.agent_name || '',
            submitted_date: op.data.submitted_date || '',
            book_of_business: op.data.book_of_business || '',
            import_source: IMPORT_SOURCE,
            _source: 'atlas-wire',
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          }

          for (const [key, val] of Object.entries(op.data)) {
            if (key.startsWith('_raw_') && val) {
              accountData[key] = val
            }
          }

          const accountRef = clientRef.collection('accounts').doc(accountId)
          batch.set(accountRef, accountData)
          accountsUpdated++

          // Also update client with any missing contact info
          const updateFields: Record<string, unknown> = {
            updated_at: FieldValue.serverTimestamp(),
            last_import_source: IMPORT_SOURCE,
          }
          // Fill blanks only — never overwrite existing
          if (op.data.phone) updateFields[`_import_phone_${op.data.carrier_id}`] = op.data.phone
          if (op.data.email) updateFields[`_import_email_${op.data.carrier_id}`] = op.data.email
          batch.update(clientRef, updateFields)
        }

        written++
      }

      await batch.commit()
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: committed ${chunk.length} operations`)
    }

    console.log(`\n  ✅ DONE!`)
    console.log(`  Clients created:  ${clientsCreated}`)
    console.log(`  Accounts created: ${accountsCreated}`)
    console.log(`  Accounts updated: ${accountsUpdated} (under existing clients)`)
    console.log(`  Total writes:     ${written}`)
  }

  console.log('\n' + '█'.repeat(100))
  console.log('  ATLAS WIRE_DATA_IMPORT COMPLETE')
  console.log('█'.repeat(100) + '\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
