/**
 * Backfill Medicare accounts with underwriting charter + NAIC.
 *
 * Reads all Medicare accounts from Firestore, resolves charter identity
 * from carrier_name + policy_number patterns, and updates the records.
 *
 * Resolution strategies (in order):
 *   1. Direct charter name match (CHARTER_IDENTITY_MAP)
 *   2. Policy number prefix patterns (regex)
 *   3. Single-charter parent auto-assign
 *   4. BoB lookup JSON — cross-reference policy_number against extracted
 *      charter data from raw carrier BoB files (TRK-13338)
 *
 * Usage:
 *   npx tsx services/api/src/scripts/backfill-medicare-charter.ts           # DRY RUN (default)
 *   npx tsx services/api/src/scripts/backfill-medicare-charter.ts --execute # ACTUALLY WRITE
 *
 * Requires Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import from source (scripts are excluded from API tsconfig rootDir)
import { normalizeCarrierFull } from '../../../packages/core/src/normalizers/index'
import { resolveCharterIdentity, SINGLE_CHARTER_PARENTS } from '../../../packages/core/src/normalizers/carrier-charter-map'

const PROJECT_ID = 'claude-mcp-484718'
const BATCH_LIMIT = 400
const DRY_RUN = !process.argv.includes('--execute')

// ============================================================================
// Strategy 4: BoB Lookup JSON (extracted from raw carrier BoB files)
// ============================================================================

interface BoBCharterEntry {
  charter: string
  charter_code: string
  naic?: number
  carrier_id: string
  parent: string
  plan_names?: string[]
  product_type?: string
  product_types?: string[]
  sample_prefixes?: string[]
  source_count?: number
  _note?: string
}

interface BoBLookupData {
  by_policy_prefix: Record<string, BoBCharterEntry>
  by_cms_contract: Record<string, BoBCharterEntry>
  by_carrier_composite_name: Record<string, BoBCharterEntry>
}

function loadBoBLookups(): BoBLookupData {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const lookupPath = resolve(scriptDir, 'data', 'medicare-charter-lookups.json')
  const raw = readFileSync(lookupPath, 'utf-8')
  return JSON.parse(raw) as BoBLookupData
}

/**
 * Strategy 4: Cross-reference policy_number against BoB lookup tables.
 *
 * Checks (in order):
 *   a. CMS contract ID embedded in policy_number (H#### or S#### prefix)
 *   b. Carrier composite name match (e.g., "AETNA- CLI")
 *   c. Policy prefix match (longest prefix first)
 */
function resolveFromBoBLookup(
  policyNumber: string,
  carrierName: string,
  lookups: BoBLookupData
): { charter: string; charter_code: string; naic?: number; carrier_id: string; parent: string } | null {
  // 4a: CMS contract ID in policy_number (Hxxxx or Sxxxx)
  const cmsMatch = policyNumber.match(/^([HS]\d{4})/)
  if (cmsMatch) {
    const contractId = cmsMatch[1]
    const entry = lookups.by_cms_contract[contractId]
    if (entry) {
      return { charter: entry.charter, charter_code: entry.charter_code, naic: entry.naic, carrier_id: entry.carrier_id, parent: entry.parent }
    }
  }

  // 4b: Carrier composite name (from Composite BoB naming like "AETNA- CLI")
  if (carrierName) {
    const entry = lookups.by_carrier_composite_name[carrierName]
    if (entry) {
      return { charter: entry.charter, charter_code: entry.charter_code, naic: entry.naic, carrier_id: entry.carrier_id, parent: entry.parent }
    }
  }

  // 4c: Policy prefix match — sort by key length descending (longest match first)
  if (policyNumber) {
    const prefixes = Object.keys(lookups.by_policy_prefix)
      .filter(k => !k.startsWith('_'))
      .sort((a, b) => b.length - a.length)

    for (const prefix of prefixes) {
      if (policyNumber.toUpperCase().startsWith(prefix.toUpperCase())) {
        const entry = lookups.by_policy_prefix[prefix]
        return { charter: entry.charter, charter_code: entry.charter_code, naic: entry.naic, carrier_id: entry.carrier_id, parent: entry.parent }
      }
    }
  }

  return null
}

