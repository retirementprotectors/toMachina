/**
 * ACF Client Dedup (TRK-13602)
 *
 * Detects duplicate client records in Firestore and merges them:
 *   - Identifies duplicates via findDuplicates() from @tomachina/core
 *   - Determines primary (more populated fields) vs secondary
 *   - Backfills blank fields on primary from secondary (NEVER overwrites existing)
 *   - Moves accounts from secondary to primary
 *   - Soft-deletes secondary with merge trail
 *   - Logs all actions to atlas_audit
 *
 * Usage:
 *   npx tsx services/api/src/scripts/acf-client-dedup.ts           # Dry run
 *   npx tsx services/api/src/scripts/acf-client-dedup.ts --commit  # Execute
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { findDuplicates } from '@tomachina/core/matching/index'

// ── Firebase Init ──

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const commitMode = process.argv.includes('--commit')
const BATCH_SIZE = 400 // Firestore limit is 500, leave headroom

// ── Types ──

interface ClientRecord {
  id: string
  first_name?: string
  last_name?: string
  dob?: string
  email?: string
  phone?: string
  ssn_last4?: string
  status?: string
  [key: string]: unknown
}

interface MergeAction {
  primaryId: string
  primaryName: string
  secondaryId: string
  secondaryName: string
  score: number
  fieldsBackfilled: string[]
  accountsMoved: number
}

interface DedupResult {
  success: boolean
  data?: {
    totalClients: number
    duplicatePairsFound: number
    mergesExecuted: number
    fieldsBackfilled: number
    accountsMoved: number
    merges: MergeAction[]
  }
  error?: string
}

// ── Helpers ──

/** Count non-null, non-empty fields on a record */
function populatedFieldCount(record: ClientRecord): number {
  const FIELDS = ['first_name', 'last_name', 'dob', 'email', 'phone', 'ssn_last4']
  let count = 0
  for (const f of FIELDS) {
    const val = record[f]
    if (val != null && String(val).trim() !== '') count++
  }
  return count
}

