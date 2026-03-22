/**
 * TRK-087: Find + merge Steve Abernathey duplicate clients
 *
 * Steps:
 *   1. Find all Active clients named Steve/Steven Abernathey
 *   2. If duplicates found, merge: keep oldest (by created_at), mark others as merged
 *   3. Transfer subcollections (accounts, access_items, communications) to winner
 *   4. Set loser.client_status = 'merged', loser._merged_into = winner._id
 *
 * Run: cd ~/Projects/toMachina && npx tsx services/api/src/scripts/data-clean-087-steve-dup.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

async function transferSubcollection(
  fromClientId: string,
  toClientId: string,
  subcollection: string
): Promise<number> {
  const snap = await db.collection('clients').doc(fromClientId).collection(subcollection).get()
  if (snap.empty) return 0

  const batch = db.batch()
  for (const doc of snap.docs) {
    const targetRef = db.collection('clients').doc(toClientId).collection(subcollection).doc(doc.id)
    batch.set(targetRef, { ...doc.data(), _merged_from: fromClientId })
    batch.delete(doc.ref)
  }
  await batch.commit()
  return snap.size
}

async function run() {
  console.log('TRK-087: Steve Abernathey duplicate merge\n')

  // Step 1: Find all clients with last_name Abernathey
  const snap = await db.collection('clients')
    .where('last_name', '==', 'Abernathey')
    .get()

  const steves = snap.docs.filter((d) => {
    const first = String(d.data().first_name || '').toLowerCase()
    return first === 'steve' || first === 'steven'
  })

  console.log(`Found ${steves.length} Steve Abernathey records:`)
  for (const doc of steves) {
    const d = doc.data()
    console.log(`  ${doc.id} — status: ${d.client_status}, created: ${d.created_at || 'unknown'}`)
  }

  if (steves.length < 2) {
    console.log('\n⚠ No duplicates to merge (less than 2 records)')
    return
  }

  // Step 2: Pick winner (oldest created_at, or first Active)
  const sorted = [...steves].sort((a, b) => {
    const aDate = String(a.data().created_at || '9999')
    const bDate = String(b.data().created_at || '9999')
    return aDate.localeCompare(bDate)
  })

  const winner = sorted[0]
  const losers = sorted.slice(1)

  console.log(`\nWinner: ${winner.id}`)
  console.log(`Losers: ${losers.map((l) => l.id).join(', ')}`)

  // Step 3: Transfer subcollections from losers to winner
  for (const loser of losers) {
    console.log(`\nMerging ${loser.id} → ${winner.id}:`)

    for (const subcol of ['accounts', 'access_items', 'communications']) {
      const count = await transferSubcollection(loser.id, winner.id, subcol)
      if (count > 0) console.log(`  Transferred ${count} ${subcol} docs`)
    }

    // Step 4: Mark loser as merged
    await db.collection('clients').doc(loser.id).update({
      client_status: 'merged',
      _merged_into: winner.id,
      updated_at: new Date().toISOString(),
    })
    console.log(`  Marked ${loser.id} as merged → ${winner.id}`)
  }

  // Verify
  const verifySnap = await db.collection('clients')
    .where('last_name', '==', 'Abernathey')
    .get()

  const activeSteves = verifySnap.docs.filter((d) => {
    const first = String(d.data().first_name || '').toLowerCase()
    const status = String(d.data().client_status || '').toLowerCase()
    return (first === 'steve' || first === 'steven') && status !== 'merged'
  })

  console.log(`\nVerification: ${activeSteves.length} non-merged Steve Abernathey (should be 1)`)

  if (activeSteves.length === 1) {
    console.log('\n✅ TRK-087 COMPLETE — one Steve Abernathey, duplicates merged')
  } else {
    console.log('\n❌ TRK-087 INCOMPLETE — check results above')
  }
}

run().catch(console.error)
