/**
 * migrate-voltron-registry-domains.ts
 *
 * Adds a `domain` field to every voltron_registry entry.
 *
 * Domains: medicare | annuity | investment | life-estate | legacy-ltc | general
 * Classification is keyword-based on tool_id + name + description.
 * Idempotent: skips already-tagged entries unless --force is passed.
 *
 * Run with --dry-run to preview. Run with --snapshot for production execution.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { VoltronLionDomain } from '@tomachina/core'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE   = process.argv.includes('--force')

// ── Classification tables ────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<VoltronLionDomain, string[]> = {
  medicare: [
    'mapd', 'medicare', 'formulary', 'npi', 'plan-comparison', 'plan_comparison',
    'provider', 'pharmacy', 'preventive', 'dme', 'enrollment', 't65', 'aep',
    'blue-button', 'blue_button', 'diagnosis', 'coverage', 'drug', 'deductible',
    'part-b', 'part_b', 'part-d', 'part_d', 'irmaa', 'snp', 'dsnp',
  ],
  annuity: [
    'annuity', 'fia', 'myga', 'surrender', 'rollover', '1035',
    'bonus-offset', 'bonus_offset', 'mva', 'mgsv', 'va-depletion', 'va_depletion',
    'fia-projection', 'fia_projection', 'carrier-product', 'carrier_product',
    'index-rate', 'index_rate', 'fyc',
  ],
  investment: [
    'rmd', 'portfolio', 'schwab', 'rbc', 'advisory', 'dst-vision', 'dst_vision',
    'roth', 'tax-harvest', 'tax_harvest', 'lot-selection', 'lot_selection',
    'breakeven-equity', 'breakeven_equity', 'growth', 'capital-gains', 'capital_gains', 'ltcg',
  ],
  'life-estate': [
    'life-insurance', 'life_insurance', 'estate', 'beneficiary', 'cof',
    'income-multiplier', 'income_multiplier', 'college-funding', 'college_funding',
    'net-outlay', 'net_outlay', 'lapse',
  ],
  'legacy-ltc': [
    'ltc', 'legacy', 'long-term-care', 'long_term_care', 'aprille', 'ltc-phase', 'ltc_phase',
  ],
  general: [],
}

// Domain priority order (first keyword match wins)
const DOMAIN_PRIORITY: VoltronLionDomain[] = [
  'medicare',
  'annuity',
  'investment',
  'life-estate',
  'legacy-ltc',
  'general',
]

function classifyEntry(tool_id: string, name: string, description: string): VoltronLionDomain {
  const haystack = `${tool_id} ${name} ${description}`.toLowerCase()
  for (const domain of DOMAIN_PRIORITY) {
    if (domain === 'general') break
    if (DOMAIN_KEYWORDS[domain].some((kw) => haystack.includes(kw))) return domain
  }
  return 'general'
}

// ── Migration ────────────────────────────────────────────────────────────────

type DomainStats = Record<VoltronLionDomain, number>

async function main() {
  console.log('\nVoltron Registry — Domain Tagging Migration')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : FORCE ? 'LIVE (force re-tag)' : 'LIVE (idempotent)'}`)
  console.log('─'.repeat(60))

  const snap = await db.collection('voltron_registry').get()
  console.log(`Total registry entries: ${snap.size}`)

  const stats: DomainStats = {
    medicare: 0,
    annuity: 0,
    investment: 0,
    'life-estate': 0,
    'legacy-ltc': 0,
    general: 0,
  }

  let skipped = 0
  let toUpdate = 0

  const batches: FirebaseFirestore.WriteBatch[] = []
  let currentBatch = db.batch()
  let batchOps = 0

  for (const doc of snap.docs) {
    const data = doc.data() as {
      tool_id: string
      name: string
      description: string
      domain?: string
    }

    // Idempotency: skip already-tagged docs unless --force
    if (data.domain && !FORCE) {
      skipped++
      continue
    }

    const domain = classifyEntry(
      data.tool_id ?? '',
      data.name ?? '',
      data.description ?? '',
    )

    stats[domain]++
    toUpdate++

    if (!DRY_RUN) {
      currentBatch.update(doc.ref, { domain })
      batchOps++
      if (batchOps >= 400) {
        batches.push(currentBatch)
        currentBatch = db.batch()
        batchOps = 0
      }
    }
  }

  if (batchOps > 0) batches.push(currentBatch)

  console.log(`\nClassification results (${toUpdate} to tag, ${skipped} already tagged):`)
  console.log(`  medicare    : ${stats.medicare}`)
  console.log(`  annuity     : ${stats.annuity}`)
  console.log(`  investment  : ${stats.investment}`)
  console.log(`  life-estate : ${stats['life-estate']}`)
  console.log(`  legacy-ltc  : ${stats['legacy-ltc']}`)
  console.log(`  general     : ${stats.general}  <- review these`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed. Remove --dry-run to execute.')
    process.exit(0)
  }

  if (batches.length === 0) {
    console.log('\nNothing to write — all entries already tagged.')
    process.exit(0)
  }

  console.log(`\nCommitting ${batches.length} batch(es)...`)
  for (let i = 0; i < batches.length; i++) {
    await batches[i]!.commit()
    console.log(`  Batch ${i + 1}/${batches.length} committed`)
  }

  console.log(`\nDone — ${toUpdate} entries tagged with domain field.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
