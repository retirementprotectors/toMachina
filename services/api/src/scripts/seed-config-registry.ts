/**
 * Seed Config Registry — Populate Firestore config_registry from hardcoded values.
 *
 * TRK-CFG-015: Reads current constants from source files and writes them to
 * config_registry collection. Idempotent — skips existing docs to preserve admin edits.
 *
 * Run MANUALLY, ONCE, after first deploy:
 *   npx tsx services/api/src/scripts/seed-config-registry.ts           # Dry run
 *   npx tsx services/api/src/scripts/seed-config-registry.ts --commit  # Write to Firestore
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { EXCLUDED_ACCOUNT_STATUSES } from '@tomachina/core'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()
const COMMIT = process.argv.includes('--commit')
const COLLECTION = 'config_registry'

interface ConfigSeed {
  key: string
  type: string
  category: string
  data: Record<string, unknown>
}

const SEEDS: ConfigSeed[] = [
  // Tier 1 — Data Quality
  {
    key: 'dedup_thresholds',
    type: 'sliders',
    category: 'data_quality',
    data: { name_weight_last: 60, name_weight_first: 40, fuzzy_min: 75, duplicate_threshold: 85, email_exact_score: 100 },
  },
  {
    key: 'status_map',
    type: 'table',
    category: 'data_quality',
    data: {
      entries: [
        { raw: 'active', canonical: 'Active' }, { raw: 'act', canonical: 'Active' },
        { raw: 'inactive', canonical: 'Inactive' }, { raw: 'in', canonical: 'Inactive' },
        { raw: 'terminated', canonical: 'Terminated' }, { raw: 'term', canonical: 'Terminated' },
        { raw: 'lapsed', canonical: 'Lapsed' }, { raw: 'cancelled', canonical: 'Cancelled' },
        { raw: 'prospect', canonical: 'Prospect' }, { raw: 'pending', canonical: 'Pending' },
        { raw: 'merged', canonical: 'Merged' }, { raw: 'deleted', canonical: 'Deleted' },
      ],
    },
  },
  {
    key: 'carrier_aliases',
    type: 'table',
    category: 'data_quality',
    data: {
      entries: [
        { alias: 'aetna', canonical: 'Aetna' }, { alias: 'humana', canonical: 'Humana' },
        { alias: 'uhc', canonical: 'UnitedHealthcare' }, { alias: 'united healthcare', canonical: 'UnitedHealthcare' },
        { alias: 'mutual of omaha', canonical: 'Mutual of Omaha' }, { alias: 'cigna', canonical: 'Cigna' },
        { alias: 'anthem', canonical: 'Anthem' }, { alias: 'wellcare', canonical: 'WellCare' },
        { alias: 'devoted', canonical: 'Devoted Health' },
      ],
    },
  },
  {
    key: 'product_type_map',
    type: 'table',
    category: 'data_quality',
    data: {
      entries: [
        { raw: 'mapd', canonical: 'MAPD' }, { raw: 'medicare advantage', canonical: 'MAPD' },
        { raw: 'pdp', canonical: 'PDP' }, { raw: 'med supp', canonical: 'Med Supp' },
        { raw: 'medigap', canonical: 'Med Supp' }, { raw: 'term life', canonical: 'Term Life' },
        { raw: 'whole life', canonical: 'Whole Life' }, { raw: 'fia', canonical: 'FIA' },
        { raw: 'fixed index annuity', canonical: 'FIA' }, { raw: 'myga', canonical: 'MYGA' },
        { raw: 'iul', canonical: 'IUL' },
      ],
    },
  },
  // Note: carrier_charter_map has 220+ entries — seed from carrier-charter-map.ts at runtime
  // The full map is too large for inline seeding. Builder 2 made it configurable via getConfig fallback.

  // Tier 2 — Financial (seeded from DEFAULT_*_CONFIG constants in core)
  // These are large structured objects — the builders already set up DEFAULT_*_CONFIG exports.
  // The seed script for these should read from those exports at runtime.

  // Tier 3 — Operations
  {
    key: 'atlas_stages',
    type: 'stages',
    category: 'operations',
    data: {
      stages: [
        { key: 'intake', label: 'Intake', color: '#f59e0b', order: 1 },
        { key: 'extraction', label: 'Extraction', color: '#3b82f6', order: 2 },
        { key: 'approval', label: 'Approval', color: '#8b5cf6', order: 3 },
        { key: 'matrix', label: 'Matrix', color: '#06b6d4', order: 4 },
        { key: 'complete', label: 'Complete', color: '#22c55e', order: 5 },
        { key: 'error', label: 'Error', color: '#ef4444', order: 6 },
      ],
    },
  },
  {
    key: 'content_block_types',
    type: 'table',
    category: 'operations',
    data: {
      types: [
        { name: 'SubjectLine', prefix: 'SBJ' }, { name: 'Greeting', prefix: 'GRT' },
        { name: 'Intro', prefix: 'INT' }, { name: 'ValueProp', prefix: 'VAL' },
        { name: 'PainPoint', prefix: 'PAN' }, { name: 'CTA', prefix: 'CTA' },
        { name: 'Signature', prefix: 'SIG' }, { name: 'Compliance', prefix: 'CMP' },
        { name: 'VMScript', prefix: 'VMS' }, { name: 'SMSBody', prefix: 'SMS' },
        { name: 'PostCard', prefix: 'PCD' },
      ],
    },
  },
  {
    key: 'excluded_statuses',
    type: 'checklist',
    category: 'operations',
    data: { statuses: [...EXCLUDED_ACCOUNT_STATUSES] },
  },
  {
    key: 'rate_limits',
    type: 'numeric',
    category: 'operations',
    data: { requests_per_minute: 100 },
  },
]

async function main() {
  console.log(`Config Registry Seed ${COMMIT ? '(LIVE)' : '(DRY RUN)'}`)
  console.log(`Populating ${SEEDS.length} configs into ${COLLECTION}\n`)

  let seeded = 0
  let skipped = 0

  for (const seed of SEEDS) {
    const docRef = db.collection(COLLECTION).doc(seed.key)
    const existing = await docRef.get()

    if (existing.exists) {
      console.log(`  SKIP  ${seed.key} — already exists`)
      skipped++
      continue
    }

    const doc = {
      ...seed.data,
      type: seed.type,
      category: seed.category,
      _created_by: 'seed-script',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (COMMIT) {
      await docRef.set(doc)
      console.log(`  SEED  ${seed.key} — created (${seed.type}, ${seed.category})`)
    } else {
      console.log(`  WOULD ${seed.key} — ${seed.type}, ${seed.category}`)
    }
    seeded++
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Seeded: ${seeded}`)
  console.log(`  Skipped: ${skipped}`)
  if (!COMMIT) console.log(`\nDry run. Add --commit to write.`)
  process.exit(0)
}

main()
