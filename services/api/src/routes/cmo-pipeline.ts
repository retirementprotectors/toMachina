/**
 * CMO Pipeline Status API Routes (MUS-O10)
 *
 * Read endpoints for pipeline job status:
 *   GET /pipeline/active   — queued/running jobs
 *   GET /pipeline/history  — completed/partial/failed jobs (paginated)
 *   GET /pipeline/:briefId — single job by ID
 *
 * Route ordering: /active and /history MUST be registered before /:briefId
 * to avoid Express treating "active" as a briefId param.
 */
import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'

export const cmoPipelineRoutes = Router()

const CMO_PIPELINE_COL = 'cmo_pipeline_jobs'

/* ─── Firestore helpers (bracket notation for hookify) ─── */
function pipelineCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](CMO_PIPELINE_COL)
}

// ─── GET /pipeline/active ─────────────────────────────────────────────────

cmoPipelineRoutes.get('/pipeline/active', async (_req: Request, res: Response) => {
  try {
    const col = pipelineCol()
    const snapshot = await col
      .where('status', 'in', ['queued', 'running'])
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const jobs = snapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }))

    res.json(successResponse(jobs))
  } catch (err) {
    console.error('[MUSASHI] Pipeline active error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})

// ─── GET /pipeline/history ─────────────────────────────────────────────────

cmoPipelineRoutes.get('/pipeline/history', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit

    const col = pipelineCol()
    const snapshot = await col
      .where('status', 'in', ['complete', 'partial', 'failed'])
      .orderBy('completedAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get()

    const jobs = snapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Get total count for pagination
    const countSnapshot = await col
      .where('status', 'in', ['complete', 'partial', 'failed'])
      .count()
      .get()
    const total = countSnapshot.data().count

    res.json(successResponse(jobs, { meta: { total, page, limit } }))
  } catch (err) {
    console.error('[MUSASHI] Pipeline history error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})

// ─── GET /pipeline/:briefId ─────────────────────────────────────────────────
// MUST come after /active and /history routes

cmoPipelineRoutes.get('/pipeline/:briefId', async (req: Request, res: Response) => {
  try {
    const { briefId } = req.params
    const col = pipelineCol()
    const doc = await col.doc(briefId).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse(`Pipeline job not found: ${briefId}`))
      return
    }

    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('[MUSASHI] Pipeline status error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})
