/**
 * ACF Account Dedup (TRK-13603)
 *
 * Detects duplicate accounts across all client subcollections:
 *   - Groups by normalized policy_number::carrier
 *   - Same-client dupes: auto-merge eligible (keep richer, backfill blanks)
 *   - Cross-client dupes: flagged for review (may indicate missed client merge)
 *   - All actions logged to atlas_audit
 *
 * Usage:
 *   npx tsx services/api/src/scripts/acf-account-dedup.ts           # Dry run
 *   npx tsx services/api/src/scripts/acf-account-dedup.ts --commit  # Execute
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ── Firebase Init ──

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const commitMode = process.argv.includes('--commit')
const BATCH_SIZE = 400

// ── Types ──

interface AccountRecord {
  docId: string
  clientId: string
  clientPath: string
  policy_number?: string
  account_number?: string
  contract_number?: string
  carrier?: string
  custodian?: string
  status?: string
  [key: string]: unknown
}

interface DuplicateCluster {
  key: string
  policyNumber: string
  carrierName: string
  accounts: AccountRecord[]
  type: 'same_client' | 'cross_client'
}

interface MergeAction {
  clusterId: string
  primaryDocId: string
  primaryClientId: string
  secondaryDocId: string
  secondaryClientId: string
  fieldsBackfilled: string[]
}

interface AccountDedupResult {
  success: boolean
  data?: {
    totalClients: number
    totalAccounts: number
    duplicateClusters: number
    sameClientClusters: number
    crossClientClusters: number
    mergesExecuted: number
    clusters: DuplicateCluster[]
    merges: MergeAction[]
  }
  error?: string
}

// ── Helpers ──

/** Build a normalized dedup key from policy number + carrier */
function buildDedupKey(account: AccountRecord): string | null {
  const policyNum = (
    account.policy_number ||
    account.account_number ||
    account.contract_number ||
    ''
  ).trim().toLowerCase()

  const carrier = (
    account.carrier ||
    account.custodian ||
    ''
  ).trim().toLowerCase()

  if (!policyNum || !carrier) return null
  return `${policyNum}::${carrier}`
}

/** Count non-null, non-empty fields */
function populatedFieldCount(record: AccountRecord): number {
  let count = 0
  const SKIP = ['docId', 'clientId', 'clientPath', '_moved_from_client']
  for (const [key, val] of Object.entries(record)) {
    if (SKIP.includes(key)) continue
    if (val != null && String(val).trim() !== '') count++
  }
  return count
}

/** Get fields to backfill from secondary to primary */
function getBackfillFields(
  primary: AccountRecord,
  secondary: AccountRecord
): Record<string, unknown> {
  const backfill: Record<string, unknown> = {}
  const SKIP = ['docId', 'clientId', 'clientPath', 'status', 'created_at', '_moved_from_client']

  for (const [key, val] of Object.entries(secondary)) {
    if (SKIP.includes(key)) continue
    if (val == null || String(val).trim() === '') continue

    const primaryVal = primary[key]
    if (primaryVal == null || String(primaryVal).trim() === '') {
      backfill[key] = val
    }
  }

  return backfill
}

// ── Main ──

