/**
 * TRK-086: Delete shaneparmenter@gmail.com user doc, remap client refs
 *
 * Steps:
 *   1. Find all clients where agent_id === 'shaneparmenter@gmail.com'
 *   2. Remap: set assigned_user_id to Shane's UUID (92fd3964-cef4-4771-9afe-53e4e0fe4e26)
 *   3. Delete users/shaneparmenter@gmail.com
 *   4. Verify
 *
 * Run: cd ~/Projects/toMachina && npx tsx services/api/src/scripts/data-clean-086-shane-dup.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SHANE_UUID = '92fd3964-cef4-4771-9afe-53e4e0fe4e26'
const STALE_EMAIL = 'shaneparmenter@gmail.com'

async function run() {
  console.log('TRK-086: Shane Parmenter duplicate cleanup\n')

  // Step 1: Find clients referencing the gmail address
  const clientsSnap = await db.collection('clients')
    .where('agent_id', '==', STALE_EMAIL)
    .get()

  console.log(`Found ${clientsSnap.size} clients with agent_id = '${STALE_EMAIL}'`)

  // Step 2: Remap those clients
  if (clientsSnap.size > 0) {
    const batch = db.batch()
    for (const doc of clientsSnap.docs) {
      const name = `${doc.data().first_name || ''} ${doc.data().last_name || ''}`.trim()
      console.log(`  Remapping: ${name} (${doc.id})`)
      batch.update(doc.ref, {
        assigned_user_id: SHANE_UUID,
        updated_at: new Date().toISOString(),
      })
    }
    await batch.commit()
    console.log(`  ✓ Remapped ${clientsSnap.size} clients to UUID ${SHANE_UUID}`)
  }

  // Also check for assigned_user_id referencing the email (belt & suspenders)
  const clientsByAssigned = await db.collection('clients')
    .where('assigned_user_id', '==', STALE_EMAIL)
    .get()

  if (clientsByAssigned.size > 0) {
    const batch = db.batch()
    for (const doc of clientsByAssigned.docs) {
      console.log(`  Fixing assigned_user_id on: ${doc.id}`)
      batch.update(doc.ref, {
        assigned_user_id: SHANE_UUID,
        updated_at: new Date().toISOString(),
      })
    }
    await batch.commit()
    console.log(`  ✓ Fixed ${clientsByAssigned.size} clients with assigned_user_id = email`)
  }

  // Step 3: Delete stale user doc
  const staleDoc = db.collection('users').doc(STALE_EMAIL)
  const staleSnap = await staleDoc.get()
  if (staleSnap.exists) {
    await staleDoc.delete()
    console.log(`  ✓ Deleted users/${STALE_EMAIL}`)
  } else {
    console.log(`  ⚠ users/${STALE_EMAIL} already deleted`)
  }

  // Step 4: Verify
  const verifyAgent = await db.collection('clients').where('agent_id', '==', STALE_EMAIL).get()
  const verifyAssigned = await db.collection('clients').where('assigned_user_id', '==', STALE_EMAIL).get()
  const verifyUser = await db.collection('users').doc(STALE_EMAIL).get()

  console.log('\nVerification:')
  console.log(`  Clients with agent_id = '${STALE_EMAIL}': ${verifyAgent.size} (should be 0)`)
  console.log(`  Clients with assigned_user_id = '${STALE_EMAIL}': ${verifyAssigned.size} (should be 0)`)
  console.log(`  users/${STALE_EMAIL} exists: ${verifyUser.exists} (should be false)`)

  const shaneDoc = await db.collection('users').doc('shane@retireprotected.com').get()
  console.log(`  users/shane@retireprotected.com exists: ${shaneDoc.exists} (should be true)`)

  if (verifyAgent.size === 0 && verifyAssigned.size === 0 && !verifyUser.exists && shaneDoc.exists) {
    console.log('\n✅ TRK-086 COMPLETE — Shane appears once, all refs cleaned')
  } else {
    console.log('\n❌ TRK-086 INCOMPLETE — check verification above')
  }
}

run().catch(console.error)
