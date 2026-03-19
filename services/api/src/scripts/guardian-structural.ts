// ============================================================================
// GUARDIAN Structural Health — TRK-13547 + TRK-13548
// Full Firestore scan: field coverage, duplicates, carrier audit, collection sizes.
// Run: npx tsx services/api/src/scripts/guardian-structural.ts
// ============================================================================

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ── Config ──────────────────────────────────────────────────────────────────

const CLIENT_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'dob', 'address', 'city',
  'state', 'zip', 'client_status', 'household_id', 'agent_name', 'source',
  'ghl_contact_id', 'client_id'
]

const RECOMMENDED_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'dob', 'address', 'client_status']

const PROTECTED_COLLECTIONS = [
  'clients', 'carriers', 'households', 'users', 'flow_pipelines', 'flow_stages',
  'tracker_items', 'sprints', 'source_registry', 'tool_registry', 'campaigns',
  'templates', 'communications', 'opportunities', 'revenue', 'case_tasks',
  'content_blocks', 'org_structure'
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

function normalize(s: string | undefined | null): string {
  if (!s) return ''
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

// ── 1. Full Client Scan ─────────────────────────────────────────────────────

interface FieldCoverage { field: string; populated: number; total: number; pct: number }
interface CompletenessDistribution { tier: string; count: number; pct: number }

async function fullClientScan() {
  console.log('\n=== FULL CLIENT SCAN (ALL RECORDS) ===\n')
  const snap = await db.collection('clients').get()
  const total = snap.size
  console.log(`  Total clients: ${total}`)

  // Field coverage
  const fieldCounts: Record<string, number> = {}
  for (const f of CLIENT_FIELDS) fieldCounts[f] = 0

  // Completeness per client
  const completenessScores: number[] = []

  for (const doc of snap.docs) {
    const data = doc.data()
    let populated = 0
    for (const f of CLIENT_FIELDS) {
      if (isNonEmpty(data[f])) fieldCounts[f]++
    }
    for (const f of RECOMMENDED_FIELDS) {
      if (isNonEmpty(data[f])) populated++
    }
    completenessScores.push(Math.round((populated / RECOMMENDED_FIELDS.length) * 100))
  }

  // Field coverage report
  const coverage: FieldCoverage[] = CLIENT_FIELDS.map(f => ({
    field: f,
    populated: fieldCounts[f],
    total,
    pct: Math.round((fieldCounts[f] / total) * 1000) / 10
  }))

  console.log('\n  Field Coverage (ALL clients):')
  for (const c of coverage) {
    const bar = c.pct >= 90 ? 'OK' : c.pct >= 50 ? 'WARN' : 'LOW'
    console.log(`    ${c.field.padEnd(20)} ${String(c.populated).padStart(5)}/${total}  ${c.pct.toFixed(1).padStart(6)}%  [${bar}]`)
  }

  // Completeness distribution
  const tiers = [
    { label: '100% complete', min: 100, max: 100 },
    { label: '75-99%', min: 75, max: 99 },
    { label: '50-74%', min: 50, max: 74 },
    { label: '25-49%', min: 25, max: 49 },
    { label: 'Below 25%', min: 0, max: 24 },
  ]
  const distribution: CompletenessDistribution[] = tiers.map(t => {
    const count = completenessScores.filter(s => s >= t.min && s <= t.max).length
    return { tier: t.label, count, pct: Math.round((count / total) * 1000) / 10 }
  })

  console.log('\n  Completeness Distribution:')
  for (const d of distribution) {
    console.log(`    ${d.tier.padEnd(20)} ${String(d.count).padStart(5)} clients  (${d.pct}%)`)
  }

  return { total, coverage, distribution, docs: snap.docs }
}

// ── 2. Duplicate Detection ──────────────────────────────────────────────────

interface DuplicateCluster { key: string; count: number; docIds: string[]; sample: Record<string, unknown>[] }

async function duplicateDetection(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  console.log('\n=== DUPLICATE DETECTION (FULL DATASET) ===\n')

  // Group by normalized name + dob
  const nameDobGroups = new Map<string, { id: string; data: Record<string, unknown> }[]>()
  const emailGroups = new Map<string, string[]>()
  const phoneGroups = new Map<string, string[]>()

  for (const doc of docs) {
    const data = doc.data()
    const first = normalize(data.first_name as string)
    const last = normalize(data.last_name as string)
    const dob = normalize(data.dob as string)

    if (first && last) {
      const key = `${first}|${last}|${dob}`
      if (!nameDobGroups.has(key)) nameDobGroups.set(key, [])
      nameDobGroups.get(key)!.push({ id: doc.id, data })
    }

    const email = normalize(data.email as string)
    if (email) {
      if (!emailGroups.has(email)) emailGroups.set(email, [])
      emailGroups.get(email)!.push(doc.id)
    }

    const phone = normalize(data.phone as string)
    if (phone) {
      if (!phoneGroups.has(phone)) phoneGroups.set(phone, [])
      phoneGroups.get(phone)!.push(doc.id)
    }
  }

  // Name+DOB duplicates
  const nameDupes: DuplicateCluster[] = []
  for (const [key, entries] of nameDobGroups) {
    if (entries.length > 1) {
      nameDupes.push({
        key,
        count: entries.length,
        docIds: entries.map(e => e.id),
        sample: entries.slice(0, 3).map(e => ({
          id: e.id,
          first_name: e.data.first_name,
          last_name: e.data.last_name,
          dob: e.data.dob,
          email: e.data.email,
          phone: e.data.phone,
        }))
      })
    }
  }
  nameDupes.sort((a, b) => b.count - a.count)

  // Email duplicates
  const emailDupes: { email: string; count: number; docIds: string[] }[] = []
  for (const [email, ids] of emailGroups) {
    if (ids.length > 1) emailDupes.push({ email, count: ids.length, docIds: ids })
  }
  emailDupes.sort((a, b) => b.count - a.count)

  // Phone duplicates
  const phoneDupes: { phone: string; count: number; docIds: string[] }[] = []
  for (const [phone, ids] of phoneGroups) {
    if (ids.length > 1) phoneDupes.push({ phone, count: ids.length, docIds: ids })
  }
  phoneDupes.sort((a, b) => b.count - a.count)

  console.log(`  Name+DOB duplicate clusters: ${nameDupes.length}`)
  console.log(`  Total records in duplicate clusters: ${nameDupes.reduce((s, d) => s + d.count, 0)}`)
  if (nameDupes.length > 0) {
    console.log('  Top 10 clusters:')
    for (const d of nameDupes.slice(0, 10)) {
      console.log(`    ${d.key} — ${d.count} records`)
    }
  }

  console.log(`\n  Email shared across multiple clients: ${emailDupes.length}`)
  if (emailDupes.length > 0) {
    console.log('  Top 5:')
    for (const d of emailDupes.slice(0, 5)) {
      console.log(`    ${d.email} — ${d.count} clients`)
    }
  }

  console.log(`\n  Phone shared across multiple clients: ${phoneDupes.length}`)
  if (phoneDupes.length > 0) {
    console.log('  Top 5:')
    for (const d of phoneDupes.slice(0, 5)) {
      console.log(`    ${d.phone} — ${d.count} clients`)
    }
  }

  return { nameDupes, emailDupes, phoneDupes }
}

// ── 3. Carrier Normalization Audit ──────────────────────────────────────────

async function carrierAudit(clientDocs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  console.log('\n=== CARRIER NORMALIZATION AUDIT ===\n')

  // Load carriers
  const carrierSnap = await db.collection('carriers').get()
  const carrierNames = new Map<string, string>() // normalized → original
  for (const doc of carrierSnap.docs) {
    const data = doc.data()
    if (data.display_name) carrierNames.set(normalize(data.display_name as string), data.display_name as string)
    if (data.parent_brand) carrierNames.set(normalize(data.parent_brand as string), data.parent_brand as string)
    if (data.carrier_id) carrierNames.set(normalize(data.carrier_id as string), data.carrier_id as string)
  }
  console.log(`  Known carriers: ${carrierSnap.size} docs, ${carrierNames.size} unique names`)

  // Scan ALL accounts
  let totalAccounts = 0
  let exactMatches = 0
  let fuzzyMatches = 0
  const mismatches = new Map<string, number>()
  const fuzzyMap = new Map<string, string>() // account carrier → closest known carrier

  // Batch through clients in groups of 100
  const batchSize = 100
  for (let i = 0; i < clientDocs.length; i += batchSize) {
    const batch = clientDocs.slice(i, i + batchSize)
    for (const clientDoc of batch) {
      const accountSnap = await db.collection('clients').doc(clientDoc.id).collection('accounts').get()
      for (const accDoc of accountSnap.docs) {
        totalAccounts++
        const carrierName = accDoc.data().carrier_name as string | undefined
        if (!carrierName) continue

        const norm = normalize(carrierName)
        if (carrierNames.has(norm)) {
          exactMatches++
        } else {
          // Fuzzy match
          let bestDist = Infinity
          let bestMatch = ''
          for (const known of carrierNames.keys()) {
            const d = levenshtein(norm, known)
            if (d < bestDist) { bestDist = d; bestMatch = carrierNames.get(known) || known }
          }
          if (bestDist <= 3) {
            fuzzyMatches++
            fuzzyMap.set(carrierName, bestMatch)
          } else {
            mismatches.set(carrierName, (mismatches.get(carrierName) || 0) + 1)
          }
        }
      }
    }
    if (i % 500 === 0 && i > 0) console.log(`  ... scanned ${i}/${clientDocs.length} clients`)
  }

  const sortedMismatches = [...mismatches.entries()].sort((a, b) => b[1] - a[1])

  console.log(`  Total accounts scanned: ${totalAccounts}`)
  console.log(`  Exact carrier matches: ${exactMatches}`)
  console.log(`  Fuzzy matches (levenshtein <= 3): ${fuzzyMatches}`)
  console.log(`  Complete mismatches: ${sortedMismatches.length} unique names, ${sortedMismatches.reduce((s, [, c]) => s + c, 0)} accounts`)

  if (sortedMismatches.length > 0) {
    console.log('  Top 15 mismatches:')
    for (const [name, count] of sortedMismatches.slice(0, 15)) {
      console.log(`    ${name} — ${count} accounts`)
    }
  }

  if (fuzzyMap.size > 0) {
    console.log(`\n  Fuzzy match suggestions (${fuzzyMap.size}):`)
    for (const [from, to] of [...fuzzyMap.entries()].slice(0, 10)) {
      console.log(`    "${from}" → "${to}"`)
    }
  }

  return { totalAccounts, exactMatches, fuzzyMatches, mismatches: sortedMismatches, fuzzyMap: [...fuzzyMap.entries()] }
}

// ── 4. Collection Size Report ───────────────────────────────────────────────

async function collectionSizes() {
  console.log('\n=== COLLECTION SIZE REPORT ===\n')
  const results: { name: string; count: number }[] = []

  for (const name of PROTECTED_COLLECTIONS) {
    try {
      const snap = await db.collection(name).count().get()
      const count = snap.data().count
      results.push({ name, count })
      console.log(`  ${name.padEnd(25)} ${String(count).padStart(6)} docs`)
    } catch {
      results.push({ name, count: -1 })
      console.log(`  ${name.padEnd(25)}  ERROR`)
    }
  }

  return results
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GUARDIAN STRUCTURAL HEALTH REPORT ===')
  console.log(`Timestamp: ${new Date().toISOString()}`)

  const { total, coverage, distribution, docs } = await fullClientScan()
  const dupes = await duplicateDetection(docs)
  const carriers = await carrierAudit(docs)
  const collections = await collectionSizes()

  // Build report
  const report = {
    report_id: `structural_${Date.now()}`,
    timestamp: new Date().toISOString(),
    clients: { total, coverage, distribution },
    duplicates: {
      name_dob_clusters: dupes.nameDupes.length,
      name_dob_total_records: dupes.nameDupes.reduce((s, d) => s + d.count, 0),
      top_name_clusters: dupes.nameDupes.slice(0, 20).map(d => ({ key: d.key, count: d.count, docIds: d.docIds.slice(0, 5) })),
      shared_emails: dupes.emailDupes.length,
      top_shared_emails: dupes.emailDupes.slice(0, 10).map(d => ({ email: d.email, count: d.count })),
      shared_phones: dupes.phoneDupes.length,
      top_shared_phones: dupes.phoneDupes.slice(0, 10).map(d => ({ phone: d.phone, count: d.count })),
    },
    carriers: {
      total_carrier_docs: 270,
      total_accounts: carriers.totalAccounts,
      exact_matches: carriers.exactMatches,
      fuzzy_matches: carriers.fuzzyMatches,
      mismatches: carriers.mismatches.slice(0, 30).map(([name, count]) => ({ name, count })),
      fuzzy_suggestions: carriers.fuzzyMap.slice(0, 20).map(([from, to]) => ({ from, to })),
    },
    collections,
  }

  // Write to JSON first (always succeeds)
  // Write to JSON
  const jsonPath = path.resolve(__dirname, '../../../../.claude/guardian-ui-ux/structural-report.json')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  console.log(`Report saved to: ${jsonPath}`)

  // Write to Firestore (non-blocking)
  try {
    await db.collection('guardian_structural_reports').doc(report.report_id).set(report)
    console.log(`Report saved to Firestore: guardian_structural_reports/${report.report_id}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`Firestore save skipped (JSON saved successfully): ${msg.slice(0, 100)}`)
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('STRUCTURAL HEALTH SUMMARY')
  console.log('='.repeat(70))
  console.log(`  Clients:              ${total}`)
  console.log(`  Fields below 50%:     ${coverage.filter(c => c.pct < 50).map(c => c.field).join(', ') || 'none'}`)
  console.log(`  100% complete:        ${distribution[0].count} (${distribution[0].pct}%)`)
  console.log(`  Below 25% complete:   ${distribution[4].count} (${distribution[4].pct}%)`)
  console.log(`  Name+DOB dupes:       ${dupes.nameDupes.length} clusters, ${dupes.nameDupes.reduce((s, d) => s + d.count, 0)} records`)
  console.log(`  Shared emails:        ${dupes.emailDupes.length}`)
  console.log(`  Shared phones:        ${dupes.phoneDupes.length}`)
  console.log(`  Accounts scanned:     ${carriers.totalAccounts}`)
  console.log(`  Carrier mismatches:   ${carriers.mismatches.length} unique, ${carriers.mismatches.reduce((s, [, c]) => s + c, 0)} accounts`)
  console.log(`  Collections:          ${collections.filter(c => c.count > 0).length} non-empty of ${collections.length}`)
  console.log('='.repeat(70))
  console.log('Done.')
}

main().catch((err) => {
  console.error('Structural health failed:', err)
  process.exit(1)
})
