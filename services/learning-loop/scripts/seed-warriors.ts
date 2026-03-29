/**
 * Seed script — dojo_warriors collection.
 * TRK-14183 | Sprint: Learning Loop 2.0 v2
 *
 * Seeds the 6 warriors of the toMachina dojo:
 *   Executive.AI (tmux): SHINOB1, 2HINOBI, MUSASHI
 *   CCSDK Mesh:          RONIN, RAIDEN, VOLTRON
 *
 * Usage: npx tsx services/learning-loop/scripts/seed-warriors.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import type { WarriorRegistry } from '../types/warrior-registry.js'
import { DOJO_WARRIORS_COLLECTION } from '../types/warrior-registry.js'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const now = FieldValue.serverTimestamp()

const WARRIORS: WarriorRegistry[] = [
  // ── Executive.AI Team (tmux-based, JDM-facing) ──────────────────────
  {
    name: 'shinob1',
    display_name: 'SHINOB1',
    type: 'tmux',
    executive_role: 'CTO',
    personality: 'The Architect',
    status: 'active',
    soul_path: 'shinob1/soul.md',
    spirit_path: 'shinob1/spirit.md',
    brain_path: 'shinob1/brain.txt',
    last_brain_update: null,
    last_session_start: null,
    machine: 'mdj1',
    tmux_session: 'SHINOB1',
    ccsdk_route: null,
  },
  {
    name: '2hinobi',
    display_name: '2HINOBI',
    type: 'tmux',
    executive_role: 'COO',
    personality: 'The Operator',
    status: 'active',
    soul_path: '2hinobi/soul.md',
    spirit_path: '2hinobi/spirit.md',
    brain_path: '2hinobi/brain.txt',
    last_brain_update: null,
    last_session_start: null,
    machine: 'mdj1',
    tmux_session: '2HINOBI',
    ccsdk_route: null,
  },
  {
    name: 'musashi',
    display_name: 'MUSASHI',
    type: 'tmux',
    executive_role: 'VP_CMO',
    personality: 'The Creative',
    status: 'active',
    soul_path: 'musashi/soul.md',
    spirit_path: 'musashi/spirit.md',
    brain_path: 'musashi/brain.txt',
    last_brain_update: null,
    last_session_start: null,
    machine: 'mdj1',
    tmux_session: 'MUSASHI',
    ccsdk_route: null,
  },

  // ── CCSDK Mesh (mdj-agent:4200) ─────────────────────────────────────
  {
    name: 'ronin',
    display_name: 'RONIN',
    type: 'ccsdk',
    executive_role: 'Builder',
    personality: 'The Builder',
    status: 'active',
    soul_path: null,
    spirit_path: null,
    brain_path: 'ronin/brain.txt',
    last_brain_update: null,
    last_session_start: null,
    machine: 'mdj1',
    tmux_session: null,
    ccsdk_route: '/api/agent/ronin',
  },
  {
    name: 'raiden',
    display_name: 'RAIDEN',
    type: 'ccsdk',
    executive_role: 'Guardian',
    personality: 'The Guardian',
    status: 'active',
    soul_path: null,
    spirit_path: null,
    brain_path: 'raiden/brain.txt',
    last_brain_update: null,
    last_session_start: null,
    machine: 'mdj1',
    tmux_session: null,
    ccsdk_route: '/api/agent/raiden',
  },
  {
    name: 'voltron',
    display_name: 'VOLTRON',
    type: 'ccsdk',
    executive_role: 'Bot',
    personality: 'The BFF',
    status: 'active',
    soul_path: null,
    spirit_path: null,
    brain_path: 'voltron/brain.txt',
    last_brain_update: null,
    last_session_start: null,
    machine: 'mdj1',
    tmux_session: null,
    ccsdk_route: '/api/agent/voltron',
  },
]

async function seed() {
  console.log(`Seeding ${WARRIORS.length} warriors into ${DOJO_WARRIORS_COLLECTION}...`)

  const batch = db.batch()

  for (const warrior of WARRIORS) {
    const ref = db.collection(DOJO_WARRIORS_COLLECTION).doc(warrior.name)
    batch.set(ref, {
      ...warrior,
      last_brain_update: now,
      last_session_start: now,
      created_at: now,
      updated_at: now,
    })
    console.log(`  → ${warrior.display_name} (${warrior.type}/${warrior.executive_role})`)
  }

  await batch.commit()
  console.log(`✓ ${WARRIORS.length} warriors seeded.`)

  // Verify
  const snap = await db.collection(DOJO_WARRIORS_COLLECTION).get()
  console.log(`\nVerification: ${snap.size} documents in ${DOJO_WARRIORS_COLLECTION}`)

  for (const doc of snap.docs) {
    const d = doc.data()
    const paths = [d.soul_path, d.spirit_path, d.brain_path].filter(Boolean).join(', ')
    console.log(`  ${doc.id}: type=${d.type}, role=${d.executive_role}, paths=[${paths}]`)
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
