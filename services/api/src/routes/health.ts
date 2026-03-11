import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore'

export const healthRoutes = Router()

healthRoutes.get('/', async (_req, res) => {
  try {
    // Quick Firestore connectivity check
    const db = getFirestore()
    const snap = await db.collection('clients').limit(1).get()
    const firestoreOk = !snap.empty || snap.empty // both mean connected

    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'tomachina-api',
        version: '0.4.0',
        timestamp: new Date().toISOString(),
        firestore: firestoreOk ? 'connected' : 'error',
      },
    })
  } catch (err) {
    res.json({
      success: true,
      data: {
        status: 'degraded',
        service: 'tomachina-api',
        version: '0.4.0',
        timestamp: new Date().toISOString(),
        firestore: 'error',
        error: String(err),
      },
    })
  }
})
