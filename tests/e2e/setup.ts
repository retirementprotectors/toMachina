/**
 * Global setup for E2E backend pipeline tests.
 * Initializes Firebase Admin, validates test client exists, verifies auth.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { TEST_CLIENT_ID, FIREBASE_API_KEY } from './helpers/constants.js'

export async function setup() {
  // Initialize Firebase Admin (uses ADC in CI, gcloud auth locally)
  if (getApps().length === 0) {
    initializeApp({ projectId: 'claude-mcp-484718' })
  }

  const db = getFirestore()

  // Verify test client exists
  const clientDoc = await db.collection('clients').doc(TEST_CLIENT_ID).get()
  if (!clientDoc.exists) {
    console.warn(
      `[e2e setup] Test client ${TEST_CLIENT_ID} not found in Firestore. ` +
      `Drive/API-dependent tests will skip. Run seed script to enable:\n` +
      `  npx tsx tests/e2e/scripts/seed-test-client.ts`
    )
  }

  // Verify Firebase API key is available
  if (!FIREBASE_API_KEY) {
    console.warn(
      '[e2e setup] FIREBASE_API_KEY not set — API-dependent tests will skip'
    )
  }

  console.log('[e2e setup] Firebase Admin initialized')
}

export async function teardown() {
  // Final cleanup sweep — catch any orphaned test data
  try {
    if (getApps().length === 0) return

    const db = getFirestore()

    // Clean up test queue entries (simple query — no composite index needed)
    const queueSnap = await db.collection('intake_queue')
      .where('client_id', '==', TEST_CLIENT_ID)
      .get()

    const testEntries = queueSnap.docs.filter(d => {
      const data = d.data()
      return (data.file_name as string || '').startsWith('e2e-test-')
    })

    if (testEntries.length > 0) {
      const batch = db.batch()
      for (const doc of testEntries) {
        batch.delete(doc.ref)
      }
      await batch.commit()
      console.log(`[e2e teardown] Cleaned ${testEntries.length} orphaned queue entries`)
    }
  } catch (err) {
    console.warn('[e2e teardown] Cleanup warning:', err)
  }
}
