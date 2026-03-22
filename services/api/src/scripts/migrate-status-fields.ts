/**
 * migrate-status-fields.ts — Standardize entity-prefixed status fields to generic `status`.
 *
 * Copies: client_status → status, agent_status → status, etc.
 * Keeps old field intact (non-destructive). Cleanup pass can remove old fields later.
 *
 * Run: npx tsx services/api/src/scripts/migrate-status-fields.ts
 * Add --dry-run flag to preview without writing.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()
const DRY_RUN = process.argv.includes('--dry-run')

interface MigrationTarget {
  collection: string
  oldField: string
  newField: string
}

const TARGETS: MigrationTarget[] = [
  { collection: 'clients', oldField: 'client_status', newField: 'status' },
  { collection: 'agents', oldField: 'agent_status', newField: 'status' },
  { collection: 'producers', oldField: 'producer_status', newField: 'status' },
  { collection: 'territories', oldField: 'territory_status', newField: 'status' },
  { collection: 'specialist_configs', oldField: 'config_status', newField: 'status' },
]

async function migrateCollection(target: MigrationTarget) {
  const { collection, oldField, newField } = target
  console.log(`\n--- ${collection}: ${oldField} -> ${newField} ---`)

  const snap = await db.collection(collection).get()
  console.log(`  Total docs: ${snap.size}`)

  let needsMigration = 0
  let alreadyHasStatus = 0
  let noOldField = 0

  const batches: FirebaseFirestore.WriteBatch[] = []
  let currentBatch = db.batch()
  let batchCount = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const oldValue = data[oldField]
    const hasNew = data[newField] !== undefined

    if (!oldValue && !hasNew) {
      noOldField++
      continue
    }

    if (hasNew && !oldValue) {
      alreadyHasStatus++
      continue
    }

    if (hasNew && oldValue && data[newField] === oldValue) {
      alreadyHasStatus++
      continue
    }

    needsMigration++

    if (!DRY_RUN) {
      currentBatch.update(doc.ref, { [newField]: oldValue })
      batchCount++

      if (batchCount >= 400) {
        batches.push(currentBatch)
        currentBatch = db.batch()
        batchCount = 0
      }
    }
  }

  if (batchCount > 0) batches.push(currentBatch)

  console.log(`  Needs migration: ${needsMigration}`)
  console.log(`  Already has '${newField}': ${alreadyHasStatus}`)
  console.log(`  No old field: ${noOldField}`)

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would update ${needsMigration} docs`)
  } else if (batches.length > 0) {
    console.log(`  Committing ${batches.length} batch(es)...`)
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit()
      console.log(`  Batch ${i + 1}/${batches.length} committed`)
    }
    console.log(`  Done: ${needsMigration} docs migrated`)
  } else {
    console.log(`  Nothing to migrate`)
  }
}

async function main() {
  console.log(`Status Field Migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log(`Standardizing entity-prefixed status fields to generic status`)

  for (const target of TARGETS) {
    await migrateCollection(target)
  }

  console.log('\n=== Migration Complete ===')
  if (DRY_RUN) console.log('This was a dry run. Remove --dry-run to execute.')
  process.exit(0)
}

main()
