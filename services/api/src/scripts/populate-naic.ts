/**
 * Populate NAIC codes on accounts that have a charter_code but no naic_code.
 *
 * Reads charter_code from each account, looks up the NAIC in the
 * carrier-charter-map, and writes naic_code back to Firestore.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/populate-naic.ts           # DRY RUN (default)
 *   npx tsx services/api/src/scripts/populate-naic.ts --execute # ACTUALLY WRITE
 *
 * Requires Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Import from source (scripts are excluded from API tsconfig rootDir)
import {
  CHARTER_IDENTITY_MAP,
  type CarrierIdentity,
} from '../../../packages/core/src/normalizers/carrier-charter-map'

const PROJECT_ID = 'claude-mcp-484718'
const BATCH_LIMIT = 400
const DRY_RUN = !process.argv.includes('--execute')

// ============================================================================
// Build charter_code → NAIC lookup from the identity map
// ============================================================================

function buildCharterCodeToNaic(): Map<string, number> {
  const lookup = new Map<string, number>()

  for (const identity of Object.values(CHARTER_IDENTITY_MAP)) {
    if (identity.naic && identity.charter_code) {
      // Only set if not already present (first match wins — they're all consistent)
      if (!lookup.has(identity.charter_code)) {
        lookup.set(identity.charter_code, identity.naic)
      }
    }
  }

  return lookup
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID })
  const db = getFirestore()

  console.log(`\n=== NAIC Code Population ${DRY_RUN ? '(DRY RUN)' : '(EXECUTE MODE)'} ===\n`)

  const charterToNaic = buildCharterCodeToNaic()
  console.log(`Charter codes with known NAIC: ${charterToNaic.size}`)
  for (const [code, naic] of charterToNaic.entries()) {
    console.log(`  ${code} → ${naic}`)
  }

  // Query all accounts via collection group
  const snap = await db.collectionGroup('accounts').get()
  console.log(`\nTotal accounts in Firestore: ${snap.size}`)

  // Filter: has charter_code, missing naic_code
  const candidates = snap.docs.filter(d => {
    const data = d.data()
    const charterCode = data.charter_code
    const naicCode = data.naic_code
    return charterCode && !naicCode
  })

  console.log(`Accounts with charter_code but no naic_code: ${candidates.length}`)

  let updated = 0
  let skippedNoNaic = 0
  let errors = 0

  const batch: { ref: FirebaseFirestore.DocumentReference; update: Record<string, unknown> }[] = []

  for (const doc of candidates) {
    const data = doc.data()
    const charterCode = data.charter_code as string

    const naic = charterToNaic.get(charterCode)
    if (!naic) {
      skippedNoNaic++
      if (!DRY_RUN) {
        console.log(`  SKIPPED: charter_code="${charterCode}" — no NAIC in map. path=${doc.ref.path}`)
      }
      continue
    }

    batch.push({
      ref: doc.ref,
      update: { naic_code: String(naic) },
    })
    updated++
  }

  console.log(`\n--- Summary ---`)
  console.log(`  Total candidates:   ${candidates.length}`)
  console.log(`  To update (NAIC found): ${updated}`)
  console.log(`  Skipped (no NAIC in map): ${skippedNoNaic}`)

  if (DRY_RUN) {
    console.log(`\n  DRY RUN — no writes performed.`)
    console.log(`  Run with --execute to apply ${updated} updates.\n`)
    return
  }

  // Execute batch writes
  console.log(`\nWriting ${batch.length} updates in batches of ${BATCH_LIMIT}...`)
  for (let i = 0; i < batch.length; i += BATCH_LIMIT) {
    const chunk = batch.slice(i, i + BATCH_LIMIT)
    const writeBatch = db.batch()
    for (const item of chunk) {
      writeBatch.update(item.ref, item.update)
    }
    try {
      await writeBatch.commit()
      console.log(`  Batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} docs updated`)
    } catch (err) {
      console.error(`  Batch ${Math.floor(i / BATCH_LIMIT) + 1}: FAILED —`, err)
      errors += chunk.length
    }
  }

  console.log(`\n=== Complete ===`)
  console.log(`  Updated: ${updated - errors}`)
  console.log(`  Errors:  ${errors}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
