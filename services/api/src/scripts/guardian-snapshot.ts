// ============================================================================
// GUARDIAN Snapshot Tool — TRK-243
// Captures current Firestore state for drift detection and health monitoring.
// Run: npx tsx services/api/src/scripts/guardian-snapshot.ts
// ============================================================================

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createHash } from 'crypto'
import type { DataSnapshot, CollectionSnapshot } from '@tomachina/core/types/guardian'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ── Collections to snapshot ────────────────────────────────────────────────

interface CollectionConfig {
  name: string
  trackedFields: string[]
}

const COLLECTIONS: CollectionConfig[] = [
  { name: 'clients', trackedFields: ['first_name', 'last_name', 'email', 'phone', 'dob', 'client_status', 'household_id'] },
  { name: 'carriers', trackedFields: ['carrier_id', 'display_name', 'parent_brand', 'naic'] },
  { name: 'households', trackedFields: ['primary_contact_id', 'status', 'members'] },
  { name: 'users', trackedFields: ['user_id', 'email', 'first_name', 'last_name'] },
  { name: 'flow_pipelines', trackedFields: [] },
  { name: 'flow_stages', trackedFields: [] },
  { name: 'tracker_items', trackedFields: [] },
  { name: 'sprints', trackedFields: [] },
  { name: 'source_registry', trackedFields: [] },
  { name: 'tool_registry', trackedFields: [] },
]

const ACCOUNT_TRACKED_FIELDS = ['carrier', 'charter', 'naic', 'policy_number', 'status']

// ── Helpers ────────────────────────────────────────────────────────────────

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

function computeSampleHash(docIds: string[]): string {
  const sorted = [...docIds].sort().slice(0, 10)
  return createHash('md5').update(sorted.join(',')).digest('hex')
}

function computeFieldCoverage(
  docs: FirebaseFirestore.DocumentData[],
  fields: string[]
): Record<string, number> {
  if (fields.length === 0 || docs.length === 0) return {}
  const coverage: Record<string, number> = {}
  for (const field of fields) {
    const populated = docs.filter((d) => isNonEmpty(d[field])).length
    coverage[field] = Math.round((populated / docs.length) * 10000) / 100
  }
  return coverage
}

// ── Snapshot a top-level collection ────────────────────────────────────────

async function snapshotCollection(config: CollectionConfig): Promise<CollectionSnapshot> {
  console.log(`  Scanning ${config.name}...`)
  const snap = await db.collection(config.name).get()
  const docs = snap.docs.map((d) => d.data())
  const docIds = snap.docs.map((d) => d.id)

  return {
    count: snap.size,
    sample_hash: computeSampleHash(docIds),
    field_coverage: computeFieldCoverage(docs, config.trackedFields),
  }
}

// ── Snapshot accounts subcollection (sample 100 random clients) ────────────

async function snapshotAccounts(): Promise<CollectionSnapshot> {
  console.log('  Scanning accounts (subcollection sample)...')

  // Get up to 100 client IDs for sampling
  const clientSnap = await db.collection('clients').limit(500).get()
  const allClientIds = clientSnap.docs.map((d) => d.id)

  // Shuffle and take 100
  const shuffled = allClientIds.sort(() => Math.random() - 0.5)
  const sampleIds = shuffled.slice(0, 100)

  let totalCount = 0
  const allAccountDocs: FirebaseFirestore.DocumentData[] = []
  const allAccountIds: string[] = []

  for (const clientId of sampleIds) {
    const accountSnap = await db
      .collection('clients')
      .doc(clientId)
      .collection('accounts')
      .get()

    totalCount += accountSnap.size
    for (const doc of accountSnap.docs) {
      allAccountDocs.push(doc.data())
      allAccountIds.push(doc.id)
    }
  }

  return {
    count: totalCount,
    sample_hash: computeSampleHash(allAccountIds),
    field_coverage: computeFieldCoverage(allAccountDocs, ACCOUNT_TRACKED_FIELDS),
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GUARDIAN SNAPSHOT ===')
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  const collections: Record<string, CollectionSnapshot> = {}

  // Snapshot top-level collections
  for (const config of COLLECTIONS) {
    collections[config.name] = await snapshotCollection(config)
  }

  // Snapshot accounts subcollection
  collections['accounts'] = await snapshotAccounts()

  // Build the snapshot document
  const snapshotId = `snap_${Date.now()}`
  const now = new Date().toISOString()

  const snapshot: DataSnapshot = {
    snapshot_id: snapshotId,
    timestamp: now,
    triggered_by: 'manual',
    collections,
    stored_at: now,
    _created_by: 'guardian-snapshot-script',
  }

  // Write to Firestore
  await db.collection('data_snapshots').doc(snapshotId).set(snapshot)
  console.log(`\nSnapshot written to data_snapshots/${snapshotId}`)

  // Print human-readable summary
  console.log('\n' + '='.repeat(70))
  console.log('SNAPSHOT SUMMARY')
  console.log('='.repeat(70))

  for (const [name, col] of Object.entries(collections)) {
    console.log(`\n  ${name}`)
    console.log(`    Count: ${col.count}`)
    console.log(`    Hash:  ${col.sample_hash}`)

    if (Object.keys(col.field_coverage).length > 0) {
      console.log('    Field Coverage:')
      for (const [field, pct] of Object.entries(col.field_coverage) as [string, number][]) {
        const bar = pct >= 90 ? 'OK' : pct >= 50 ? 'WARN' : 'LOW'
        console.log(`      ${field.padEnd(25)} ${pct.toFixed(1).padStart(6)}%  [${bar}]`)
      }
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('Done.')
}

main().catch((err) => {
  console.error('Snapshot failed:', err)
  process.exit(1)
})