// ============================================================================
// Policy prefix → charter patterns (for multi-charter carriers)
// ============================================================================

interface PrefixRule {
  pattern: RegExp
  charter: string
  charter_code: string
  naic?: number
  carrier_id: string
  parent: string
}

const POLICY_PREFIX_RULES: PrefixRule[] = [
  // Aetna charters (from commission file analysis)
  { pattern: /^CLI/i, charter: 'Continental Life Insurance Company', charter_code: 'CLI', carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^0?AAHC/i, charter: 'Aetna Health Insurance Company', charter_code: 'AHIC', carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^AHC/i, charter: 'Aetna Health Insurance Company', charter_code: 'AHIC', carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^0?AACC/i, charter: 'Accendo Insurance Company', charter_code: 'ACC', naic: 63444, carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^TER/i, charter: 'Aflac TierOne', charter_code: 'TierOne', carrier_id: 'aflac', parent: 'Aflac' },

  // Wellabe/Medico charters (policy number prefix patterns)
  { pattern: /^000M1M/i, charter: 'Medico Insurance Company', charter_code: 'M1', carrier_id: 'wellabe-medico', parent: 'Wellabe' },
  { pattern: /^000M1D/i, charter: 'Medico Insurance Company', charter_code: 'M1', carrier_id: 'wellabe-medico', parent: 'Wellabe' },
  { pattern: /^000M1I/i, charter: 'Medico Insurance Company', charter_code: 'M1', carrier_id: 'wellabe-medico', parent: 'Wellabe' },
  { pattern: /^000MLM/i, charter: 'Medico Life and Health Insurance Company', charter_code: 'ML', carrier_id: 'wellabe-medico', parent: 'Wellabe' },
  { pattern: /^000MCM/i, charter: 'Medico Insurance Company', charter_code: 'M1', carrier_id: 'wellabe-medico', parent: 'Wellabe' },

  // Aetna MAPD — CMS contract patterns
  { pattern: /^NG/i, charter: 'Aetna Medicare Premier (HMO-POS)', charter_code: 'AHIC', carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^CVGA/i, charter: 'Aetna PDP', charter_code: 'AHIC', carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^GA\d/i, charter: 'Aetna PDP', charter_code: 'AHIC', carrier_id: 'aetna-cvs', parent: 'Aetna' },
  { pattern: /^G[257][A-Z]/i, charter: 'Aetna PDP', charter_code: 'AHIC', carrier_id: 'aetna-cvs', parent: 'Aetna' },

  // Humana PDP — H-prefix
  { pattern: /^H\d{8,}/i, charter: 'Humana Insurance Company', charter_code: 'HIC', naic: 73288, carrier_id: 'humana', parent: 'Humana' },

  // SilverScript
  { pattern: /^S5601/i, charter: 'SilverScript Insurance Company', charter_code: 'SS', carrier_id: 'silverscript', parent: 'SilverScript' },
]

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID })
  const db = getFirestore()

  console.log(`\n=== Medicare Charter Backfill ${DRY_RUN ? '(DRY RUN)' : '(EXECUTE MODE)'} ===\n`)

  // Query all Medicare accounts via collection group
  const snap = await db.collectionGroup('accounts').get()
  console.log(`Total accounts in Firestore: ${snap.size}`)

  const medicareAccounts = snap.docs.filter(d => {
    const data = d.data()
    const cat = (data.account_type_category || '').toLowerCase()
    const pt = (data.product_type || '').toLowerCase()
    return cat === 'medicare' || pt.includes('medicare') || pt.includes('mapd') || pt.includes('pdp') || pt.includes('supplement')
  })

  console.log(`Medicare accounts found: ${medicareAccounts.length}`)

  // Load BoB lookup JSON for Strategy 4
  const bobLookups = loadBoBLookups()
  const bobPrefixCount = Object.keys(bobLookups.by_policy_prefix).filter(k => !k.startsWith('_')).length
  const bobContractCount = Object.keys(bobLookups.by_cms_contract).filter(k => !k.startsWith('_')).length
  const bobCompositeCount = Object.keys(bobLookups.by_carrier_composite_name).filter(k => !k.startsWith('_')).length
  console.log(`BoB lookups loaded: ${bobPrefixCount} policy prefixes, ${bobContractCount} CMS contracts, ${bobCompositeCount} composite names`)

  let updated = 0
  let alreadyHasCharter = 0
  let resolvedByName = 0
  let resolvedByPrefix = 0
  let resolvedBySingleCharter = 0
  let resolvedByBoBLookup = 0
  let unresolved = 0
  let errors = 0

  const batch: { ref: FirebaseFirestore.DocumentReference; update: Record<string, unknown> }[] = []

  for (const doc of medicareAccounts) {
    const data = doc.data()
    const carrierName = data.carrier_name || data.carrier || ''
    const policyNumber = data.policy_number || ''

    // Skip if charter already populated
    if (data.carrier_charter || data.charter) {
      alreadyHasCharter++
      continue
    }

    let resolved: { charter: string; charter_code: string; naic?: number; carrier_id: string; parent: string } | null = null

    // Strategy 1: Direct charter resolution from carrier name
    const charterMatch = resolveCharterIdentity(carrierName)
    if (charterMatch) {
      resolved = { charter: charterMatch.charter, charter_code: charterMatch.charter_code, naic: charterMatch.naic, carrier_id: charterMatch.carrier_id, parent: charterMatch.parent }
      resolvedByName++
    }

    // Strategy 2: Policy number prefix patterns
    if (!resolved && policyNumber) {
      for (const rule of POLICY_PREFIX_RULES) {
        if (rule.pattern.test(policyNumber)) {
          resolved = { charter: rule.charter, charter_code: rule.charter_code, naic: rule.naic, carrier_id: rule.carrier_id, parent: rule.parent }
          resolvedByPrefix++
          break
        }
      }
    }

    // Strategy 3: Single-charter parent auto-assign
    if (!resolved) {
      const parentName = data.parent_carrier || data.carrier_name || data.carrier || ''
      const full = normalizeCarrierFull(parentName)
      if (full.charter) {
        resolved = { charter: full.charter, charter_code: full.charter_code!, naic: full.naic ?? undefined, carrier_id: full.carrier_id!, parent: full.carrier_name }
        resolvedBySingleCharter++
      }
    }

    // Strategy 4: BoB lookup JSON cross-reference (TRK-13338)
    if (!resolved) {
      const bobMatch = resolveFromBoBLookup(policyNumber, carrierName, bobLookups)
      if (bobMatch) {
        resolved = bobMatch
        resolvedByBoBLookup++
      }
    }

    if (!resolved) {
      unresolved++
      if (!DRY_RUN) {
        // Log unresolved for manual review (no PHI — just carrier + policy prefix)
        const prefix = policyNumber ? policyNumber.substring(0, 6) : '(none)'
        console.log(`  UNRESOLVED: carrier="${carrierName}" policy_prefix="${prefix}" path=${doc.ref.path}`)
      }
      continue
    }

    const updateData: Record<string, unknown> = {
      carrier_charter: resolved.charter,
      charter_code: resolved.charter_code,
      carrier_id: resolved.carrier_id,
    }
    if (resolved.naic) updateData.naic_code = String(resolved.naic)
    if (resolved.parent && !data.parent_carrier) updateData.parent_carrier = resolved.parent

    batch.push({ ref: doc.ref, update: updateData })
    updated++
  }

  console.log(`\n--- Resolution Summary ---`)
  console.log(`  Already has charter:       ${alreadyHasCharter}`)
  console.log(`  Resolved by name:          ${resolvedByName}`)
  console.log(`  Resolved by policy prefix: ${resolvedByPrefix}`)
  console.log(`  Resolved by single-charter:${resolvedBySingleCharter}`)
  console.log(`  Resolved by BoB lookup:    ${resolvedByBoBLookup}`)
  console.log(`  Unresolved:                ${unresolved}`)
  console.log(`  Total to update:           ${updated}`)

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
