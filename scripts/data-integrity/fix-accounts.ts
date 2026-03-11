#!/usr/bin/env npx tsx
/**
 * Phase 3: FIX — Targeted data repairs on account documents
 *
 * 3a: Carrier name resolution (fuzzy match against carriers collection, >85% similarity = update)
 * 3b: Account type category derivation (from product_type/account_type text matching)
 * 3c: Status standardization (Active, In Force, Pending, Inactive, Surrendered, Terminated, Matured)
 * 3d: Empty doc flagging (_flagged: 'empty_doc' -- do NOT delete)
 * 3e: Premium/value cleanup (strip $, commas, convert to numbers)
 *
 * Usage: npx tsx scripts/data-integrity/fix-accounts.ts
 *        npx tsx scripts/data-integrity/fix-accounts.ts --dry-run
 *        npx tsx scripts/data-integrity/fix-accounts.ts --phase 3a
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'claude-mcp-484718'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')
const PHASE_ARG = process.argv.find(a => a.startsWith('--phase'))
const ONLY_PHASE = PHASE_ARG ? process.argv[process.argv.indexOf(PHASE_ARG) + 1] : null

// ============================================================================
// Stats
// ============================================================================

interface FixStats {
  phase3a: { checked: number; fixed: number; samples: { docPath: string; from: string; to: string }[] }
  phase3b: { checked: number; derived: number; samples: { docPath: string; derived: string; from: string }[] }
  phase3c: { checked: number; standardized: number; samples: { docPath: string; from: string; to: string }[] }
  phase3d: { checked: number; flagged: number; samples: string[] }
  phase3e: { checked: number; cleaned: number; fieldChanges: Record<string, number> }
  totalErrors: number
  errorSamples: string[]
}

// ============================================================================
// 3a: Carrier Name Resolution (fuzzy match)
// ============================================================================

/**
 * Levenshtein distance for fuzzy matching.
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }
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

async function loadCarrierLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>()
  const snap = await db.collection('carriers').get()
  for (const doc of snap.docs) {
    const data = doc.data()
    const name = String(data.carrier_name || data.name || '').trim()
    if (name) {
      lookup.set(name.toLowerCase(), name)
    }
  }
  return lookup
}

function resolveCarrier(rawName: string, carrierLookup: Map<string, string>): string | null {
  if (!rawName) return null
  const lower = rawName.trim().toLowerCase()

  // Exact match
  if (carrierLookup.has(lower)) return carrierLookup.get(lower)!

  // Fuzzy match - find best match above 85% threshold
  let bestMatch = ''
  let bestScore = 0

  for (const [key, canonical] of carrierLookup.entries()) {
    const score = similarity(lower, key)
    if (score > bestScore) {
      bestScore = score
      bestMatch = canonical
    }
  }

  if (bestScore >= 85) {
    return bestMatch
  }

  return null
}

// ============================================================================
// 3b: Account Type Category Derivation
// ============================================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  annuity: ['annuity', 'annuities', 'fia', 'myga', 'spia', 'fixed indexed', 'variable annuity', 'deferred', 'immediate annuity'],
  life: ['life', 'term', 'whole life', 'iul', 'universal life', 'final expense', 'graded', 'level benefit'],
  medicare: ['medicare', 'mapd', 'pdp', 'medigap', 'med supp', 'medsup', 'medsupp', 'supplement', 'advantage', 'dsnp', 'csnp', 'snp', 'hmo', 'ppo'],
  bdria: ['advisory', 'brokerage', 'bd/ria', 'bdria', 'fee-based', 'commission-based', 'ria', 'broker dealer', 'schwab', 'rbc'],
  banking: ['banking', 'bank', 'checking', 'savings', 'cd ', 'certificate of deposit', 'money market'],
}

function deriveCategory(data: Record<string, unknown>): string | null {
  // Check multiple fields for type hints
  const textToCheck = [
    String(data.product_type || ''),
    String(data.core_product_type || ''),
    String(data.account_type || ''),
    String(data.policy_type || ''),
    String(data.product_name || ''),
  ].join(' ').toLowerCase()

  if (!textToCheck.trim()) return null

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (textToCheck.includes(keyword)) {
        return category
      }
    }
  }

  return null
}

// ============================================================================
// 3c: Status Standardization
// ============================================================================

const STATUS_STANDARD: Record<string, string> = {
  // Active variants
  'active': 'Active',
  'acive': 'Active',
  'actve': 'Active',
  'in force': 'In Force',
  'inforce': 'In Force',
  'in-force': 'In Force',
  'issued': 'Active',
  'enrolled': 'Active',
  'current': 'Active',

  // Pending variants
  'pending': 'Pending',
  'application': 'Pending',
  'submitted': 'Pending',
  'issued contract': 'Pending',
  'account funding': 'Pending',
  'new business submission': 'Pending',
  'approved pending req': 'Pending',
  'approved': 'Pending',
  'not taken': 'Pending',

  // Inactive variants
  'inactive': 'Inactive',
  'inactve': 'Inactive',
  'disenrolled': 'Inactive',
  'term submitted': 'Inactive',
  'pending terminated': 'Inactive',
  'not active': 'Inactive',
  'cancelled': 'Inactive',
  'canceled': 'Inactive',
  'lapsed': 'Inactive',

  // Surrendered
  'surrendered': 'Surrendered',
  'surrender': 'Surrendered',
  'cash surrender': 'Surrendered',

  // Terminated
  'terminated': 'Terminated',
  'term': 'Terminated',
  'termination': 'Terminated',

  // Matured
  'matured': 'Matured',
  'maturity': 'Matured',

  // Deceased
  'deceased': 'Deceased',
  'dead': 'Deceased',
  'death': 'Deceased',
  'death claim': 'Deceased',

  // Claims
  'claim': 'Claim',
  'claim pending': 'Claim',
}

function standardizeStatus(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+eff\s+.*$/, '')
    .replace(/\s+date\s+.*$/, '')
    .replace(/\s*[-]\s*\d[\d\s]*$/, '')
    .replace(/\s+\d{4,}$/, '')
    .replace(/\s*-\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null

  const mapped = STATUS_STANDARD[cleaned]
  if (mapped) return mapped

  // Already one of the standard values?
  const standardValues = new Set(Object.values(STATUS_STANDARD))
  if (standardValues.has(raw.trim())) return null // Already standard

  return null // Can't standardize
}

// ============================================================================
// 3e: Premium/Value Cleanup
// ============================================================================

const AMOUNT_FIELDS = [
  'premium', 'scheduled_premium', 'annual_premium', 'planned_premium',
  'commissionable_premium', 'monthly_premium', 'account_value',
  'net_deposits', 'surrender_value', 'death_benefit', 'benefit_base',
  'guaranteed_minimum', 'income_gross', 'income_net', 'income_base',
  'cash_value', 'face_amount', 'total_premiums_paid', 'loan_balance',
  'market_value', 'cost_basis', 'cash_balance', 'balance',
  'payment_amount', 'original_amount', 'rate_action_premium',
]

function cleanAmount(raw: unknown): { changed: boolean; value: number } {
  if (raw == null || raw === '') return { changed: false, value: 0 }
  if (typeof raw === 'number') return { changed: false, value: raw }

  const str = String(raw)
  // Guard: Date objects stringified
  if (/1899.*GMT/i.test(str) || /1900.*GMT/i.test(str)) return { changed: true, value: 0 }

  const cleaned = str.replace(/[$,\s]/g, '').trim()
  const num = parseFloat(cleaned)
  if (isNaN(num)) return { changed: true, value: 0 }

  // If the original was a string but should be a number, that's a change
  if (typeof raw === 'string') return { changed: true, value: num }

  return { changed: false, value: num }
}

// ============================================================================
// Non-Empty field counter
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
// Main Fix Pipeline
// ============================================================================

async function runFix(): Promise<FixStats> {
  console.log(`=== Phase 3: FIX — accounts subcollections ${DRY_RUN ? '(DRY RUN)' : ''} ===`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)
  if (ONLY_PHASE) console.log(`   Running only phase: ${ONLY_PHASE}`)

  const stats: FixStats = {
    phase3a: { checked: 0, fixed: 0, samples: [] },
    phase3b: { checked: 0, derived: 0, samples: [] },
    phase3c: { checked: 0, standardized: 0, samples: [] },
    phase3d: { checked: 0, flagged: 0, samples: [] },
    phase3e: { checked: 0, cleaned: 0, fieldChanges: {} },
    totalErrors: 0,
    errorSamples: [],
  }

  // Load carrier lookup for 3a
  let carrierLookup = new Map<string, string>()
  if (!ONLY_PHASE || ONLY_PHASE === '3a') {
    console.log('   Loading carrier reference for fuzzy matching...')
    carrierLookup = await loadCarrierLookup()
    console.log(`   Carriers loaded: ${carrierLookup.size}`)
  }

  // Query all accounts
  console.log('   Querying all accounts (collection group)...')
  const accountsSnap = await db.collectionGroup('accounts').get()
  const totalDocs = accountsSnap.size
  console.log(`   Total account docs: ${totalDocs}`)

  const BATCH_SIZE = 500
  const docs = accountsSnap.docs
  let batchNum = 0

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    batchNum++
    const chunk = docs.slice(i, i + BATCH_SIZE)
    const batch = DRY_RUN ? null : db.batch()
    let batchChanges = 0

    for (const doc of chunk) {
      const data = doc.data()
      const docPath = doc.ref.path
      const updates: Record<string, unknown> = {}

      try {
        // ===== 3a: Carrier Name Resolution =====
        if (!ONLY_PHASE || ONLY_PHASE === '3a') {
          stats.phase3a.checked++
          const carrier = String(data.carrier_name || '').trim()
          if (carrier) {
            const resolved = resolveCarrier(carrier, carrierLookup)
            if (resolved && resolved !== carrier) {
              updates['carrier_name'] = resolved
              stats.phase3a.fixed++
              if (stats.phase3a.samples.length < 30) {
                stats.phase3a.samples.push({ docPath, from: carrier, to: resolved })
              }
            }
          }
        }

        // ===== 3b: Account Type Category Derivation =====
        if (!ONLY_PHASE || ONLY_PHASE === '3b') {
          stats.phase3b.checked++
          const existingCategory = String(data.account_type_category || '').trim()
          if (!existingCategory || existingCategory === 'unknown') {
            const derived = deriveCategory(data)
            if (derived) {
              updates['account_type_category'] = derived
              stats.phase3b.derived++
              const fromText = [
                data.product_type,
                data.core_product_type,
                data.account_type,
              ].filter(Boolean).join(', ')
              if (stats.phase3b.samples.length < 30) {
                stats.phase3b.samples.push({ docPath, derived, from: fromText })
              }
            }
          }
        }

        // ===== 3c: Status Standardization =====
        if (!ONLY_PHASE || ONLY_PHASE === '3c') {
          stats.phase3c.checked++
          const rawStatus = String(data.status || data.account_status || data.policy_status || '').trim()
          if (rawStatus) {
            const standardized = standardizeStatus(rawStatus)
            if (standardized) {
              // Determine which field to update
              const statusField = data.status ? 'status' : data.account_status ? 'account_status' : 'policy_status'
              updates[statusField] = standardized
              stats.phase3c.standardized++
              if (stats.phase3c.samples.length < 30) {
                stats.phase3c.samples.push({ docPath, from: rawStatus, to: standardized })
              }
            }
          }
        }

        // ===== 3d: Empty Doc Flagging =====
        if (!ONLY_PHASE || ONLY_PHASE === '3d') {
          stats.phase3d.checked++
          const nonEmptyCount = countNonEmpty(data)
          if (nonEmptyCount < 3 && !data._flagged) {
            updates['_flagged'] = 'empty_doc'
            updates['_flagged_at'] = new Date().toISOString()
            stats.phase3d.flagged++
            if (stats.phase3d.samples.length < 30) {
              stats.phase3d.samples.push(docPath)
            }
          }
        }

        // ===== 3e: Premium/Value Cleanup =====
        if (!ONLY_PHASE || ONLY_PHASE === '3e') {
          stats.phase3e.checked++
          let fieldCleaned = false
          for (const field of AMOUNT_FIELDS) {
            if (data[field] !== undefined) {
              const { changed, value } = cleanAmount(data[field])
              if (changed) {
                updates[field] = value
                fieldCleaned = true
                stats.phase3e.fieldChanges[field] = (stats.phase3e.fieldChanges[field] || 0) + 1
              }
            }
          }
          if (fieldCleaned) stats.phase3e.cleaned++
        }

        // Apply all updates for this doc
        if (Object.keys(updates).length > 0) {
          updates['_fixed_at'] = new Date().toISOString()
          if (!DRY_RUN && batch) {
            batch.update(doc.ref, updates)
            batchChanges++
          }
        }
      } catch (err) {
        stats.totalErrors++
        if (stats.errorSamples.length < 20) {
          stats.errorSamples.push(`${docPath}: ${err}`)
        }
      }
    }

    // Commit batch
    if (!DRY_RUN && batch && batchChanges > 0) {
      await batch.commit()
    }

    if (batchNum % 5 === 0 || i + BATCH_SIZE >= docs.length) {
      const p = Math.min(i + BATCH_SIZE, docs.length)
      console.log(`   Batch ${batchNum}: processed ${p}/${totalDocs}`)
    }
  }

  return stats
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const stats = await runFix()

    console.log('\n=== FIX SUMMARY ===')
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
    console.log(`   Total errors: ${stats.totalErrors}`)

    console.log('\n   3a: Carrier Name Resolution')
    console.log(`      Checked: ${stats.phase3a.checked.toLocaleString()}`)
    console.log(`      Fixed: ${stats.phase3a.fixed.toLocaleString()}`)
    if (stats.phase3a.samples.length > 0) {
      console.log('      Samples:')
      for (const s of stats.phase3a.samples.slice(0, 10)) {
        console.log(`         "${s.from}" -> "${s.to}"`)
      }
    }

    console.log('\n   3b: Account Type Category Derivation')
    console.log(`      Checked: ${stats.phase3b.checked.toLocaleString()}`)
    console.log(`      Derived: ${stats.phase3b.derived.toLocaleString()}`)
    if (stats.phase3b.samples.length > 0) {
      console.log('      Samples:')
      for (const s of stats.phase3b.samples.slice(0, 10)) {
        console.log(`         "${s.from}" -> ${s.derived}`)
      }
    }

    console.log('\n   3c: Status Standardization')
    console.log(`      Checked: ${stats.phase3c.checked.toLocaleString()}`)
    console.log(`      Standardized: ${stats.phase3c.standardized.toLocaleString()}`)
    if (stats.phase3c.samples.length > 0) {
      console.log('      Samples:')
      for (const s of stats.phase3c.samples.slice(0, 10)) {
        console.log(`         "${s.from}" -> "${s.to}"`)
      }
    }

    console.log('\n   3d: Empty Doc Flagging')
    console.log(`      Checked: ${stats.phase3d.checked.toLocaleString()}`)
    console.log(`      Flagged: ${stats.phase3d.flagged.toLocaleString()}`)

    console.log('\n   3e: Premium/Value Cleanup')
    console.log(`      Checked: ${stats.phase3e.checked.toLocaleString()}`)
    console.log(`      Docs cleaned: ${stats.phase3e.cleaned.toLocaleString()}`)
    if (Object.keys(stats.phase3e.fieldChanges).length > 0) {
      console.log('      Fields changed:')
      for (const [f, c] of Object.entries(stats.phase3e.fieldChanges).sort((a, b) => b[1] - a[1])) {
        console.log(`         ${f}: ${c.toLocaleString()}`)
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
    console.error('FIX FAILED:', err)
    process.exit(1)
  }
}

export { main as runFix, FixStats }

main()
