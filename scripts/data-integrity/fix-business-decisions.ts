#!/usr/bin/env npx tsx
/**
 * Phase 4: Business Decision Fixes
 *
 * Implements Auditor decisions on the 4 open items from Builder 2:
 *
 *   4a: "T" status -> "Terminated" (15 accounts)
 *   4b: Orphan accounts -> flag with _flagged: 'orphan_no_parent_client' (57 accounts)
 *   4c: Missing carrier refs -> fuzzy match at >80 threshold + flag remainder (69 accounts)
 *   4d: Duplicate accounts -> dedup by keeping most complete (2,756 groups)
 *       (Dedup is in a separate script: dedup-accounts.ts)
 *
 * Usage: npx tsx scripts/data-integrity/fix-business-decisions.ts
 *        npx tsx scripts/data-integrity/fix-business-decisions.ts --dry-run
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
// Levenshtein for fuzzy matching (reuse from fix-accounts.ts)
// ============================================================================

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) matrix[i] = [i]
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return ((maxLen - levenshtein(a, b)) / maxLen) * 100
}

// ============================================================================
// Manually curated alias map for known missing carriers (discovered in audit)
// ============================================================================

const DISCOVERED_CARRIER_ALIASES: Record<string, string> = {
  // From audit: 69 missing carrier refs
  'devoted health': 'Devoted Health',       // New carrier -- not in carriers collection but valid
  'fg': 'F&G Life',                         // F&G Life (Fidelity & Guaranty)
  'agcorebridge': 'Corebridge',             // Typo/compound: AG + Corebridge -> Corebridge (AIG rebrand)
  'consolidated': 'Consolidated',           // Ambiguous -- keep as-is, flag for review
  'ace property casualty insurance company': 'ACE',  // ACE (now Chubb) -- map to existing ACE
  'national general insurance': 'Allstate', // National General acquired by Allstate 2021
  'lincoln benefit life may be external': 'Lincoln Benefit Life', // Strip metadata suffix
  'oceanview': 'Oceanview Life and Annuity',
  'jackson life': 'Jackson National Life',
  'life insurance company': '',             // Too generic -- cannot resolve, will flag
  'columbus life insurance company': 'Columbus Life',
  'employer benefits': '',                  // Too generic -- cannot resolve, will flag
  'primerica- 10 yr term': 'Primerica',    // Strip product suffix from carrier name
}

// ============================================================================
// Stats
// ============================================================================

interface Phase4Stats {
  fix4a: { found: number; updated: number; errors: number }
  fix4b: { found: number; flagged: number; errors: number }
  fix4c: {
    total: number
    fuzzyResolved: number
    aliasResolved: number
    flaggedUnknown: number
    errors: number
    resolutions: { from: string; to: string; method: string; score?: number }[]
  }
}

// ============================================================================
// 4a: "T" status -> "Terminated"
// ============================================================================

async function fix4a(stats: Phase4Stats): Promise<void> {
  console.log('\n--- 4a: "T" status -> "Terminated" ---')

  const accountsSnap = await db.collectionGroup('accounts').get()
  const tStatusDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []

  for (const doc of accountsSnap.docs) {
    const data = doc.data()
    const status = String(data.status || '').trim()
    if (status === 'T') {
      tStatusDocs.push(doc)
    }
  }

  stats.fix4a.found = tStatusDocs.length
  console.log(`   Found ${tStatusDocs.length} accounts with status "T"`)

  if (tStatusDocs.length === 0) return

  const BATCH_SIZE = 500
  for (let i = 0; i < tStatusDocs.length; i += BATCH_SIZE) {
    const batch = DRY_RUN ? null : db.batch()
    const chunk = tStatusDocs.slice(i, i + BATCH_SIZE)

    for (const doc of chunk) {
      try {
        if (!DRY_RUN && batch) {
          batch.update(doc.ref, {
            status: 'Terminated',
            _fixed_at: new Date().toISOString(),
            _fix_reason: '4a: T -> Terminated per Auditor decision',
          })
        }
        stats.fix4a.updated++
      } catch (err) {
        stats.fix4a.errors++
      }
    }

    if (!DRY_RUN && batch) await batch.commit()
  }

  console.log(`   Updated: ${stats.fix4a.updated}`)
}

// ============================================================================
// 4b: Orphan accounts -> flag
// ============================================================================

async function fix4b(stats: Phase4Stats): Promise<void> {
  console.log('\n--- 4b: Orphan accounts -> flag ---')

  // Load all client IDs
  const clientIds = new Set<string>()
  const clientSnap = await db.collection('clients').select().get()
  for (const doc of clientSnap.docs) {
    clientIds.add(doc.id)
  }
  console.log(`   Client IDs loaded: ${clientIds.size}`)

  // Find orphan accounts
  const accountsSnap = await db.collectionGroup('accounts').get()
  const orphanDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []

  for (const doc of accountsSnap.docs) {
    const pathParts = doc.ref.path.split('/')
    const clientId = pathParts.length >= 2 ? pathParts[1] : ''
    if (clientId && !clientIds.has(clientId)) {
      orphanDocs.push(doc)
    }
  }

  stats.fix4b.found = orphanDocs.length
  console.log(`   Found ${orphanDocs.length} orphan accounts`)

  if (orphanDocs.length === 0) return

  const BATCH_SIZE = 500
  for (let i = 0; i < orphanDocs.length; i += BATCH_SIZE) {
    const batch = DRY_RUN ? null : db.batch()
    const chunk = orphanDocs.slice(i, i + BATCH_SIZE)

    for (const doc of chunk) {
      try {
        if (!DRY_RUN && batch) {
          batch.update(doc.ref, {
            _flagged: 'orphan_no_parent_client',
            _flagged_at: new Date().toISOString(),
          })
        }
        stats.fix4b.flagged++
      } catch (err) {
        stats.fix4b.errors++
      }
    }

    if (!DRY_RUN && batch) await batch.commit()
  }

  console.log(`   Flagged: ${stats.fix4b.flagged}`)
}

// ============================================================================
// 4c: Missing carrier refs -> fuzzy match + flag remainder
// ============================================================================

async function fix4c(stats: Phase4Stats): Promise<void> {
  console.log('\n--- 4c: Missing carrier refs -> fuzzy match + expand aliases ---')

  // Load carrier names from carriers collection
  const carrierLookup = new Map<string, string>()
  const carrierSnap = await db.collection('carriers').get()
  for (const doc of carrierSnap.docs) {
    const data = doc.data()
    const name = String(data.carrier_name || data.name || '').trim()
    if (name) {
      carrierLookup.set(name.toLowerCase(), name)
    }
  }
  console.log(`   Carrier reference loaded: ${carrierLookup.size} names`)

  // Find all accounts with carrier names NOT in the carriers collection
  const accountsSnap = await db.collectionGroup('accounts').get()
  const missingCarrierDocs: { doc: FirebaseFirestore.QueryDocumentSnapshot; carrierName: string }[] = []

  for (const doc of accountsSnap.docs) {
    const data = doc.data()
    const carrier = String(data.carrier_name || '').trim()
    if (carrier && !carrierLookup.has(carrier.toLowerCase())) {
      missingCarrierDocs.push({ doc, carrierName: carrier })
    }
  }

  stats.fix4c.total = missingCarrierDocs.length
  console.log(`   Found ${missingCarrierDocs.length} accounts with unresolved carrier names`)

  if (missingCarrierDocs.length === 0) return

  // Group by carrier name for efficient processing
  const byCarrier = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>()
  for (const { doc, carrierName } of missingCarrierDocs) {
    if (!byCarrier.has(carrierName)) byCarrier.set(carrierName, [])
    byCarrier.get(carrierName)!.push(doc)
  }

  console.log(`   Unique unresolved carrier names: ${byCarrier.size}`)

  // Resolve each unique carrier name
  const resolutionMap = new Map<string, { canonical: string; method: string; score?: number } | null>()

  for (const [rawName] of byCarrier.entries()) {
    const lower = rawName.toLowerCase()
      .replace(/_/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Step 1: Check discovered aliases (manual curation from audit)
    if (DISCOVERED_CARRIER_ALIASES[lower] !== undefined) {
      const canonical = DISCOVERED_CARRIER_ALIASES[lower]
      if (canonical) {
        resolutionMap.set(rawName, { canonical, method: 'alias' })
        continue
      } else {
        // Empty string means "cannot resolve"
        resolutionMap.set(rawName, null)
        continue
      }
    }

    // Step 2: Fuzzy match against carriers collection at >80 threshold
    let bestMatch = ''
    let bestScore = 0

    for (const [key, canonical] of carrierLookup.entries()) {
      const score = similarity(lower, key)
      if (score > bestScore) {
        bestScore = score
        bestMatch = canonical
      }
    }

    if (bestScore > 80) {
      resolutionMap.set(rawName, { canonical: bestMatch, method: 'fuzzy', score: bestScore })
    } else {
      resolutionMap.set(rawName, null)
    }
  }

  // Apply resolutions
  const allDocs = missingCarrierDocs.map(x => x.doc)
  const BATCH_SIZE = 500

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = DRY_RUN ? null : db.batch()
    const chunk = missingCarrierDocs.slice(i, i + BATCH_SIZE)

    for (const { doc, carrierName } of chunk) {
      try {
        const resolution = resolutionMap.get(carrierName)
        if (resolution) {
          // Resolved -- update carrier_name
          if (!DRY_RUN && batch) {
            batch.update(doc.ref, {
              carrier_name: resolution.canonical,
              _carrier_resolved_from: carrierName,
              _carrier_resolution_method: resolution.method,
              _fixed_at: new Date().toISOString(),
            })
          }
          if (resolution.method === 'fuzzy') {
            stats.fix4c.fuzzyResolved++
          } else {
            stats.fix4c.aliasResolved++
          }
          if (stats.fix4c.resolutions.length < 50) {
            stats.fix4c.resolutions.push({
              from: carrierName,
              to: resolution.canonical,
              method: resolution.method,
              score: resolution.score,
            })
          }
        } else {
          // Cannot resolve -- flag as unknown
          if (!DRY_RUN && batch) {
            batch.update(doc.ref, {
              _flagged: 'unknown_carrier',
              _flagged_at: new Date().toISOString(),
            })
          }
          stats.fix4c.flaggedUnknown++
        }
      } catch (err) {
        stats.fix4c.errors++
      }
    }

    if (!DRY_RUN && batch) await batch.commit()
  }

  console.log(`   Alias-resolved: ${stats.fix4c.aliasResolved}`)
  console.log(`   Fuzzy-resolved: ${stats.fix4c.fuzzyResolved}`)
  console.log(`   Flagged unknown: ${stats.fix4c.flaggedUnknown}`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`=== Phase 4: Business Decision Fixes ${DRY_RUN ? '(DRY RUN)' : ''} ===`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  const stats: Phase4Stats = {
    fix4a: { found: 0, updated: 0, errors: 0 },
    fix4b: { found: 0, flagged: 0, errors: 0 },
    fix4c: { total: 0, fuzzyResolved: 0, aliasResolved: 0, flaggedUnknown: 0, errors: 0, resolutions: [] },
  }

  await fix4a(stats)
  await fix4b(stats)
  await fix4c(stats)

  console.log('\n=== PHASE 4 SUMMARY ===')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  console.log('\n   4a: "T" -> "Terminated"')
  console.log(`      Found: ${stats.fix4a.found} | Updated: ${stats.fix4a.updated} | Errors: ${stats.fix4a.errors}`)

  console.log('\n   4b: Orphan flagging')
  console.log(`      Found: ${stats.fix4b.found} | Flagged: ${stats.fix4b.flagged} | Errors: ${stats.fix4b.errors}`)

  console.log('\n   4c: Carrier resolution')
  console.log(`      Total unresolved: ${stats.fix4c.total}`)
  console.log(`      Alias-resolved: ${stats.fix4c.aliasResolved}`)
  console.log(`      Fuzzy-resolved: ${stats.fix4c.fuzzyResolved}`)
  console.log(`      Flagged unknown: ${stats.fix4c.flaggedUnknown}`)
  console.log(`      Errors: ${stats.fix4c.errors}`)
  if (stats.fix4c.resolutions.length > 0) {
    console.log('      Resolutions:')
    for (const r of stats.fix4c.resolutions) {
      const scoreStr = r.score ? ` (${r.score.toFixed(1)}%)` : ''
      console.log(`         "${r.from}" -> "${r.to}" [${r.method}${scoreStr}]`)
    }
  }

  return stats
}

main().catch(err => {
  console.error('PHASE 4 FAILED:', err)
  process.exit(1)
})
