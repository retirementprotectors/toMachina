/**
 * Seed MDJ specialist configs to Firestore.
 *
 * Seeds 6 specialist configurations to the `mdj_specialist_configs` collection.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-mdj-specialists.ts
 *   npx tsx services/api/src/scripts/seed-mdj-specialists.ts --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const DRY_RUN = process.argv.includes('--dry-run')

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SPECIALISTS = [
  {
    id: 'mdj-medicare',
    specialist_name: 'MDJ Medicare',
    display_name: 'Medicare Specialist',
    icon: 'health_and_safety',
    routing_keywords: ['medicare', 'mapd', 'aep', 'oep', 'irmaa', 'supplement', 'medigap', 'part d', 'formulary', 'enrollment', 't65', 'turning 65', 'coverage gap', 'donut hole', 'advantage plan'],
    required_level: 1,
    system_prompt: 'PLACEHOLDER — Full prompt will be written in specialist mode config.',
    available_tools: [],
    status: 'active',
  },
  {
    id: 'mdj-annuity',
    specialist_name: 'MDJ Annuity',
    display_name: 'Annuity Specialist',
    icon: 'savings',
    routing_keywords: ['annuity', 'fia', 'myga', 'fixed index', 'income rider', '1035', 'exchange', 'surrender', 'accumulation', 'guaranteed income', 'death benefit', 'living benefit', 'gmib', 'gmwb'],
    required_level: 1,
    system_prompt: 'PLACEHOLDER — Full prompt will be written in specialist mode config.',
    available_tools: [],
    status: 'active',
  },
  {
    id: 'mdj-life-estate',
    specialist_name: 'MDJ Life/Estate',
    display_name: 'Life & Estate Specialist',
    icon: 'family_restroom',
    routing_keywords: ['life insurance', 'term', 'whole life', 'universal life', 'estate', 'beneficiary', 'death benefit', 'estate planning', 'trust', 'inheritance', 'iul', 'burial', 'final expense'],
    required_level: 1,
    system_prompt: 'PLACEHOLDER — Full prompt will be written in specialist mode config.',
    available_tools: [],
    status: 'active',
  },
  {
    id: 'mdj-investment',
    specialist_name: 'MDJ Investment',
    display_name: 'Investment Specialist',
    icon: 'trending_up',
    routing_keywords: ['investment', 'portfolio', 'rmd', 'ria', 'broker dealer', 'schwab', 'rbc', 'tax harvest', 'roth', 'conversion', 'ira', '401k', 'rollover', 'mutual fund', 'advisory', 'securities', 'stock', 'bond'],
    required_level: 1,
    system_prompt: 'PLACEHOLDER — Full prompt will be written in specialist mode config.',
    available_tools: [],
    status: 'active',
  },
  {
    id: 'mdj-legacy-ltc',
    specialist_name: 'MDJ Legacy/LTC',
    display_name: 'Legacy & LTC Specialist',
    icon: 'elderly',
    routing_keywords: ['ltc', 'long term care', 'long-term care', 'legacy', 'hybrid', 'chronic illness', 'nursing home', 'assisted living', 'care planning', 'aprille'],
    required_level: 1,
    system_prompt: 'PLACEHOLDER — Full prompt will be written in specialist mode config.',
    available_tools: [],
    status: 'active',
  },
]

async function main() {
  console.log(`Seeding ${SPECIALISTS.length} MDJ specialist configs${DRY_RUN ? ' (DRY RUN)' : ''}...`)

  const batch = db.batch()
  const now = new Date().toISOString()

  for (const spec of SPECIALISTS) {
    const ref = db.collection('mdj_specialist_configs').doc(spec.id)
    const data = {
      ...spec,
      created_at: now,
      updated_at: now,
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] Would write: ${spec.id} — ${spec.display_name}`)
    } else {
      batch.set(ref, data)
    }
  }

  if (!DRY_RUN) {
    await batch.commit()
    console.log(`Done. ${SPECIALISTS.length} specialist configs seeded to mdj_specialist_configs.`)
  } else {
    console.log('Dry run complete. No writes made.')
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
