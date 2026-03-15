import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

interface RoadmapItem {
  title: string
  portal: string
  scope: string
  component: string
  sprint?: string
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  // Sprint 10: Production Polish + Wiring
  { title: 'Wire Communications Module to Twilio SMS', portal: 'SHARED', scope: 'Platform', component: 'Communications', sprint: 'Sprint 10' },
  { title: 'Wire Communications Module to Twilio Voice — 888 number', portal: 'SHARED', scope: 'Platform', component: 'Communications', sprint: 'Sprint 10' },
  { title: 'Wire Communications Module to email via Gmail API', portal: 'SHARED', scope: 'Platform', component: 'Communications', sprint: 'Sprint 10' },
  { title: 'Wire RPI Connect to Google Chat API', portal: 'SHARED', scope: 'Platform', component: 'RPI Connect', sprint: 'Sprint 10' },
  { title: 'Wire RPI Connect to Google Calendar API', portal: 'SHARED', scope: 'Platform', component: 'RPI Connect', sprint: 'Sprint 10' },
  { title: 'Wire RPI Connect to Google People API — profile photos', portal: 'SHARED', scope: 'Platform', component: 'RPI Connect', sprint: 'Sprint 10' },
  { title: 'Solve slide-out panel real estate problem', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', sprint: 'Sprint 10' },
  { title: 'Global search bar functionality', portal: 'SHARED', scope: 'Platform', component: 'Header', sprint: 'Sprint 10' },
  { title: 'Quick Intake paste processing', portal: 'PRODASHX', scope: 'Platform', component: 'Quick Intake', sprint: 'Sprint 10' },
  { title: 'Quick Intake upload processing', portal: 'PRODASHX', scope: 'Platform', component: 'Quick Intake', sprint: 'Sprint 10' },

  // Sprint 11: DEX Modernization
  { title: 'Migrate PDF form filling to Cloud Functions', portal: 'SHARED', scope: 'App', component: 'DEX', sprint: 'Sprint 11' },
  { title: 'Migrate Drive filing to Cloud Functions', portal: 'SHARED', scope: 'App', component: 'DEX', sprint: 'Sprint 11' },
  { title: 'Build DocuSign Node.js integration', portal: 'SHARED', scope: 'App', component: 'DEX', sprint: 'Sprint 11' },
  { title: 'Migrate form library to Firestore', portal: 'SHARED', scope: 'App', component: 'DEX', sprint: 'Sprint 11' },
  { title: 'Build document kit assembly Cloud Function', portal: 'SHARED', scope: 'App', component: 'DEX', sprint: 'Sprint 11' },
  { title: 'Archive GAS DEX engine', portal: 'SHARED', scope: 'App', component: 'DEX', sprint: 'Sprint 11' },

  // Sprint 12: DAVID M&A Platform
  { title: 'Acquisition toolkit — due diligence checklist', portal: 'SENTINEL', scope: 'Module', component: 'DAVID HUB', sprint: 'Sprint 12' },
  { title: 'Acquisition toolkit — data room', portal: 'SENTINEL', scope: 'Module', component: 'DAVID HUB', sprint: 'Sprint 12' },
  { title: 'Book valuation calculator enhancements', portal: 'SENTINEL', scope: 'Module', component: 'DAVID HUB', sprint: 'Sprint 12' },
  { title: 'Operating System skill pack distribution', portal: 'SHARED', scope: 'Platform', component: 'Platform', sprint: 'Sprint 12' },
  { title: 'Producer onboarding pipeline', portal: 'SENTINEL', scope: 'Module', component: 'Pipelines', sprint: 'Sprint 12' },
  { title: 'Book migration bulk import engine', portal: 'SENTINEL', scope: 'Module', component: 'DAVID HUB', sprint: 'Sprint 12' },
  { title: 'Client welcome campaign — We\'re Your People', portal: 'SHARED', scope: 'Module', component: 'C3', sprint: 'Sprint 12' },

  // Future: MyDropZone
  { title: 'Audio recording capture via browser MediaRecorder API', portal: 'SHARED', scope: 'Module', component: 'MyDropZone', sprint: 'Future' },
  { title: 'Document photo capture + upload to Drive', portal: 'SHARED', scope: 'Module', component: 'MyDropZone', sprint: 'Future' },
  { title: 'Claude Vision intelligence processing Cloud Function', portal: 'SHARED', scope: 'Module', component: 'MyDropZone', sprint: 'Future' },
  { title: 'Extracted data routing to approval pipeline', portal: 'SHARED', scope: 'Module', component: 'MyDropZone', sprint: 'Future' },
  { title: 'Agent status tracking UI', portal: 'SHARED', scope: 'Module', component: 'MyDropZone', sprint: 'Future' },

  // Future: Campaign Engine Full
  { title: 'Campaign send scheduling via Cloud Scheduler', portal: 'SHARED', scope: 'App', component: 'C3', sprint: 'Future' },
  { title: 'Audience segmentation engine', portal: 'SHARED', scope: 'App', component: 'C3', sprint: 'Future' },
  { title: 'A/B testing with variant templates', portal: 'SHARED', scope: 'App', component: 'C3', sprint: 'Future' },
  { title: 'Campaign analytics dashboard (open/click/delivery rates)', portal: 'SHARED', scope: 'App', component: 'C3', sprint: 'Future' },
  { title: 'AEP Blackout enforcement (Oct-Dec)', portal: 'SHARED', scope: 'App', component: 'C3', sprint: 'Future' },
  { title: 'Drip sequence builder (multi-touch campaigns)', portal: 'SHARED', scope: 'App', component: 'C3', sprint: 'Future' },
]

async function seed() {
  // Find the max existing TRK number
  const existing = await db.collection('tracker_items').orderBy('item_id', 'desc').limit(1).get()
  let nextNum = 1
  if (!existing.empty) {
    const lastId = (existing.docs[0].data().item_id || 'TRK-000') as string
    nextNum = parseInt(lastId.replace('TRK-', ''), 10) + 1
  }
  console.log(`Starting from TRK-${String(nextNum).padStart(3, '0')} (${ROADMAP_ITEMS.length} items to add)`)

  const now = new Date().toISOString()

  // Batch writes (500 max per batch, we have 34 items so one batch is fine)
  const batch = db.batch()
  for (const [i, item] of ROADMAP_ITEMS.entries()) {
    const num = nextNum + i
    const itemId = `TRK-${String(num).padStart(3, '0')}`
    const ref = db.collection('tracker_items').doc(itemId)
    batch.set(ref, {
      item_id: itemId,
      title: item.title,
      description: item.title,
      portal: item.portal,
      scope: item.scope,
      component: item.component,
      section: '',
      type: 'idea',
      status: 'not_touched',
      sprint_id: null,
      notes: 'Imported from Platform Roadmap',
      created_by: 'roadmap-import@retireprotected.com',
      created_at: now,
      updated_at: now,
    })
  }
  await batch.commit()

  const lastNum = nextNum + ROADMAP_ITEMS.length - 1
  console.log(`Seeded ${ROADMAP_ITEMS.length} roadmap items (TRK-${String(nextNum).padStart(3, '0')} through TRK-${String(lastNum).padStart(3, '0')})`)
}

seed().catch(console.error)
