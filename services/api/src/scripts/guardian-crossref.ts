// ============================================================================
// GUARDIAN Cross-Reference — TRK-245
// Internal Firestore consistency checks: linkage, orphans, carrier matching.
// Run: npx tsx services/api/src/scripts/guardian-crossref.ts
// ============================================================================

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

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

  if (result.details) {
    console.log(`  ${result.details}`)
  }

  if (result.sampleIds.length > 0) {
    console.log(`  Sample IDs (up to 10):`)
    for (const id of result.sampleIds.slice(0, 10)) {
      console.log(`    - ${id}`)
    }
  }
}

// ── Check 1: Client → Account linkage ──────────────────────────────────────

async function checkClientAccountLinkage(): Promise<CheckResult> {
  console.log('  Checking client→account linkage...')

  const clientSnap = await db.collection('clients').get()
  const clientsWithoutAccounts: string[] = []

  // Sample up to 200 clients for subcollection checks (avoid reading all 29K)
  const sampleSize = Math.min(clientSnap.size, 200)
  const shuffledDocs = [...clientSnap.docs].sort(() => Math.random() - 0.5).slice(0, sampleSize)

  for (const doc of shuffledDocs) {
    const accountSnap = await db
      .collection('clients')
      .doc(doc.id)
      .collection('accounts')
      .limit(1)
      .get()

    if (accountSnap.empty) {
      clientsWithoutAccounts.push(doc.id)
    }
  }

  return {
    title: 'Client → Account Linkage (clients with zero accounts)',
    total: sampleSize,
    issues: clientsWithoutAccounts.length,
    sampleIds: clientsWithoutAccounts,
    details: `Sampled ${sampleSize} of ${clientSnap.size} total clients`,
  }
}

// ── Check 2: Account → Client orphans ──────────────────────────────────────

