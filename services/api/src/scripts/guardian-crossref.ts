// ============================================================================
// GUARDIAN Cross-Reference — TRK-13545 (REWRITE)
// Firestore vs MATRIX Sheets comparison + internal consistency checks.
// Run: npx tsx services/api/src/scripts/guardian-crossref.ts
// ============================================================================

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ── MATRIX Sheet IDs (from bridge .env) ──
const PRODASH_MATRIX_ID = '1byyXMJDpjzgqkhTjJ2GdvTclaGYMDKQ1BQEnz61Eg-w'
const ACCOUNT_TABS = ['_ACCOUNT_ANNUITY', '_ACCOUNT_LIFE', '_ACCOUNT_MEDICARE', '_ACCOUNT_INVESTMENTS']

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

async function getSheetColumn(sheetsClient: ReturnType<typeof google.sheets>, spreadsheetId: string, tab: string, column: string): Promise<string[]> {
  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tab}'!${column}:${column}`,
    })
    const rows = res.data.values || []
    // Skip header row, filter empty
    return rows.slice(1).map(r => String(r[0] || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface CheckResult {
  title: string
  total: number
  issues: number
  sampleIds: string[]
  details?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  return true
}

function printCheck(result: CheckResult) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${result.title}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  Total checked: ${result.total}`)
  console.log(`  Issues found:  ${result.issues}`)
  if (result.details) console.log(`  ${result.details}`)
  if (result.sampleIds.length > 0) {
    console.log(`  Sample (up to 10):`)
    for (const id of result.sampleIds.slice(0, 10)) {
      console.log(`    - ${id}`)
    }
  }
}

// ── Load pre-fetched Sheets data ────────────────────────────────────────────

function loadSheetsData() {
  const baseDir = path.resolve(__dirname, '../../../../.claude/guardian-ui-ux')

  const clientIdsPath = path.join(baseDir, 'sheets-client-ids.json')
  const countsPath = path.join(baseDir, 'sheets-counts.json')

  if (!fs.existsSync(clientIdsPath) || !fs.existsSync(countsPath)) {
    console.log('  WARNING: Pre-fetched Sheets data not found. Run the gdrive MCP pre-fetch first.')
    console.log(`  Expected: ${clientIdsPath}`)
    return null
  }

  const clientIds: string[] = JSON.parse(fs.readFileSync(clientIdsPath, 'utf8'))
  const counts = JSON.parse(fs.readFileSync(countsPath, 'utf8'))

  return { clientIds, counts }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1: FIRESTORE vs SHEETS COMPARISON (NEW — TRK-13545)
// ══════════════════════════════════════════════════════════════════════════════

async function checkClientCountDelta(sheetsClientIds: string[]): Promise<CheckResult> {
  console.log('  Checking client count delta (Firestore vs Sheets)...')

  const firestoreSnap = await db.collection('clients').count().get()
  const firestoreCount = firestoreSnap.data().count
  const sheetsCount = sheetsClientIds.length
  const delta = sheetsCount - firestoreCount
  const pctDiff = Math.round((Math.abs(delta) / Math.max(sheetsCount, firestoreCount)) * 1000) / 10

  return {
    title: 'Client Count Delta (Sheets vs Firestore)',
    total: Math.max(sheetsCount, firestoreCount),
    issues: Math.abs(delta),
    sampleIds: [
      `Sheets (_CLIENT_MASTER): ${sheetsCount} rows`,
      `Firestore (clients):     ${firestoreCount} docs`,
      `Delta:                   ${delta > 0 ? '+' : ''}${delta} (${pctDiff}% difference)`,
      delta > 0 ? `${delta} records exist in Sheets but may be missing from Firestore` : `${Math.abs(delta)} records exist in Firestore but not in Sheets`,
    ],
  }
}

async function checkAccountCountDelta(sheetsCounts: Record<string, number>): Promise<CheckResult> {
  console.log('  Checking account count delta (Firestore vs Sheets)...')

  // Count all Firestore accounts by scanning client subcollections (sample 500 clients, extrapolate)
  const clientSnap = await db.collection('clients').select().get()
  const sampleSize = Math.min(clientSnap.size, 500)
  const shuffled = [...clientSnap.docs].sort(() => Math.random() - 0.5).slice(0, sampleSize)

  let sampleAccounts = 0
  for (const doc of shuffled) {
    const accSnap = await db.collection('clients').doc(doc.id).collection('accounts').count().get()
    sampleAccounts += accSnap.data().count
  }

  const estimatedTotal = Math.round((sampleAccounts / sampleSize) * clientSnap.size)
  const sheetsTotal = (sheetsCounts.ACCOUNT_ANNUITY || 0) + (sheetsCounts.ACCOUNT_LIFE || 0) +
    (sheetsCounts.ACCOUNT_MEDICARE || 0) + (sheetsCounts.ACCOUNT_INVESTMENTS || 0)

  return {
    title: 'Account Count Delta (Sheets vs Firestore estimate)',
    total: Math.max(sheetsTotal, estimatedTotal),
    issues: Math.abs(sheetsTotal - estimatedTotal),
    sampleIds: [
      `Sheets account tabs total: ${sheetsTotal} rows`,
      `  _ACCOUNT_ANNUITY:       ${sheetsCounts.ACCOUNT_ANNUITY || 0}`,
      `  _ACCOUNT_LIFE:          ${sheetsCounts.ACCOUNT_LIFE || '?'}`,
      `  _ACCOUNT_MEDICARE:      ${sheetsCounts.ACCOUNT_MEDICARE || '?'} (may be truncated at 9999)`,
      `  _ACCOUNT_INVESTMENTS:   ${sheetsCounts.ACCOUNT_INVESTMENTS || 0}`,
      `Firestore estimate:       ~${estimatedTotal} accounts (sampled ${sampleSize}/${clientSnap.size} clients → ${sampleAccounts} accounts)`,
      `Delta:                    ~${sheetsTotal - estimatedTotal}`,
    ],
  }
}

async function checkLostInMigration(sheetsClientIds: string[]): Promise<CheckResult> {
  console.log('  Checking lost in migration (in Sheets, not in Firestore)...')

  // Load all Firestore client IDs
  const firestoreSnap = await db.collection('clients').select().get()
  const firestoreIds = new Set(firestoreSnap.docs.map(d => d.id))

  // Also check by client_id field (some docs use doc ID !== client_id)
  const clientIdField = new Set<string>()
  for (const doc of firestoreSnap.docs) {
    const cid = doc.data().client_id
    if (cid) clientIdField.add(cid)
  }

  const allFirestoreIds = new Set([...firestoreIds, ...clientIdField])

  const lost: string[] = []
  for (const sheetsId of sheetsClientIds) {
    if (!allFirestoreIds.has(sheetsId)) {
      lost.push(sheetsId)
    }
  }

  return {
    title: 'Lost in Migration (in Sheets, NOT in Firestore)',
    total: sheetsClientIds.length,
    issues: lost.length,
    sampleIds: lost.slice(0, 10).map(id => `${id} — in _CLIENT_MASTER, not found in Firestore`),
    details: `${lost.length} of ${sheetsClientIds.length} Sheets clients not found in Firestore (checked doc ID + client_id field)`,
  }
}

async function checkNeverBridged(sheetsClientIds: string[]): Promise<CheckResult> {
  console.log('  Checking never bridged (in Firestore, not in Sheets)...')

  const sheetsIdSet = new Set(sheetsClientIds)

  const firestoreSnap = await db.collection('clients').select('client_id').get()
  const neverBridged: string[] = []

  for (const doc of firestoreSnap.docs) {
    const clientId = doc.data().client_id as string | undefined
    const docId = doc.id
    // Check both doc ID and client_id field
    if (!sheetsIdSet.has(docId) && (!clientId || !sheetsIdSet.has(clientId))) {
      neverBridged.push(docId)
    }
  }

  return {
    title: 'Never Bridged (in Firestore, NOT in Sheets)',
    total: firestoreSnap.size,
    issues: neverBridged.length,
    sampleIds: neverBridged.slice(0, 10).map(id => `${id} — in Firestore, not found in _CLIENT_MASTER`),
    details: `${neverBridged.length} of ${firestoreSnap.size} Firestore clients not found in Sheets`,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2: INTERNAL FIRESTORE CONSISTENCY (preserved from original)
// ══════════════════════════════════════════════════════════════════════════════

async function checkClientAccountLinkage(): Promise<CheckResult> {
  console.log('  Checking client→account linkage...')
  const clientSnap = await db.collection('clients').get()
  const clientsWithoutAccounts: string[] = []
  const sampleSize = Math.min(clientSnap.size, 200)
  const shuffledDocs = [...clientSnap.docs].sort(() => Math.random() - 0.5).slice(0, sampleSize)

  for (const doc of shuffledDocs) {
    const accountSnap = await db.collection('clients').doc(doc.id).collection('accounts').limit(1).get()
    if (accountSnap.empty) clientsWithoutAccounts.push(doc.id)
  }

  return {
    title: 'Client → Account Linkage (clients with zero accounts)',
    total: sampleSize,
    issues: clientsWithoutAccounts.length,
    sampleIds: clientsWithoutAccounts,
    details: `Sampled ${sampleSize} of ${clientSnap.size} total clients`,
  }
}

async function checkAccountClientOrphans(): Promise<CheckResult> {
  console.log('  Checking account→client orphans...')
  const clientSnap = await db.collection('clients').select().get()
  const clientIds = new Set(clientSnap.docs.map(d => d.id))
  const sampleSize = Math.min(clientSnap.size, 200)
  const shuffledClients = [...clientSnap.docs].sort(() => Math.random() - 0.5).slice(0, sampleSize)
  const orphanAccounts: string[] = []
  let totalAccounts = 0

  for (const clientDoc of shuffledClients) {
    const accountSnap = await db.collection('clients').doc(clientDoc.id).collection('accounts').get()
    for (const accountDoc of accountSnap.docs) {
      totalAccounts++
      const clientId = accountDoc.data().client_id as string | undefined
      if (clientId && !clientIds.has(clientId)) {
        orphanAccounts.push(`${clientDoc.id}/accounts/${accountDoc.id} → client_id: ${clientId}`)
      }
    }
  }

  return {
    title: 'Account → Client Orphans (client_id references non-existent client)',
    total: totalAccounts,
    issues: orphanAccounts.length,
    sampleIds: orphanAccounts,
    details: `Checked ${totalAccounts} accounts across ${sampleSize} sampled clients`,
  }
}

async function checkHouseholdClientLinkage(): Promise<CheckResult> {
  console.log('  Checking household→client linkage...')
  const householdSnap = await db.collection('households').get()
  const clientSnap = await db.collection('clients').select().get()
  const clientIds = new Set(clientSnap.docs.map(d => d.id))
  const brokenLinks: string[] = []

  for (const doc of householdSnap.docs) {
    const data = doc.data()
    const primaryId = data.primary_contact_id as string | undefined
    if (primaryId && !clientIds.has(primaryId)) brokenLinks.push(`${doc.id} → primary_contact_id: ${primaryId}`)
    const members = data.members as Array<{ client_id?: string }> | undefined
    if (Array.isArray(members)) {
      for (const member of members) {
        if (member?.client_id && !clientIds.has(member.client_id)) {
          brokenLinks.push(`${doc.id} → member client_id: ${member.client_id}`)
        }
      }
    }
  }

  return { title: 'Household → Client Linkage (broken member references)', total: householdSnap.size, issues: brokenLinks.length, sampleIds: brokenLinks }
}

async function checkCarrierCoverage(): Promise<CheckResult> {
  console.log('  Checking carrier coverage...')
  const carrierSnap = await db.collection('carriers').get()
  const knownCarriers = new Set<string>()
  for (const doc of carrierSnap.docs) {
    const data = doc.data()
    if (data.display_name) knownCarriers.add(String(data.display_name).toLowerCase())
    if (data.parent_brand) knownCarriers.add(String(data.parent_brand).toLowerCase())
    if (data.carrier_id) knownCarriers.add(String(data.carrier_id).toLowerCase())
  }

  const clientSnap = await db.collection('clients').select().get()
  const sampleSize = Math.min(clientSnap.size, 150)
  const shuffledClients = [...clientSnap.docs].sort(() => Math.random() - 0.5).slice(0, sampleSize)
  const unmatchedCarriers = new Map<string, number>()
  let totalAccounts = 0

  for (const clientDoc of shuffledClients) {
    const accountSnap = await db.collection('clients').doc(clientDoc.id).collection('accounts').get()
    for (const accountDoc of accountSnap.docs) {
      totalAccounts++
      const carrierName = accountDoc.data().carrier_name as string | undefined
      if (carrierName && !knownCarriers.has(carrierName.toLowerCase())) {
        unmatchedCarriers.set(carrierName, (unmatchedCarriers.get(carrierName) || 0) + 1)
      }
    }
  }

  const sorted = [...unmatchedCarriers.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} (${count} accounts)`)
  return {
    title: 'Carrier Coverage (account carrier_name not in carriers collection)',
    total: totalAccounts,
    issues: sorted.length,
    sampleIds: sorted,
    details: `Checked ${totalAccounts} accounts against ${carrierSnap.size} known carriers`,
  }
}

