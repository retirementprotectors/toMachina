/**
 * Rename BD/RIA account_type_category to "Investments"
 *
 * Queries all account subcollection docs (collectionGroup 'accounts')
 * where account_type_category matches any BD/RIA variant, then updates
 * them to the canonical "Investments" value.
 *
 * Also checks for a top-level 'accounts_bdria' collection and reports
 * any docs found there.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'claude-mcp-484718'
const BATCH_LIMIT = 400

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

// All known BD/RIA variants to rename -- lowercase set for comparison
const BDRIA_LOWER = new Set(['bd/ria', 'bdria', 'bd_ria'])

async function main() {
  console.log('\n=== Rename BD/RIA -> Investments ===\n')

  // --- Phase 1: Subcollection accounts via collectionGroup ---

  console.log('Phase 1: Querying collectionGroup "accounts" for BD/RIA variants...\n')

  const allAccountsSnap = await db.collectionGroup('accounts').get()
  console.log(`  Total account docs found: ${allAccountsSnap.size}`)

  const matchingDocs: { ref: FirebaseFirestore.DocumentReference; currentValue: string; path: string }[] = []

  for (const doc of allAccountsSnap.docs) {
    const data = doc.data()
    const cat = String(data.account_type_category || '').trim()
    if (BDRIA_LOWER.has(cat.toLowerCase())) {
      matchingDocs.push({
        ref: doc.ref,
        currentValue: cat,
        path: doc.ref.path,
      })
    }
  }

  console.log(`  Matching BD/RIA docs: ${matchingDocs.length}`)

  // Show breakdown by variant
  const variantCounts = new Map<string, number>()
  for (const d of matchingDocs) {
    variantCounts.set(d.currentValue, (variantCounts.get(d.currentValue) || 0) + 1)
  }
  if (variantCounts.size > 0) {
    console.log('\n  Breakdown by variant:')
    for (const [variant, count] of variantCounts.entries()) {
      console.log(`    "${variant}": ${count}`)
    }
  }

  // Show sample paths
  if (matchingDocs.length > 0) {
    console.log('\n  Sample paths (first 10):')
    for (const d of matchingDocs.slice(0, 10)) {
      console.log(`    ${d.path} (was: "${d.currentValue}")`)
    }
  }

  // Execute batch writes for subcollection accounts
  let updated = 0
  let errors = 0

  if (matchingDocs.length > 0) {
    console.log(`\n  Writing ${matchingDocs.length} updates...`)

    for (let i = 0; i < matchingDocs.length; i += BATCH_LIMIT) {
      const chunk = matchingDocs.slice(i, i + BATCH_LIMIT)
      const batch = db.batch()

      for (const item of chunk) {
        batch.update(item.ref, {
          account_type_category: 'Investments',
          _rename_from: item.currentValue,
          _rename_at: new Date().toISOString(),
        })
      }

      try {
        await batch.commit()
        updated += chunk.length
        console.log(`    Batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} docs updated (total: ${updated})`)
      } catch (err) {
        console.error(`    Batch ${Math.floor(i / BATCH_LIMIT) + 1}: FAILED`, err)
        errors += chunk.length
      }
    }
  }

  // --- Phase 2: Check top-level accounts_bdria collection ---

  console.log('\nPhase 2: Checking top-level "accounts_bdria" collection...')

  const topLevelSnap = await db.collection('accounts_bdria').limit(100).get()

  if (topLevelSnap.empty) {
    console.log('  No top-level "accounts_bdria" collection found (or it is empty). Nothing to migrate.')
  } else {
    console.log(`  Found ${topLevelSnap.size} docs in top-level "accounts_bdria" collection.`)
    console.log('  These should be reviewed manually -- they may need migration to client subcollections.')

    for (const doc of topLevelSnap.docs) {
      const data = doc.data()
      const clientId = data.client_id || '(no client_id)'
      const carrier = data.carrier || data.carrier || '(no carrier)'
      console.log(`    ${doc.id}: client=${clientId}, carrier=${carrier}`)
    }
  }

  // --- Summary ---

  console.log('\n=== Summary ===')
  console.log(`  Subcollection accounts scanned: ${allAccountsSnap.size}`)
  console.log(`  BD/RIA docs found:              ${matchingDocs.length}`)
  console.log(`  Updated to "Investments":        ${updated}`)
  console.log(`  Errors:                          ${errors}`)
  console.log(`  Top-level accounts_bdria docs:   ${topLevelSnap.empty ? 0 : topLevelSnap.size}`)
  console.log('\n=== Done ===\n')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
