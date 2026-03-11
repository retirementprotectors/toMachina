#!/usr/bin/env npx tsx
/**
 * Phase 2: NORMALIZE — Apply normalizers to all account documents
 *
 * Runs the normalizeData() dispatcher on each account doc.
 * Only writes back if at least one field actually changed.
 * Processes in 500-doc batches using collection group queries.
 *
 * Normalizes: carrier_name, premium, account_value, face_amount, dates, state, zip,
 *             status, product_type, product_name, plan_name, addresses, cities, etc.
 *
 * Usage: npx tsx scripts/data-integrity/normalize-accounts.ts
 *        npx tsx scripts/data-integrity/normalize-accounts.ts --dry-run
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'claude-mcp-484718'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

// Import normalizers from the core package
import { normalizeData } from '../../packages/core/src/normalizers/index'

const DRY_RUN = process.argv.includes('--dry-run')

// ============================================================================
// Stats Tracking
// ============================================================================

interface NormalizeStats {
  totalProcessed: number
  totalChanged: number
  totalUnchanged: number
  totalErrors: number
  changesByType: Record<string, number>
  changesByField: Record<string, number>
  errorSamples: string[]
}

// ============================================================================
// Main Normalize
// ============================================================================

async function runNormalize(): Promise<NormalizeStats> {
  console.log(`=== Phase 2: NORMALIZE — accounts subcollections ${DRY_RUN ? '(DRY RUN)' : ''} ===`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  const stats: NormalizeStats = {
    totalProcessed: 0,
    totalChanged: 0,
    totalUnchanged: 0,
    totalErrors: 0,
    changesByType: {},
    changesByField: {},
    errorSamples: [],
  }

  // Query all accounts via collection group
  console.log('   Querying all accounts (collection group)...')
  const accountsSnap = await db.collectionGroup('accounts').get()
  const totalDocs = accountsSnap.size
  console.log(`   Total account docs: ${totalDocs}`)

  // Process in batches of 500 (Firestore batch write limit)
  const BATCH_SIZE = 500
  const docs = accountsSnap.docs
  let batchNum = 0

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    batchNum++
    const chunk = docs.slice(i, i + BATCH_SIZE)
    const batch = DRY_RUN ? null : db.batch()
    let batchChanges = 0

    for (const doc of chunk) {
      stats.totalProcessed++

      try {
        const data = doc.data()
        const docPath = doc.ref.path
        const typeCategory = String(data.account_type_category || 'unknown').toLowerCase()

        // Run normalizers on all fields
        const normalized = normalizeData(data as Record<string, unknown>)

        // Determine which fields actually changed
        const changes: Record<string, unknown> = {}
        let hasChanges = false

        for (const [key, newVal] of Object.entries(normalized)) {
          const oldVal = data[key]

          // Skip metadata fields
          if (key.startsWith('_')) continue

          // Compare old and new values
          if (!valuesEqual(oldVal, newVal)) {
            changes[key] = newVal
            hasChanges = true
            stats.changesByField[key] = (stats.changesByField[key] || 0) + 1
          }
        }

        if (hasChanges) {
          stats.totalChanged++
          stats.changesByType[typeCategory] = (stats.changesByType[typeCategory] || 0) + 1

          if (!DRY_RUN && batch) {
            // Add updated_at timestamp
            changes['_normalized_at'] = new Date().toISOString()
            batch.update(doc.ref, changes)
            batchChanges++
          }
        } else {
          stats.totalUnchanged++
        }
      } catch (err) {
        stats.totalErrors++
        if (stats.errorSamples.length < 20) {
          stats.errorSamples.push(`${doc.ref.path}: ${err}`)
        }
      }
    }

    // Commit the batch
    if (!DRY_RUN && batch && batchChanges > 0) {
      await batch.commit()
    }

    if (batchNum % 5 === 0 || i + BATCH_SIZE >= docs.length) {
      console.log(`   Batch ${batchNum}: processed ${Math.min(i + BATCH_SIZE, docs.length)}/${totalDocs} | changes=${stats.totalChanged} | unchanged=${stats.totalUnchanged} | errors=${stats.totalErrors}`)
    }
  }

  return stats
}

/**
 * Deep-ish equality check for values.
 * Handles string/number/null/undefined comparisons.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  // Both null/undefined/empty
  if (a == null && b == null) return true
  if (a === '' && b === '') return true
  if (a == null && b === '') return true
  if (a === '' && b == null) return true

  // Type mismatch (e.g., string "123.45" -> number 123.45)
  if (typeof a !== typeof b) {
    // Special case: amount normalization converts string to number
    if (typeof a === 'string' && typeof b === 'number') {
      return parseFloat(a) === b
    }
    if (typeof a === 'number' && typeof b === 'string') {
      return a === parseFloat(b)
    }
    return false
  }

  // Direct comparison
  return a === b
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const stats = await runNormalize()

    // Print summary
    console.log('\n=== NORMALIZE SUMMARY ===')
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
    console.log(`   Total processed: ${stats.totalProcessed.toLocaleString()}`)
    console.log(`   Changed: ${stats.totalChanged.toLocaleString()}`)
    console.log(`   Unchanged: ${stats.totalUnchanged.toLocaleString()}`)
    console.log(`   Errors: ${stats.totalErrors}`)

    if (Object.keys(stats.changesByType).length > 0) {
      console.log('\n   Changes by account type:')
      for (const [type, count] of Object.entries(stats.changesByType).sort((a, b) => b[1] - a[1])) {
        console.log(`      ${type}: ${count.toLocaleString()}`)
      }
    }

    if (Object.keys(stats.changesByField).length > 0) {
      console.log('\n   Changes by field (top 20):')
      const sortedFields = Object.entries(stats.changesByField).sort((a, b) => b[1] - a[1])
      for (const [field, count] of sortedFields.slice(0, 20)) {
        console.log(`      ${field}: ${count.toLocaleString()}`)
      }
    }

    if (stats.errorSamples.length > 0) {
      console.log('\n   Error samples:')
      for (const err of stats.errorSamples.slice(0, 10)) {
        console.log(`      ${err}`)
      }
    }

    return stats
  } catch (err) {
    console.error('NORMALIZE FAILED:', err)
    process.exit(1)
  }
}

export { main as runNormalize, NormalizeStats }

main()