async function checkFieldCompleteness(): Promise<CheckResult> {
  console.log('  Checking field completeness...')
  const RECOMMENDED_FIELDS = ['email', 'phone', 'dob', 'address', 'client_status', 'household_id']
  const clientSnap = await db.collection('clients').limit(500).get()
  const sampleSize = Math.min(clientSnap.size, 100)
  const shuffledDocs = [...clientSnap.docs].sort(() => Math.random() - 0.5).slice(0, sampleSize)
  const fieldCounts: Record<string, number> = {}
  for (const field of RECOMMENDED_FIELDS) fieldCounts[field] = 0

  for (const doc of shuffledDocs) {
    const data = doc.data()
    for (const field of RECOMMENDED_FIELDS) {
      if (isNonEmpty(data[field])) fieldCounts[field]++
    }
  }

  const coverageLines = RECOMMENDED_FIELDS.map(field => {
    const pct = Math.round((fieldCounts[field] / sampleSize) * 100)
    const status = pct >= 90 ? 'OK' : pct >= 50 ? 'WARN' : 'LOW'
    return `${field.padEnd(20)} ${pct}% populated  [${status}]`
  })
  const lowFields = RECOMMENDED_FIELDS.filter(f => (fieldCounts[f] / sampleSize) * 100 < 50).length

  return {
    title: 'Field Completeness (recommended fields on clients)',
    total: sampleSize, issues: lowFields, sampleIds: coverageLines,
    details: `Sampled ${sampleSize} clients. Fields below 50% marked as issues.`,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GUARDIAN CROSS-REFERENCE ===')
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  const sheetsData = loadSheetsData()

  const allResults: CheckResult[] = []

  // ── PART 1: Sheets comparison ──
  if (sheetsData) {
    console.log('── PART 1: FIRESTORE vs MATRIX SHEETS ──\n')

    const sheetsChecks = [
      () => checkClientCountDelta(sheetsData.clientIds),
      () => checkAccountCountDelta(sheetsData.counts),
      () => checkLostInMigration(sheetsData.clientIds),
      () => checkNeverBridged(sheetsData.clientIds),
    ]

    for (const checkFn of sheetsChecks) {
      try {
        const result = await checkFn()
        allResults.push(result)
        printCheck(result)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Check failed: ${msg}`)
        allResults.push({ title: 'CHECK_ERROR', total: 0, issues: 0, sampleIds: [msg] })
      }
    }
  } else {
    console.log('  Skipping Sheets comparison (no pre-fetched data)\n')
  }

  // ── PART 2: Internal Firestore consistency ──
  console.log('\n── PART 2: INTERNAL FIRESTORE CONSISTENCY ──\n')

  const internalChecks = [
    checkClientAccountLinkage,
    checkAccountClientOrphans,
    checkHouseholdClientLinkage,
    checkCarrierCoverage,
    checkFieldCompleteness,
  ]

  for (const checkFn of internalChecks) {
    try {
      const result = await checkFn()
      allResults.push(result)
      printCheck(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Check failed: ${msg}`)
      allResults.push({ title: 'CHECK_ERROR', total: 0, issues: 0, sampleIds: [msg] })
    }
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(60))
  console.log('CROSS-REFERENCE SUMMARY')
  console.log('='.repeat(60))

  let totalIssues = 0
  for (const r of allResults) {
    const status = r.issues === 0 ? 'CLEAN' : `${r.issues} issues`
    const label = r.title.split('(')[0].trim()
    console.log(`  ${label.padEnd(50)} ${status}`)
    totalIssues += r.issues
  }

  console.log(`\n  Total issues: ${totalIssues}`)

  // Save JSON report
  const reportPath = path.resolve(__dirname, '../../../../.claude/guardian-ui-ux/crossref-report.json')
  const report = {
    timestamp: new Date().toISOString(),
    sheets_comparison: sheetsData ? allResults.slice(0, 4) : null,
    internal_checks: allResults.slice(sheetsData ? 4 : 0),
    total_issues: totalIssues,
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nReport saved to: ${reportPath}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error('Cross-reference failed:', err)
  process.exit(1)
})
