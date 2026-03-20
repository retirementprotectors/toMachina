import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore'

export const healthRoutes = Router()

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ])
}

healthRoutes.get('/', async (_req, res) => {
  try {
    // Firestore connectivity check with 5s timeout (not the default 300s)
    const db = getFirestore()
    await withTimeout(db.collection('clients').limit(1).get(), 5000)

    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'tomachina-api',
        version: '0.5.0',
        timestamp: new Date().toISOString(),
        firestore: 'connected',
      },
    })
  } catch (err) {
    // Return 503 so smoke test + load balancer know we're unhealthy
    res.status(503).json({
      success: false,
      data: {
        status: 'degraded',
        service: 'tomachina-api',
        version: '0.5.0',
        timestamp: new Date().toISOString(),
        firestore: 'error',
        error: String(err),
      },
    })
  }
})
