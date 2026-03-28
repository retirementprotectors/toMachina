import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SPRINT_DOC_ID = 'C0h0Ylibz7724v9c4A5d'
const PLAN_LINK = 'https://retirementprotectors.github.io/toMachina/mdj-alpha-plan.html'
const NOW = new Date().toISOString()

async function run() {
  console.log('Starting MDJ plan link + planned status update...\n')

  // --- Step 1: Verify sprint doc exists ---
  const sprintRef = db.collection('sprints').doc(SPRINT_DOC_ID)
  const sprintSnap = await sprintRef.get()
  if (!sprintSnap.exists) {
    throw new Error(`Sprint doc ${SPRINT_DOC_ID} not found in 'sprints' collection`)
  }
  console.log(`Sprint found: ${sprintSnap.data()?.name ?? SPRINT_DOC_ID}`)

  // --- Step 2: Fetch all tracker items for this sprint ---
  const itemsSnap = await db
    .collection('tracker_items')
    .where('sprint_id', '==', SPRINT_DOC_ID)
    .get()

  console.log(`Found ${itemsSnap.docs.length} tracker items\n`)

  // --- Step 3: Batch update all tracker items ---
  const batch = db.batch()
  let updatedCount = 0

  for (const doc of itemsSnap.docs) {
    const data = doc.data()
    const trkId: string = (data.item_id as string) ?? doc.id

    batch.update(doc.ref, {
      status: 'planned',
      updated_at: NOW,
    })

    console.log(`  ${trkId} — status → planned`)
    updatedCount++
  }

  // --- Step 4: Update the sprint doc ---
  batch.update(sprintRef, {
    plan_link: PLAN_LINK,
    phase: 'planned',
    updated_at: NOW,
  })
  console.log(`\n  Sprint ${SPRINT_DOC_ID} — plan_link set, phase → planned`)

  // --- Step 5: Commit ---
  await batch.commit()

  console.log(`\nDone. ${updatedCount} tracker items updated + sprint doc updated.`)
  console.log(`Plan link: ${PLAN_LINK}`)
  console.log(`Timestamp: ${NOW}`)
}

run().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
