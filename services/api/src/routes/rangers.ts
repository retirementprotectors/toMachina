// ---------------------------------------------------------------------------
// Ranger Orchestration API (ZRD-O08)
// ---------------------------------------------------------------------------
// REST API control plane for the Ranger mesh.
// Express router mounted at /api/rangers/* inside tm-api.
// Follows the same pattern as wire.ts and atlas.ts.
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, getPaginationParams, paginatedQuery } from '../lib/helpers.js'
import { getRanger, listRangers, isValidRanger } from '../rangers/registry.js'
import type { RangerDispatchInput, RangerRunDoc, RangerStatus } from '../rangers/types.js'

export const rangerRoutes = Router()

// ---------------------------------------------------------------------------
// POST /api/rangers/dispatch — Start a Ranger execution
// ---------------------------------------------------------------------------
rangerRoutes.post('/dispatch', async (req: Request, res: Response) => {
  try {
    const { rangerId, fileId, fileIds, mode, targetCategory, clientId, params } = req.body as {
      rangerId?: string
      fileId?: string
      fileIds?: string[]
      mode?: string
      targetCategory?: string
      clientId?: string
      params?: Record<string, unknown>
    }

    if (!rangerId) {
      res.status(400).json(errorResponse('rangerId is required'))
      return
    }

    if (!isValidRanger(rangerId)) {
      res.status(400).json(errorResponse(`Unknown ranger: ${rangerId}`))
      return
    }

    const entry = getRanger(rangerId)
    if (!entry) {
      res.status(500).json(errorResponse('Ranger lookup failed'))
      return
    }

    const input: RangerDispatchInput = {
      fileId,
      fileIds,
      mode: (mode as RangerDispatchInput['mode']) || 'csv',
      targetCategory,
      clientId,
      params,
    }

    const userEmail = (req as Request & { user?: { email?: string } }).user?.email || 'unknown'

    // Fire and forget — Ranger runs in background, writes progress to Firestore
    const executionPromise = entry.executor(input, userEmail)

    // Write initial doc synchronously before returning
    // (createRanger already writes the initial doc, so we just need the runId)
    // We start the execution and return immediately
    executionPromise.catch((err) => {
      console.error(`[ranger-dispatch] ${rangerId} execution error:`, err)
    })

    // Generate the runId using the same pattern as ranger-base
    // Since ranger-base writes the doc before executing, we wait briefly for it
    // Instead, we return a pending acknowledgment
    res.json(
      successResponse({
        rangerId,
        wireId: entry.meta.wireId,
        status: 'dispatched' as const,
        message: `Ranger ${rangerId} dispatched. Check /api/rangers/history for run status.`,
      })
    )
  } catch (err) {
    console.error('[ranger-dispatch] error:', err)
    res.status(500).json(errorResponse('Failed to dispatch ranger'))
  }
})

// ---------------------------------------------------------------------------
// GET /api/rangers/:runId/status — Get step-level progress for a run
// ---------------------------------------------------------------------------
rangerRoutes.get('/:runId/status', async (req: Request, res: Response) => {
  try {
    const runId = req.params.runId as string
    if (!runId) {
      res.status(400).json(errorResponse('runId is required'))
      return
    }

    const db = getFirestore()
    const doc = await db.collection('ranger_runs').doc(runId).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse(`Run not found: ${runId}`))
      return
    }

    const data = doc.data() as RangerRunDoc
    res.json(
      successResponse({
        runId: data.runId,
        rangerId: data.rangerId,
        wireId: data.wireId,
        status: data.status,
        steps: data.steps,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        output: data.output,
        error: data.error,
      })
    )
  } catch (err) {
    console.error('[ranger-status] error:', err)
    res.status(500).json(errorResponse('Failed to get ranger status'))
  }
})

// ---------------------------------------------------------------------------
// GET /api/rangers/history — Paginated run history
// ---------------------------------------------------------------------------
rangerRoutes.get('/history', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)

    let query = db.collection('ranger_runs') as FirebaseFirestore.Query

    // Filter by rangerId
    const rangerId = req.query.rangerId as string | undefined
    if (rangerId) {
      query = query.where('rangerId', '==', rangerId)
    }

    // Filter by status
    const status = req.query.status as RangerStatus | undefined
    if (status) {
      query = query.where('status', '==', status)
    }

    // Filter by date range
    const since = req.query.since as string | undefined
    if (since) {
      query = query.where('startedAt', '>=', since)
    }
    const until = req.query.until as string | undefined
    if (until) {
      query = query.where('startedAt', '<=', until)
    }

    const result = await paginatedQuery(query, 'ranger_runs', params)
    res.json(successResponse(result))
  } catch (err) {
    console.error('[ranger-history] error:', err)
    res.status(500).json(errorResponse('Failed to get ranger history'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/rangers/:runId/cancel — Cancel a running execution
// ---------------------------------------------------------------------------
rangerRoutes.post('/:runId/cancel', async (req: Request, res: Response) => {
  try {
    const runId = req.params.runId as string
    if (!runId) {
      res.status(400).json(errorResponse('runId is required'))
      return
    }

    const db = getFirestore()
    const docRef = db.collection('ranger_runs').doc(runId)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse(`Run not found: ${runId}`))
      return
    }

    const data = doc.data() as RangerRunDoc
    if (data.status !== 'running') {
      res.status(400).json(errorResponse(`Cannot cancel run in status: ${data.status}`))
      return
    }

    const cancelledAt = new Date().toISOString()
    const userEmail = (req as Request & { user?: { email?: string } }).user?.email || 'unknown'

    await docRef.update({
      status: 'cancelled',
      completedAt: cancelledAt,
      error: `Cancelled by ${userEmail}`,
      updated_at: cancelledAt,
    })

    res.json(successResponse({ runId, status: 'cancelled', cancelledBy: userEmail }))
  } catch (err) {
    console.error('[ranger-cancel] error:', err)
    res.status(500).json(errorResponse('Failed to cancel ranger run'))
  }
})

// ---------------------------------------------------------------------------
// GET /api/rangers/registry — List all registered Rangers
// ---------------------------------------------------------------------------
rangerRoutes.get('/registry', async (_req: Request, res: Response) => {
  try {
    const rangers = listRangers()

    // Enrich with current status from Firestore (latest run per ranger)
    const db = getFirestore()
    const enriched = await Promise.all(
      rangers.map(async (meta) => {
        const latestRun = await db
          .collection('ranger_runs')
          .where('rangerId', '==', meta.rangerId)
          .orderBy('startedAt', 'desc')
          .limit(1)
          .get()

        const lastRun = latestRun.empty ? null : (latestRun.docs[0].data() as RangerRunDoc)
        return {
          ...meta,
          currentStatus: lastRun?.status === 'running' ? 'running' : 'idle',
          lastRunAt: lastRun?.startedAt || null,
          lastRunStatus: lastRun?.status || null,
        }
      })
    )

    res.json(successResponse(enriched))
  } catch (err) {
    console.error('[ranger-registry] error:', err)
    res.status(500).json(errorResponse('Failed to list rangers'))
  }
})