/** Get backfill fields: keys where primary is blank but secondary has a value */
function getBackfillFields(
  primary: ClientRecord,
  secondary: ClientRecord
): Record<string, unknown> {
  const backfill: Record<string, unknown> = {}
  // Check all fields on secondary, skip internal/system fields
  const SKIP = ['id', '_merged_into', '_merged_at', 'status', 'created_at']

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

async function main(): Promise<DedupResult> {
  console.log(
    commitMode
      ? 'COMMIT MODE: duplicates will be merged in Firestore'
      : 'DRY RUN: no changes will be made (pass --commit to execute)'
  )
  console.log('---')

  // 1. Read all clients
  console.log('Reading all clients from Firestore...')
  const clientsSnap = await db.collection('clients').get()
  const clients: ClientRecord[] = []

  for (const doc of clientsSnap.docs) {
    const data = doc.data()
    if (data.status === 'deleted' || data._merged_into) continue
    clients.push({
      id: doc.id,
      ...data,
    } as ClientRecord)
  }
  console.log(`Loaded ${clients.length} active clients (${clientsSnap.size} total incl. deleted/merged)`)

  // 2. Find duplicates
  console.log('Running findDuplicates()...')
  const pairs = findDuplicates(
    clients,
    ['last_name', 'first_name', 'dob', 'email', 'phone'],
    85
  )
  console.log(`Found ${pairs.length} duplicate pair(s)\n`)

  if (pairs.length === 0) {
    console.log('No duplicates found. Collection is clean.')
    return {
      success: true,
      data: {
        totalClients: clients.length,
        duplicatePairsFound: 0,
        mergesExecuted: 0,
        fieldsBackfilled: 0,
        accountsMoved: 0,
        merges: [],
      },
    }
  }

  // 3. Determine primary/secondary for each pair and plan merges
  const merges: MergeAction[] = []
  // Track which IDs have already been claimed as secondary to avoid double-merges
  const mergedIds = new Set<string>()

  for (const pair of pairs) {
    const r1 = pair.record1 as ClientRecord
    const r2 = pair.record2 as ClientRecord

    // Skip if either record was already merged in a previous pair
    if (mergedIds.has(r1.id) || mergedIds.has(r2.id)) continue

    // Primary = more populated fields; tie-break by which was created first (lower id)
    const count1 = populatedFieldCount(r1)
    const count2 = populatedFieldCount(r2)
    const [primary, secondary] = count1 >= count2 ? [r1, r2] : [r2, r1]

    const backfillFields = getBackfillFields(primary, secondary)

    // Count accounts on secondary
    const secondaryAccountsSnap = await db
      .collection('clients')
      .doc(secondary.id)
      .collection('accounts')
      .get()

    const merge: MergeAction = {
      primaryId: primary.id,
      primaryName: `${primary.first_name || ''} ${primary.last_name || ''}`.trim(),
      secondaryId: secondary.id,
      secondaryName: `${secondary.first_name || ''} ${secondary.last_name || ''}`.trim(),
      score: pair.score,
      fieldsBackfilled: Object.keys(backfillFields),
      accountsMoved: secondaryAccountsSnap.size,
    }

    merges.push(merge)
    mergedIds.add(secondary.id)

    console.log(`Pair (score ${pair.score}):`)
    console.log(`  Primary:   ${merge.primaryName} (${merge.primaryId})`)
    console.log(`  Secondary: ${merge.secondaryName} (${merge.secondaryId})`)
    console.log(`  Backfill:  ${merge.fieldsBackfilled.length > 0 ? merge.fieldsBackfilled.join(', ') : '(none)'}`)
    console.log(`  Accounts to move: ${merge.accountsMoved}`)
  }

  // 4. Execute merges in commit mode
  let totalFieldsBackfilled = 0
  let totalAccountsMoved = 0
  let mergesExecuted = 0

  if (commitMode && merges.length > 0) {
    console.log(`\nExecuting ${merges.length} merge(s)...`)

    for (const merge of merges) {
      try {
        let batch = db.batch()
        let opsInBatch = 0

        // 4a. Backfill blank fields on primary
        const primaryRef = db.collection('clients').doc(merge.primaryId)
        const secondaryRef = db.collection('clients').doc(merge.secondaryId)
        const secondaryDoc = await secondaryRef.get()
        const secondaryData = secondaryDoc.data() || {}
        const primaryDoc = await primaryRef.get()
        const primaryData = primaryDoc.data() || {}

        const backfill = getBackfillFields(
          { id: merge.primaryId, ...primaryData } as ClientRecord,
          { id: merge.secondaryId, ...secondaryData } as ClientRecord
        )

        if (Object.keys(backfill).length > 0) {
          batch.update(primaryRef, {
            ...backfill,
            updated_at: new Date().toISOString(),
          })
          opsInBatch++
          totalFieldsBackfilled += Object.keys(backfill).length
        }

        // 4b. Move accounts from secondary to primary
        const accountsSnap = await secondaryRef.collection('accounts').get()

        for (const accountDoc of accountsSnap.docs) {
          const accountData = accountDoc.data()
          const newAccountRef = primaryRef.collection('accounts').doc(accountDoc.id)

          batch.set(newAccountRef, {
            ...accountData,
            client_id: merge.primaryId,
            _moved_from_client: merge.secondaryId,
            updated_at: new Date().toISOString(),
          })
          opsInBatch++

          batch.delete(accountDoc.ref)
          opsInBatch++

          totalAccountsMoved++

          // Flush batch if near limit
          if (opsInBatch >= BATCH_SIZE) {
            await batch.commit()
            batch = db.batch()
            opsInBatch = 0
          }
        }

        // 4c. Soft-delete secondary
        batch.update(secondaryRef, {
          _merged_into: merge.primaryId,
          _merged_at: new Date().toISOString(),
          status: 'merged',
        })
        opsInBatch++

        // 4d. Audit log
        const auditRef = db.collection('atlas_audit').doc()
        batch.set(auditRef, {
          action: 'client_merge',
          primary_id: merge.primaryId,
          secondary_id: merge.secondaryId,
          score: merge.score,
          fields_backfilled: merge.fieldsBackfilled,
          accounts_moved: merge.accountsMoved,
          timestamp: new Date().toISOString(),
        })
        opsInBatch++

        await batch.commit()
        mergesExecuted++
        console.log(`  Merged: ${merge.secondaryName} → ${merge.primaryName}`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`  FAILED merge ${merge.secondaryId} → ${merge.primaryId}: ${message}`)
      }
    }
  }

  // 5. Summary
  console.log('\n--- Summary ---')
  console.log(`  Total clients:        ${clients.length}`)
  console.log(`  Duplicate pairs:      ${pairs.length}`)
  console.log(`  Merge actions:        ${merges.length}`)
  console.log(`  Merges executed:      ${commitMode ? mergesExecuted : 0}`)
  console.log(`  Fields backfilled:    ${commitMode ? totalFieldsBackfilled : 0}`)
  console.log(`  Accounts moved:       ${commitMode ? totalAccountsMoved : 0}`)
  console.log(`  Mode: ${commitMode ? 'COMMIT' : 'DRY RUN'}`)

  if (!commitMode && merges.length > 0) {
    console.log('\nDry run report (JSON):')
    console.log(JSON.stringify(merges, null, 2))
    console.log('\nRun with --commit to execute these merges.')
  }

  return {
    success: true,
    data: {
      totalClients: clients.length,
      duplicatePairsFound: pairs.length,
      mergesExecuted: commitMode ? mergesExecuted : 0,
      fieldsBackfilled: commitMode ? totalFieldsBackfilled : 0,
      accountsMoved: commitMode ? totalAccountsMoved : 0,
      merges,
    },
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
