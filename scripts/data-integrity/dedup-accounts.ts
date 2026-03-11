#!/usr/bin/env npx tsx
/**
 * Phase 4d: Duplicate Account Resolution
 *
 * Groups accounts by (client_id + policy_number + carrier_name) under the same client.
 * For each duplicate group:
 *   - Keeps the record with the most non-empty fields (winner)
 *   - Flags losers with _flagged: 'duplicate' and _dedup_kept: '{winning_doc_id}'
 *   - Does NOT delete any documents
 *
 * Usage: npx tsx scripts/data-integrity/dedup-accounts.ts
 *        npx tsx scripts/data-integrity/dedup-accounts.ts --dry-run
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'claude-mcp-484718'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

// ============================================================================
// Helpers
// ============================================================================

function countNonEmpty(data: Record<string, unknown>): number {
  let count = 0
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_')) continue
    if (val !== null && val !== undefined && val !== '' && val !== 0) count++
  }
  return count
}

// ============================================================================
// Stats
// ============================================================================

interface DedupStats {
  totalAccounts: number
  totalGroups: number
  dupGroups: number
  keptCount: number
  flaggedCount: number
  errors: number
  groupSizeDist: Record<number, number>  // group size -> count of groups
  samples: { key: string; kept: string; flagged: string[]; keptFields: number; flaggedFields: number[] }[]
}

// ============================================================================
// Main Dedup
// ============================================================================

async function runDedup(): Promise<DedupStats> {
  console.log(`=== Phase 4d: Dedup Accounts ${DRY_RUN ? '(DRY RUN)' : ''} ===`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  const stats: DedupStats = {
    totalAccounts: 0,
    totalGroups: 0,
    dupGroups: 0,
    keptCount: 0,
    flaggedCount: 0,
    errors: 0,
    groupSizeDist: {},
    samples: [],
  }

  // Query all accounts
  console.log('   Querying all accounts (collection group)...')
  const accountsSnap = await db.collectionGroup('accounts').get()
  stats.totalAccounts = accountsSnap.size
  console.log(`   Total account docs: ${stats.totalAccounts}`)

  // Group by client_id + policy_number + carrier_name
  // Use the path to extract client_id (path = clients/{clientId}/accounts/{docId})
  const groups = new Map<string, { doc: FirebaseFirestore.QueryDocumentSnapshot; data: Record<string, unknown>; fieldCount: number }[]>()

  for (const doc of accountsSnap.docs) {
    const data = doc.data()
    const pathParts = doc.ref.path.split('/')
    const clientId = pathParts.length >= 2 ? pathParts[1] : ''

    const policyNumber = String(data.policy_number || '').trim()
    const carrierName = String(data.carrier_name || '').trim().toLowerCase()

    // Only group docs that have a policy_number -- others can't be deduped reliably
    if (!clientId || !policyNumber) continue

    const key = `${clientId}::${policyNumber}::${carrierName}`
    if (!groups.has(key)) groups.set(key, [])

    groups.get(key)!.push({
      doc,
      data: data as Record<string, unknown>,
      fieldCount: countNonEmpty(data as Record<string, unknown>),
    })
  }

  stats.totalGroups = groups.size
  console.log(`   Unique groups (client + policy + carrier): ${stats.totalGroups}`)

  // Find duplicate groups (size > 1)
  const dupEntries: [string, { doc: FirebaseFirestore.QueryDocumentSnapshot; data: Record<string, unknown>; fieldCount: number }[]][] = []

  for (const [key, members] of groups.entries()) {
    const size = members.length
    stats.groupSizeDist[size] = (stats.groupSizeDist[size] || 0) + 1

    if (size > 1) {
      dupEntries.push([key, members])
    }
  }

  stats.dupGroups = dupEntries.length
  console.log(`   Duplicate groups: ${stats.dupGroups}`)
  console.log(`   Group size distribution:`)
  for (const [size, count] of Object.entries(stats.groupSizeDist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`      Size ${size}: ${count} groups`)
  }

  if (stats.dupGroups === 0) {
    console.log('   No duplicates found.')
    return stats
  }

  // Process duplicates in batches
  const BATCH_SIZE = 500
  let batchQueue: { ref: FirebaseFirestore.DocumentReference; updates: Record<string, unknown> }[] = []

  for (const [key, members] of dupEntries) {
    // Sort by field count descending -- most complete record wins
    // Tie-breaker: prefer doc IDs that look like policy numbers (not UUIDs)
    members.sort((a, b) => {
      if (b.fieldCount !== a.fieldCount) return b.fieldCount - a.fieldCount
      // Prefer non-UUID doc IDs (policy numbers as doc IDs)
      const aIsUuid = /^[0-9a-f]{8}-/.test(a.doc.id)
      const bIsUuid = /^[0-9a-f]{8}-/.test(b.doc.id)
      if (aIsUuid && !bIsUuid) return 1
      if (!aIsUuid && bIsUuid) return -1
      return 0
    })

    const winner = members[0]
    const losers = members.slice(1)

    stats.keptCount++

    // Collect sample info
    if (stats.samples.length < 30) {
      stats.samples.push({
        key,
        kept: winner.doc.ref.path,
        flagged: losers.map(l => l.doc.ref.path),
        keptFields: winner.fieldCount,
        flaggedFields: losers.map(l => l.fieldCount),
      })
    }

    // Flag losers
    for (const loser of losers) {
      stats.flaggedCount++
      batchQueue.push({
        ref: loser.doc.ref,
        updates: {
          _flagged: 'duplicate',
          _dedup_kept: winner.doc.id,
          _dedup_kept_path: winner.doc.ref.path,
          _flagged_at: new Date().toISOString(),
        },
      })

      // Flush batch when we hit the limit
      if (batchQueue.length >= BATCH_SIZE) {
        if (!DRY_RUN) {
          const batch = db.batch()
          for (const item of batchQueue) {
            batch.update(item.ref, item.updates)
          }
          await batch.commit()
        }
        console.log(`   Flushed batch: ${stats.flaggedCount} flagged so far...`)
        batchQueue = []
      }
    }
  }

  // Flush remaining
  if (batchQueue.length > 0 && !DRY_RUN) {
    const batch = db.batch()
    for (const item of batchQueue) {
      batch.update(item.ref, item.updates)
    }
    await batch.commit()
  }

  return stats
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const stats = await runDedup()

    console.log('\n=== DEDUP SUMMARY ===')
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
    console.log(`   Total accounts: ${stats.totalAccounts.toLocaleString()}`)
    console.log(`   Unique groups: ${stats.totalGroups.toLocaleString()}`)
    console.log(`   Duplicate groups: ${stats.dupGroups.toLocaleString()}`)
    console.log(`   Winners (kept): ${stats.keptCount.toLocaleString()}`)
    console.log(`   Losers (flagged): ${stats.flaggedCount.toLocaleString()}`)
    console.log(`   Errors: ${stats.errors}`)

    if (stats.samples.length > 0) {
      console.log('\n   Sample resolutions (first 10):')
      for (const s of stats.samples.slice(0, 10)) {
        console.log(`      Group: ${s.key.split('::').slice(1).join(' | ')}`)
        console.log(`         Kept: ${s.kept} (${s.keptFields} fields)`)
        for (let i = 0; i < s.flagged.length; i++) {
          console.log(`         Flagged: ${s.flagged[i]} (${s.flaggedFields[i]} fields)`)
        }
      }
    }

    return stats
  } catch (err) {
    console.error('DEDUP FAILED:', err)
    process.exit(1)
  }
}

main()
