/**
 * Seed Firestore `unit_module_defaults` collection from the hardcoded defaults.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-unit-defaults.ts
 *   npx tsx services/api/src/scripts/seed-unit-defaults.ts --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { DEFAULT_UNIT_MODULE_DEFAULTS } from '../../../../packages/core/src/users/modules'

// ============================================================================
// Constants
// ============================================================================

const COLLECTION = 'unit_module_defaults'

// ============================================================================
// CLI Arg Parsing
// ============================================================================

function isDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const dryRun = isDryRun()

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      initializeApp({ credential: cert(serviceAccount) })
    } else {
      // Application Default Credentials (gcloud auth)
      initializeApp()
    }
  }
  const db = getFirestore()

  const entries = Object.entries(DEFAULT_UNIT_MODULE_DEFAULTS)
  console.log(`\nSeeding ${entries.length} unit module defaults${dryRun ? ' [DRY RUN]' : ''}...\n`)

  for (const [unitKey, config] of entries) {
    const docData = {
      label: config.label,
      description: config.description,
      modules: config.modules,
      updated_at: new Date().toISOString(),
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would write ${COLLECTION}/${unitKey}:`)
      console.log(`    ${JSON.stringify(docData)}`)
    } else {
      await db.collection(COLLECTION).doc(unitKey).set(docData)
      console.log(`  Written ${COLLECTION}/${unitKey}: ${config.label} (${config.modules.join(', ')})`)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`TOTAL: ${entries.length} unit module defaults ${dryRun ? '[DRY RUN — no data written]' : 'written to Firestore'}`)
  console.log('')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