async function checkAccountClientOrphans(): Promise<CheckResult> {
  console.log('  Checking account→client orphans...')

  // Get all client IDs into a Set for fast lookup
  const clientSnap = await db.collection('clients').select().get()
  const clientIds = new Set(clientSnap.docs.map((d) => d.id))

  // Sample clients and check their accounts
  const sampleSize = Math.min(clientSnap.size, 200)
  const shuffledClients = [...clientSnap.docs]
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize)

  const orphanAccounts: string[] = []
  let totalAccounts = 0

  for (const clientDoc of shuffledClients) {
    const accountSnap = await db
      .collection('clients')
      .doc(clientDoc.id)
      .collection('accounts')
      .get()

    for (const accountDoc of accountSnap.docs) {
      totalAccounts++
      const data = accountDoc.data()
      const clientId = data.client_id as string | undefined

      // Check if client_id field references a valid client
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

// ── Check 3: Household → Client linkage ────────────────────────────────────

async function checkHouseholdClientLinkage(): Promise<CheckResult> {
  console.log('  Checking household→client linkage...')

  const householdSnap = await db.collection('households').get()
  const clientSnap = await db.collection('clients').select().get()
  const clientIds = new Set(clientSnap.docs.map((d) => d.id))

  const brokenLinks: string[] = []

  for (const doc of householdSnap.docs) {
    const data = doc.data()

    // Check primary_contact_id
    const primaryId = data.primary_contact_id as string | undefined
    if (primaryId && !clientIds.has(primaryId)) {
      brokenLinks.push(`${doc.id} → primary_contact_id: ${primaryId}`)
    }

    // Check members array
    const members = data.members as Array<{ client_id?: string }> | undefined
    if (Array.isArray(members)) {
      for (const member of members) {
        const memberId = member?.client_id
        if (memberId && !clientIds.has(memberId)) {
          brokenLinks.push(`${doc.id} → member client_id: ${memberId}`)
        }
      }
    }
  }

  return {
    title: 'Household → Client Linkage (broken member references)',
    total: householdSnap.size,
    issues: brokenLinks.length,
    sampleIds: brokenLinks,
  }
}

// ── Check 4: Carrier coverage ──────────────────────────────────────────────

async function checkCarrierCoverage(): Promise<CheckResult> {
  console.log('  Checking carrier coverage...')

  // Build set of known carrier names (display_name + parent_brand)
  const carrierSnap = await db.collection('carriers').get()
  const knownCarriers = new Set<string>()

  for (const doc of carrierSnap.docs) {
    const data = doc.data()
    if (data.display_name) knownCarriers.add(String(data.display_name).toLowerCase())
    if (data.parent_brand) knownCarriers.add(String(data.parent_brand).toLowerCase())
    // Also add carrier_id as some accounts use that
    if (data.carrier_id) knownCarriers.add(String(data.carrier_id).toLowerCase())
  }

  // Sample clients and check their accounts
  const clientSnap = await db.collection('clients').select().get()
  const sampleSize = Math.min(clientSnap.size, 150)
  const shuffledClients = [...clientSnap.docs]
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize)

  const unmatchedCarriers = new Map<string, number>() // carrier_name → count
  let totalAccounts = 0

  for (const clientDoc of shuffledClients) {
    const accountSnap = await db
      .collection('clients')
      .doc(clientDoc.id)
      .collection('accounts')
      .get()

    for (const accountDoc of accountSnap.docs) {
      totalAccounts++
      const data = accountDoc.data()
      const carrierName = data.carrier_name as string | undefined

      if (carrierName && !knownCarriers.has(carrierName.toLowerCase())) {
        unmatchedCarriers.set(
          carrierName,
          (unmatchedCarriers.get(carrierName) || 0) + 1
        )
      }
    }
  }

  const sortedUnmatched = [...unmatchedCarriers.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count} accounts)`)

  return {
    title: 'Carrier Coverage (account carrier_name not in carriers collection)',
    total: totalAccounts,
    issues: sortedUnmatched.length,
    sampleIds: sortedUnmatched,
    details: `Checked ${totalAccounts} accounts against ${carrierSnap.size} known carriers`,
  }
}

// ── Check 5: Field completeness ────────────────────────────────────────────

async function checkFieldCompleteness(): Promise<CheckResult> {
  console.log('  Checking field completeness...')

  const RECOMMENDED_FIELDS = ['email', 'phone', 'dob', 'address', 'client_status', 'household_id']

  const clientSnap = await db.collection('clients').limit(500).get()
  const sampleSize = Math.min(clientSnap.size, 100)
  const shuffledDocs = [...clientSnap.docs]
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize)

  const fieldCounts: Record<string, number> = {}
  for (const field of RECOMMENDED_FIELDS) {
    fieldCounts[field] = 0
  }

  for (const doc of shuffledDocs) {
    const data = doc.data()
    for (const field of RECOMMENDED_FIELDS) {
      if (isNonEmpty(data[field])) {
        fieldCounts[field]++
      }
    }
  }

  // Format as sample IDs for display
  const coverageLines = RECOMMENDED_FIELDS.map((field) => {
    const pct = Math.round((fieldCounts[field] / sampleSize) * 100)
    const status = pct >= 90 ? 'OK' : pct >= 50 ? 'WARN' : 'LOW'
    return `${field.padEnd(20)} ${pct}% populated  [${status}]`
  })

  // Count fields below 50% as "issues"
  const lowFields = RECOMMENDED_FIELDS.filter(
    (f) => (fieldCounts[f] / sampleSize) * 100 < 50
  ).length

  return {
    title: 'Field Completeness (recommended fields on clients)',
    total: sampleSize,
    issues: lowFields,
    sampleIds: coverageLines,
    details: `Sampled ${sampleSize} clients. Fields below 50% marked as issues.`,
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GUARDIAN CROSS-REFERENCE ===')
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  const checks = [
    checkClientAccountLinkage,
    checkAccountClientOrphans,
    checkHouseholdClientLinkage,
    checkCarrierCoverage,
    checkFieldCompleteness,
  ]

  const results: CheckResult[] = []

  for (const checkFn of checks) {
    try {
      const result = await checkFn()
      results.push(result)
      printCheck(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Check failed: ${msg}`)
      results.push({
        title: 'CHECK_ERROR',
        total: 0,
        issues: 0,
        sampleIds: [msg],
      })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('CROSS-REFERENCE SUMMARY')
  console.log('='.repeat(60))

  let totalIssues = 0
  for (const r of results) {
    const status = r.issues === 0 ? 'CLEAN' : `${r.issues} issues`
    const label = r.title.split('(')[0].trim()
    console.log(`  ${label.padEnd(45)} ${status}`)
    totalIssues += r.issues
  }

  console.log(`\n  Total issues: ${totalIssues}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error('Cross-reference failed:', err)
  process.exit(1)
})
