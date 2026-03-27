#!/usr/bin/env npx tsx
/**
 * ACF Final Verification & Health Report — TRK-13607
 *
 * Reconciliation checks + field coverage report after ACF Data Hygiene sprint.
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/acf-verify-final.ts              # Full report (read-only)
 *   npx tsx services/api/src/scripts/acf-verify-final.ts --baseline   # Capture baseline only
 *   npx tsx services/api/src/scripts/acf-verify-final.ts --commit     # Full report + ATLAS cleanup
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { findDuplicates } from '@tomachina/core/matching/index'

// ── Firebase Init ────────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ── CLI Flags ────────────────────────────────────────────────────────────────

const COMMIT = process.argv.includes('--commit')
const BASELINE_ONLY = process.argv.includes('--baseline')

const ENRICHMENT_DIR = join(homedir(), 'Projects/toMachina/.claude/acf-data-hygiene-enrichment')
const BASELINE_PATH = join(ENRICHMENT_DIR, 'baseline.json')
const REPORT_PATH = join(ENRICHMENT_DIR, 'final-report.json')

// ── Types ────────────────────────────────────────────────────────────────────

interface FieldCoverage {
  field: string
  populated: number
  total: number
  percentage: number
}

interface Baseline {
  captured_at: string
  total_clients: number
  field_coverage: FieldCoverage[]
}

interface FinalReport {
  generated_at: string
  verdict: 'PASS' | 'FAIL'
  total_clients: number
  duplicate_client_pairs: number
  duplicate_account_sets: number
  orphan_accounts: number
  field_coverage: FieldCoverage[]
  baseline_comparison: Array<{
    field: string
    before: number
    after: number
    delta: number
  }> | null
  phantom_tools_removed: number
  failures: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNonEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return false
  if (typeof val === 'string' && val.trim() === '') return false
  return true
}

const COVERAGE_FIELDS = [
  'dob', 'phone', 'email', 'address', 'city', 'state', 'zip',
  'medicare_number', 'ssn_last4', 'spouse_name',
]

// ============================================================================
// BASELINE CAPTURE
// ============================================================================

async function captureBaseline(): Promise<Baseline> {
  console.log('\n  Capturing field coverage baseline...\n')

  const allClients = await db.collection('clients').get()
  const total = allClients.size

  const coverage: FieldCoverage[] = []
  for (const field of COVERAGE_FIELDS) {
    let populated = 0
    for (const doc of allClients.docs) {
      if (isNonEmpty(doc.data()[field])) populated++
    }
    const pct = total > 0 ? Math.round((populated / total) * 10000) / 100 : 0
    coverage.push({ field, populated, total, percentage: pct })
  }

  const baseline: Baseline = {
    captured_at: new Date().toISOString(),
    total_clients: total,
    field_coverage: coverage,
  }

  mkdirSync(ENRICHMENT_DIR, { recursive: true })
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2))
  console.log(`  Baseline saved to: ${BASELINE_PATH}`)
  console.log(`  Total clients: ${total}\n`)

  for (const fc of coverage) {
    const bar = '█'.repeat(Math.round(fc.percentage / 2)) + '░'.repeat(50 - Math.round(fc.percentage / 2))
    console.log(`  ${fc.field.padEnd(18)} ${bar} ${fc.percentage.toFixed(1)}% (${fc.populated}/${fc.total})`)
  }

  return baseline
}

// ============================================================================
// DUPLICATE CLIENT SCAN
// ============================================================================

async function scanDuplicateClients(): Promise<number> {
  console.log('\n' + '-'.repeat(50))
  console.log('  1. Duplicate Client Scan')
  console.log('-'.repeat(50) + '\n')

  const snap = await db.collection('clients').get()
  const records: Array<Record<string, unknown> & { _docId: string }> = []

  for (const doc of snap.docs) {
    const d = doc.data()
    records.push({
      _docId: doc.id,
      first_name: d.first_name || '',
      last_name: d.last_name || '',
      dob: d.dob || '',
      phone: d.phone || '',
      email: d.email || '',
      ssn_last4: d.ssn_last4 || '',
    })
  }

  console.log(`  Scanning ${records.length} clients for duplicates (threshold: 85)...`)

  const dupes = findDuplicates(records, ['first_name', 'last_name', 'dob', 'phone', 'email'], 85)
  console.log(`  Found ${dupes.length} duplicate pairs\n`)

  if (dupes.length > 0) {
    const sample = dupes.slice(0, 10)
    console.log('  Sample duplicate pairs (first 10):')
    for (const d of sample) {
      const r1 = d.record1 as Record<string, unknown>
      const r2 = d.record2 as Record<string, unknown>
      console.log(`    Score ${d.score}: "${r1.first_name} ${r1.last_name}" (${r1._docId}) <-> "${r2.first_name} ${r2.last_name}" (${r2._docId})`)
    }
    if (dupes.length > 10) {
      console.log(`    ... and ${dupes.length - 10} more`)
    }
  }

  return dupes.length
}

// ============================================================================
// DUPLICATE ACCOUNT SCAN
// ============================================================================

async function scanDuplicateAccounts(): Promise<number> {
  console.log('\n' + '-'.repeat(50))
  console.log('  2. Duplicate Account Scan')
  console.log('-'.repeat(50) + '\n')

  // Use collectionGroup to get all accounts across all clients
  const snap = await db.collectionGroup('accounts').get()
  console.log(`  Loaded ${snap.size} total accounts across all clients`)

  // Group by normalized policy_number + carrier_name
  const groups = new Map<string, Array<{ docPath: string; policy_number: string; carrier_name: string; client_id: string }>>()

  for (const doc of snap.docs) {
    const d = doc.data()
    const policyNum = String(d.policy_number || '').trim().toUpperCase()
    const carrier = String(d.carrier_name || '').trim().toLowerCase()

    if (!policyNum || policyNum === 'UNDEFINED' || policyNum === 'NULL') continue

    const key = `${policyNum}|||${carrier}`
    if (!groups.has(key)) groups.set(key, [])

    // Extract client_id from path: clients/{clientId}/accounts/{accountId}
    const pathParts = doc.ref.path.split('/')
    const clientId = pathParts.length >= 2 ? pathParts[1] : 'unknown'

    groups.get(key)!.push({
      docPath: doc.ref.path,
      policy_number: policyNum,
      carrier_name: d.carrier_name || '',
      client_id: clientId,
    })
  }

  // Find groups with more than 1 entry
  let dupeSets = 0
  const dupeDetails: Array<{ key: string; count: number; paths: string[] }> = []

  for (const [key, entries] of groups) {
    if (entries.length > 1) {
      dupeSets++
      dupeDetails.push({
        key,
        count: entries.length,
        paths: entries.map(e => e.docPath),
      })
    }
  }

  console.log(`  Found ${dupeSets} duplicate account sets\n`)

  if (dupeDetails.length > 0) {
    const sample = dupeDetails.slice(0, 10)
    console.log('  Sample duplicate account sets (first 10):')
    for (const d of sample) {
      const [policy, carrier] = d.key.split('|||')
      console.log(`    ${policy} / ${carrier} (${d.count} copies):`)
      for (const p of d.paths.slice(0, 3)) {
        console.log(`      - ${p}`)
      }
      if (d.paths.length > 3) console.log(`      ... and ${d.paths.length - 3} more`)
    }
  }

  return dupeSets
}

// ============================================================================
// ORPHAN ACCOUNT SCAN
// ============================================================================

async function scanOrphanAccounts(): Promise<number> {
  console.log('\n' + '-'.repeat(50))
  console.log('  3. Orphan Account Scan')
  console.log('-'.repeat(50) + '\n')

  // Build set of all client IDs
  const clientSnap = await db.collection('clients').get()
  const clientIds = new Set<string>()
  for (const doc of clientSnap.docs) {
    clientIds.add(doc.id)
  }
  console.log(`  ${clientIds.size} clients in Firestore`)

  // Check all accounts via collectionGroup
  const accountSnap = await db.collectionGroup('accounts').get()
  console.log(`  ${accountSnap.size} total accounts`)

  let orphanCount = 0
  const orphanDetails: Array<{ path: string; parentClientId: string }> = []

  for (const doc of accountSnap.docs) {
    // Extract client_id from path: clients/{clientId}/accounts/{accountId}
    const pathParts = doc.ref.path.split('/')
    if (pathParts.length < 2) continue
    const parentClientId = pathParts[1]

    if (!clientIds.has(parentClientId)) {
      orphanCount++
      orphanDetails.push({ path: doc.ref.path, parentClientId })
    }
  }

  console.log(`  Found ${orphanCount} orphan accounts (parent client missing)\n`)

  if (orphanDetails.length > 0) {
    const sample = orphanDetails.slice(0, 10)
    console.log('  Sample orphans (first 10):')
    for (const o of sample) {
      console.log(`    ${o.path} (parent: ${o.parentClientId})`)
    }
    if (orphanDetails.length > 10) {
      console.log(`    ... and ${orphanDetails.length - 10} more`)
    }
  }

  return orphanCount
}

// ============================================================================
// FIELD COVERAGE REPORT
// ============================================================================

async function fieldCoverageReport(baseline: Baseline | null): Promise<{
  coverage: FieldCoverage[]
  comparison: FinalReport['baseline_comparison']
}> {
  console.log('\n' + '-'.repeat(50))
  console.log('  4. Field Coverage Report')
  console.log('-'.repeat(50) + '\n')

  const allClients = await db.collection('clients').get()
  const total = allClients.size

  const coverage: FieldCoverage[] = []
  for (const field of COVERAGE_FIELDS) {
    let populated = 0
    for (const doc of allClients.docs) {
      if (isNonEmpty(doc.data()[field])) populated++
    }
    const pct = total > 0 ? Math.round((populated / total) * 10000) / 100 : 0
    coverage.push({ field, populated, total, percentage: pct })
  }

  // Display with optional baseline comparison
  let comparison: FinalReport['baseline_comparison'] = null

  if (baseline) {
    comparison = []
    console.log(`  ${'Field'.padEnd(18)} ${'Before'.padStart(8)} ${'After'.padStart(8)} ${'Delta'.padStart(8)}`)
    console.log('  ' + '-'.repeat(44))

    for (const fc of coverage) {
      const baselineField = baseline.field_coverage.find(b => b.field === fc.field)
      const before = baselineField ? baselineField.percentage : 0
      const delta = fc.percentage - before
      const deltaStr = delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`
      const deltaIcon = delta > 0 ? ' ^^' : delta < 0 ? ' vv' : ''

      console.log(`  ${fc.field.padEnd(18)} ${(before.toFixed(1) + '%').padStart(8)} ${(fc.percentage.toFixed(1) + '%').padStart(8)} ${deltaStr.padStart(8)}${deltaIcon}`)

      comparison.push({
        field: fc.field,
        before,
        after: fc.percentage,
        delta: Math.round(delta * 100) / 100,
      })
    }
  } else {
    console.log(`  ${'Field'.padEnd(18)} ${'Coverage'.padStart(10)} ${'Count'.padStart(10)}`)
    console.log('  ' + '-'.repeat(40))

    for (const fc of coverage) {
      const bar = '█'.repeat(Math.round(fc.percentage / 2)) + '░'.repeat(50 - Math.round(fc.percentage / 2))
      console.log(`  ${fc.field.padEnd(18)} ${(fc.percentage.toFixed(1) + '%').padStart(10)} ${(fc.populated + '/' + fc.total).padStart(10)}`)
    }

    console.log('\n  (No baseline found -- run with --baseline first to enable before/after comparison)')
  }

  console.log()
  return { coverage, comparison }
}

// ============================================================================
// ATLAS REGISTRY CLEANUP
// ============================================================================

async function cleanupPhantomTools(): Promise<number> {
  console.log('\n' + '-'.repeat(50))
  console.log(`  5. ATLAS Registry Cleanup ${COMMIT ? '(LIVE)' : '(DRY RUN)'}`)
  console.log('-'.repeat(50) + '\n')

  const PHANTOM_TOOLS = ['getDuplicateClusters', 'scoreDuplicateMatch', 'previewMerge']
  let removedCount = 0

  for (const toolName of PHANTOM_TOOLS) {
    const snap = await db.collection('tool_registry')
      .where('tool_name', '==', toolName)
      .get()

    if (snap.empty) {
      console.log(`  ${toolName}: not found (already clean)`)
    } else {
      console.log(`  ${toolName}: found ${snap.size} entries`)
      if (COMMIT) {
        for (const doc of snap.docs) {
          await doc.ref.delete()
          removedCount++
        }
        console.log(`    -> deleted`)
      } else {
        console.log(`    -> would delete (dry run)`)
        removedCount += snap.size
      }
    }
  }

  console.log(`\n  Phantom tools ${COMMIT ? 'removed' : 'to remove'}: ${removedCount}\n`)
  return removedCount
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  mkdirSync(ENRICHMENT_DIR, { recursive: true })

  // Baseline-only mode
  if (BASELINE_ONLY) {
    console.log('\n' + '#'.repeat(70))
    console.log('  ACF Data Hygiene -- Baseline Capture')
    console.log('#'.repeat(70))

    await captureBaseline()

    console.log('\n  Baseline captured. Run without --baseline for full verification.\n')
    return
  }

  // Full verification
  console.log('\n' + '#'.repeat(70))
  console.log('  ACF Final Verification & Health Report')
  console.log(`  Mode: ${COMMIT ? 'LIVE (will clean up ATLAS)' : 'READ-ONLY'}`)
  console.log('#'.repeat(70))

  // Load baseline if exists
  let baseline: Baseline | null = null
  if (existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    console.log(`\n  Baseline loaded (captured: ${baseline!.captured_at})`)
  } else {
    console.log('\n  No baseline found -- capturing NOW and saving for future comparison')
    baseline = await captureBaseline()
  }

  // Run all scans
  const dupePairs = await scanDuplicateClients()
  const dupeAccountSets = await scanDuplicateAccounts()
  const orphanCount = await scanOrphanAccounts()
  const { coverage, comparison } = await fieldCoverageReport(baseline)
  const phantomToolsRemoved = await cleanupPhantomTools()

  // Build verdict
  const failures: string[] = []
  if (dupePairs > 0) failures.push(`${dupePairs} duplicate client pairs remain`)
  if (dupeAccountSets > 0) failures.push(`${dupeAccountSets} duplicate account sets remain`)
  if (orphanCount > 0) failures.push(`${orphanCount} orphan accounts remain`)

  const verdict: 'PASS' | 'FAIL' = failures.length === 0 ? 'PASS' : 'FAIL'

  // Final summary
  console.log('\n' + '='.repeat(70))
  console.log(`  VERDICT: ${verdict}`)
  console.log('='.repeat(70))
  console.log()
  console.log(`  Client duplicate pairs:    ${dupePairs} ${dupePairs === 0 ? '  OK' : '  FAIL'}`)
  console.log(`  Account duplicate sets:    ${dupeAccountSets} ${dupeAccountSets === 0 ? '  OK' : '  FAIL'}`)
  console.log(`  Orphan accounts:           ${orphanCount} ${orphanCount === 0 ? '  OK' : '  FAIL'}`)
  console.log(`  Phantom ATLAS tools:       ${phantomToolsRemoved} ${COMMIT ? 'removed' : 'found'}`)

  if (failures.length > 0) {
    console.log('\n  Failures:')
    for (const f of failures) {
      console.log(`    - ${f}`)
    }
  }

  console.log()

  // Save report
  const report: FinalReport = {
    generated_at: new Date().toISOString(),
    verdict,
    total_clients: coverage.length > 0 ? coverage[0].total : 0,
    duplicate_client_pairs: dupePairs,
    duplicate_account_sets: dupeAccountSets,
    orphan_accounts: orphanCount,
    field_coverage: coverage,
    baseline_comparison: comparison,
    phantom_tools_removed: phantomToolsRemoved,
    failures,
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`  Full report saved to: ${REPORT_PATH}\n`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