async function main(): Promise<AccountDedupResult> {
  console.log(
    commitMode
      ? 'COMMIT MODE: same-client duplicates will be merged in Firestore'
      : 'DRY RUN: no changes will be made (pass --commit to execute)'
  )
  console.log('---')

  // 1. Read all clients
  console.log('Reading all clients from Firestore...')
  const clientsSnap = await db.collection('clients').get()
  const clientIds: string[] = []

  for (const doc of clientsSnap.docs) {
    const data = doc.data()
    if (data.status === 'deleted' || data._merged_into) continue
    clientIds.push(doc.id)
  }
  console.log(`Found ${clientIds.length} active clients`)

  // 2. Read all accounts across all clients
  console.log('Reading accounts for all clients...')
  const allAccounts: AccountRecord[] = []
  let clientsProcessed = 0

  for (const clientId of clientIds) {
    clientsProcessed++
    if (clientsProcessed % 100 === 0) {
      console.log(`  Processed ${clientsProcessed}/${clientIds.length} clients...`)
    }

    const accountsSnap = await db
      .collection('clients')
      .doc(clientId)
      .collection('accounts')
      .get()

    for (const doc of accountsSnap.docs) {
      const data = doc.data()
      if (data.status === 'deleted') continue

      allAccounts.push({
        docId: doc.id,
        clientId,
        clientPath: `clients/${clientId}/accounts/${doc.id}`,
        ...data,
      } as AccountRecord)
    }
  }
  console.log(`Loaded ${allAccounts.length} active accounts\n`)

  // 3. Build dedup map: key → accounts[]
  const dedupMap = new Map<string, AccountRecord[]>()

  for (const account of allAccounts) {
    const key = buildDedupKey(account)
    if (!key) continue

    const existing = dedupMap.get(key) || []
    existing.push(account)
    dedupMap.set(key, existing)
  }

  // 4. Find clusters with 2+ accounts
  const clusters: DuplicateCluster[] = []

  for (const [key, accounts] of dedupMap) {
    if (accounts.length < 2) continue

    const [policyNumber, carrierName] = key.split('::')
    const uniqueClients = new Set(accounts.map((a) => a.clientId))
    const type: DuplicateCluster['type'] =
      uniqueClients.size === 1 ? 'same_client' : 'cross_client'

    clusters.push({ key, policyNumber, carrierName, accounts, type })
  }

  const sameClientClusters = clusters.filter((c) => c.type === 'same_client')
  const crossClientClusters = clusters.filter((c) => c.type === 'cross_client')

  console.log(`Duplicate clusters found: ${clusters.length}`)
  console.log(`  Same-client (auto-merge eligible): ${sameClientClusters.length}`)
  console.log(`  Cross-client (review required):    ${crossClientClusters.length}`)

  // 5. Report all clusters
  if (sameClientClusters.length > 0) {
    console.log('\n--- Same-Client Duplicates ---')
    for (const cluster of sameClientClusters) {
      console.log(`  ${cluster.policyNumber} / ${cluster.carrierName} (${cluster.accounts.length} copies, client: ${cluster.accounts[0].clientId})`)
      for (const a of cluster.accounts) {
        console.log(`    - ${a.docId} (${populatedFieldCount(a)} populated fields)`)
      }
    }
  }

  if (crossClientClusters.length > 0) {
    console.log('\n--- Cross-Client Duplicates (REVIEW REQUIRED) ---')
    for (const cluster of crossClientClusters) {
      console.log(`  WARNING: ${cluster.policyNumber} / ${cluster.carrierName} appears in ${cluster.accounts.length} clients:`)
      for (const a of cluster.accounts) {
        console.log(`    - Client ${a.clientId}, doc ${a.docId}`)
      }
      console.log('    → May indicate a missed client merge')
    }
  }

  // 6. Execute same-client merges in commit mode
  const merges: MergeAction[] = []
  let mergesExecuted = 0

  for (const cluster of sameClientClusters) {
    // Sort by populated field count descending — keep the richest
    const sorted = [...cluster.accounts].sort(
      (a, b) => populatedFieldCount(b) - populatedFieldCount(a)
    )
    const primary = sorted[0]
    const secondaries = sorted.slice(1)

    for (const secondary of secondaries) {
      const backfill = getBackfillFields(primary, secondary)
      const merge: MergeAction = {
        clusterId: cluster.key,
        primaryDocId: primary.docId,
        primaryClientId: primary.clientId,
        secondaryDocId: secondary.docId,
        secondaryClientId: secondary.clientId,
        fieldsBackfilled: Object.keys(backfill),
      }
      merges.push(merge)

      if (commitMode) {
        try {
          let batch = db.batch()
          let opsInBatch = 0

          const primaryRef = db
            .collection('clients')
            .doc(primary.clientId)
            .collection('accounts')
            .doc(primary.docId)

          // Backfill fields
          if (Object.keys(backfill).length > 0) {
            batch.update(primaryRef, {
              ...backfill,
              updated_at: new Date().toISOString(),
            })
            opsInBatch++
          }

          // Delete secondary
          const secondaryRef = db
            .collection('clients')
            .doc(secondary.clientId)
            .collection('accounts')
            .doc(secondary.docId)

          batch.delete(secondaryRef)
          opsInBatch++

          // Audit log
          const auditRef = db.collection('atlas_audit').doc()
          batch.set(auditRef, {
            action: 'account_merge',
            cluster_key: cluster.key,
            primary_doc_id: primary.docId,
            secondary_doc_id: secondary.docId,
            client_id: primary.clientId,
            fields_backfilled: Object.keys(backfill),
            timestamp: new Date().toISOString(),
          })
          opsInBatch++

          if (opsInBatch >= BATCH_SIZE) {
            await batch.commit()
            batch = db.batch()
            opsInBatch = 0
          }

          await batch.commit()
          mergesExecuted++
          console.log(`  Merged account ${secondary.docId} → ${primary.docId} (${cluster.policyNumber})`)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`  FAILED merge ${secondary.docId}: ${message}`)
        }
      }
    }
  }

  // 7. Summary
  console.log('\n--- Summary ---')
  console.log(`  Total clients:           ${clientIds.length}`)
  console.log(`  Total accounts:          ${allAccounts.length}`)
  console.log(`  Duplicate clusters:      ${clusters.length}`)
  console.log(`  Same-client clusters:    ${sameClientClusters.length}`)
  console.log(`  Cross-client clusters:   ${crossClientClusters.length}`)
  console.log(`  Merge actions planned:   ${merges.length}`)
  console.log(`  Merges executed:         ${commitMode ? mergesExecuted : 0}`)
  console.log(`  Mode: ${commitMode ? 'COMMIT' : 'DRY RUN'}`)

  if (!commitMode && (merges.length > 0 || crossClientClusters.length > 0)) {
    console.log('\nDry run report (JSON):')
    console.log(JSON.stringify({ sameClientMerges: merges, crossClientWarnings: crossClientClusters.length }, null, 2))
    console.log('\nRun with --commit to execute same-client merges.')
  }

  return {
    success: true,
    data: {
      totalClients: clientIds.length,
      totalAccounts: allAccounts.length,
      duplicateClusters: clusters.length,
      sameClientClusters: sameClientClusters.length,
      crossClientClusters: crossClientClusters.length,
      mergesExecuted: commitMode ? mergesExecuted : 0,
      clusters,
      merges,
    },
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
