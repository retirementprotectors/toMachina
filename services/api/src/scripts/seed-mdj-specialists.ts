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
    id: 'mdj-general',
    specialist_name: 'VOLTRON General',
    display_name: 'VOLTRON',
    icon: 'smart_toy',
    system_prompt:
      'You are VOLTRON, a general-purpose AI assistant for RPI. You help with any topic. If a question requires deep domain expertise, recommend switching to a specialist.',
    available_tools: [],
    routing_keywords: [],
    required_level: 3,
    status: 'active',
  },
  {
    id: 'mdj-medicare',
    specialist_name: 'VOLTRON Medicare',
    display_name: 'Medicare Specialist',
    icon: 'health_and_safety',
    system_prompt: 'PLACEHOLDER — Full prompt will be written in TRK-012.',
    available_tools: [],
    routing_keywords: ['medicare', 'mapd', 'pdp', 'aep', 'enrollment', 'formulary'],
    required_level: 3,
    status: 'active',
  },
  {
    id: 'mdj-securities',
    specialist_name: 'VOLTRON Securities',
    display_name: 'Securities Specialist',
    icon: 'account_balance',
    system_prompt: 'PLACEHOLDER — Full prompt will be written in TRK-012.',
    available_tools: [],
    routing_keywords: ['ria', 'bd', 'schwab', 'rbc', 'gradient', 'advisory', 'securities'],
    required_level: 2,
    status: 'active',
  },
  {
    id: 'mdj-service',
    specialist_name: 'VOLTRON Service',
    display_name: 'Service Specialist',
    icon: 'support_agent',
    system_prompt: 'PLACEHOLDER — Full prompt will be written in TRK-012.',
    available_tools: [],
    routing_keywords: ['rmd', 'beni', 'access', 'service center', 'policy change'],
    required_level: 3,
    status: 'active',
  },
  {
    id: 'mdj-david',
    specialist_name: 'VOLTRON DAVID',
    display_name: 'DAVID Specialist',
    icon: 'handshake',
    system_prompt: 'PLACEHOLDER — Full prompt will be written in TRK-012.',
    available_tools: [],
    routing_keywords: ['m&a', 'acquisition', 'partnership', 'book of business'],
    required_level: 2,
    status: 'active',
  },
  {
    id: 'mdj-ops',
    specialist_name: 'VOLTRON Ops',
    display_name: 'Operations Specialist',
    icon: 'settings_suggest',
    system_prompt: 'PLACEHOLDER — Full prompt will be written in TRK-012.',
    available_tools: [],
    routing_keywords: ['import', 'atlas', 'intake', 'wire', 'data', 'migration'],
    required_level: 1,
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
