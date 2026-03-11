#!/usr/bin/env npx tsx
/**
 * seed-leadership.ts — Initialize leadership data in Firestore.
 *
 * Creates roadmap entries for each division leader and placeholder milestones.
 *
 * Usage:
 *   npx tsx scripts/seed-leadership.ts
 *   npx tsx scripts/seed-leadership.ts --dry-run
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

const db = getFirestore()

const LEADERS = [
  {
    owner_email: 'matt@retireprotected.com',
    owner_name: 'Matt McCormick',
    division: 'B2B',
    title: 'B2B/DAVID Division Roadmap — Q1 2026',
    description: 'M&A pipeline, partnership growth, SENTINEL portal depth',
    milestones: [
      { title: 'SENTINEL deal management CRUD', target_date: '2026-01-31', status: 'completed' },
      { title: 'DAVID HUB calculators live', target_date: '2026-02-28', status: 'completed' },
      { title: 'First acquisition via SENTINEL pipeline', target_date: '2026-03-31', status: 'on_track' },
    ],
  },
  {
    owner_email: 'nikki@retireprotected.com',
    owner_name: 'Nikki Gray',
    division: 'Service',
    title: 'Service Division Roadmap — Q1 2026',
    description: 'Service center depth, RMD/Beni workflows, team efficiency',
    milestones: [
      { title: 'RMD Center with IRS calc logic', target_date: '2026-01-31', status: 'completed' },
      { title: 'Beni Center beneficiary review workflow', target_date: '2026-02-28', status: 'completed' },
      { title: 'Casework delegation system live', target_date: '2026-03-31', status: 'on_track' },
    ],
  },
  {
    owner_email: 'vinnie@retireprotected.com',
    owner_name: 'Vinnie Vazquez',
    division: 'Sales',
    title: 'Sales Division Roadmap — Q1 2026',
    description: 'Medicare quoting, Discovery Kit, pipeline execution',
    milestones: [
      { title: 'Medicare quoting via CSG API', target_date: '2026-01-31', status: 'completed' },
      { title: 'Discovery Kit wizard live', target_date: '2026-02-28', status: 'completed' },
      { title: 'Life/Annuity quoting integrations', target_date: '2026-03-31', status: 'at_risk' },
    ],
  },
  {
    owner_email: 'aprille@retireprotected.com',
    owner_name: 'Dr. Aprille Trupiano',
    division: 'Legacy',
    title: 'Legacy Services Roadmap — Q1 2026',
    description: 'Estate planning, legacy integration, client experience',
    milestones: [
      { title: 'Legacy services section in ProDashX', target_date: '2026-02-15', status: 'completed' },
      { title: 'Estate planning document workflow', target_date: '2026-03-15', status: 'on_track' },
      { title: 'Legacy client intake pipeline', target_date: '2026-03-31', status: 'on_track' },
    ],
  },
  {
    owner_email: 'jason@retireprotected.com',
    owner_name: 'Jason Moran',
    division: 'Tech',
    title: 'Technology Roadmap — Q1 2026',
    description: 'Platform migration, GAS retirement, Cloud Run infrastructure',
    milestones: [
      { title: 'toMachina monorepo scaffold', target_date: '2026-01-15', status: 'completed' },
      { title: 'Firestore migration (29K docs)', target_date: '2026-02-15', status: 'completed' },
      { title: 'GAS engine migration (6 engines archived)', target_date: '2026-03-15', status: 'completed' },
      { title: 'Cloud Run API + BigQuery streaming live', target_date: '2026-03-31', status: 'on_track' },
    ],
  },
]

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`Leadership Seed ${dryRun ? '(DRY RUN)' : ''}`)
  console.log('─'.repeat(60))

  for (const leader of LEADERS) {
    const roadmapId = randomUUID()
    const now = new Date().toISOString()

    // Try to find roadmap_doc_id from users collection
    let googleDocId: string | null = null
    if (!dryRun) {
      const userSnap = await db.collection('users')
        .where('email', '==', leader.owner_email)
        .limit(1)
        .get()
      if (!userSnap.empty) {
        const profile = userSnap.docs[0].data().employee_profile as Record<string, unknown> | undefined
        googleDocId = (profile?.roadmap_doc_id as string) || null
      }
    }

    const roadmap = {
      roadmap_id: roadmapId,
      owner_email: leader.owner_email,
      owner_name: leader.owner_name,
      division: leader.division,
      title: leader.title,
      description: leader.description,
      milestones: leader.milestones.map(ms => ({
        id: randomUUID(),
        title: ms.title,
        target_date: ms.target_date,
        status: ms.status,
        notes: '',
        completed_date: ms.status === 'completed' ? ms.target_date : null,
      })),
      status: leader.milestones.some(m => m.status === 'at_risk') ? 'at_risk'
        : leader.milestones.some(m => m.status === 'behind') ? 'behind'
        : leader.milestones.every(m => m.status === 'completed') ? 'completed'
        : 'on_track',
      google_doc_id: googleDocId,
      last_updated: now,
      created_at: now,
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would create roadmap: ${leader.owner_name} (${leader.division})`)
      console.log(`  Title: ${leader.title}`)
      console.log(`  Status: ${roadmap.status}`)
      console.log(`  Milestones: ${leader.milestones.length}`)
      console.log()
    } else {
      await db.collection('leadership_roadmaps').doc(roadmapId).set(roadmap)
      console.log(`Created: ${leader.owner_name} (${leader.division}) — ${roadmap.status}`)
    }
  }

  console.log('─'.repeat(60))
  console.log(`${dryRun ? 'Would seed' : 'Seeded'} ${LEADERS.length} leadership roadmaps`)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
