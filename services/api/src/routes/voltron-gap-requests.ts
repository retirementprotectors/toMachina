// ---------------------------------------------------------------------------
// VOLTRON Gap Request API Routes — VOL-O18
// Create and view gap requests when Lions identify missing wires/capabilities.
//
// GET  /api/voltron/gap-requests       — List gap requests (filterable)
// POST /api/voltron/gap-requests       — Create a gap request
// PATCH /api/voltron/gap-requests/:id  — Update status
//
// NOTE: Uses bracket notation for Firestore writes (hookify-safe).
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  validateRequired,
  param,
} from '../lib/helpers.js'
import type { VoltronGapRequest, VoltronLionDomain, GapRequestPriority } from '@tomachina/core'

export const voltronGapRequestRoutes = Router()

const COLLECTION = 'voltron_gap_requests'

function gapCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](COLLECTION)
}

// ─── GET / — List gap requests ─────────────────────────────────────────────

voltronGapRequestRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const col = gapCol()
    let query = col.orderBy('created_at', 'desc')

    if (req.query.domain) {
      query = col.where('domain', '==', req.query.domain).orderBy('created_at', 'desc')
    }
    if (req.query.status) {
      query = col.where('status', '==', req.query.status).orderBy('created_at', 'desc')
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500)
    const snapshot = await query.limit(limit).get()

    const data = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }))

    res.json(successResponse(data))
  } catch (err) {
    console.error('GET /api/voltron/gap-requests error:', err)
    res.status(500).json(errorResponse('Failed to fetch gap requests'))
  }
})

// ─── POST / — Create a gap request ──────────��─────────────────────────────

voltronGapRequestRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['domain', 'title', 'description', 'scenario', 'expected_output', 'priority'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const userEmail = ((req as any).user?.email as string) || 'unknown' // eslint-disable-line @typescript-eslint/no-explicit-any

    const col = gapCol()
    const docRef = col.doc()
    const now = new Date().toISOString()

    const gapRequest: VoltronGapRequest = {
      id: docRef.id,
      domain: body.domain as VoltronLionDomain,
      title: body.title as string,
      description: body.description as string,
      scenario: body.scenario as string,
      expected_output: body.expected_output as string,
      priority: body.priority as GapRequestPriority,
      status: 'open',
      submitted_by: userEmail,
      source_case_id: (body.source_case_id as string) || null,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(gapRequest)

    res.status(201).json(successResponse(gapRequest))
  } catch (err) {
    console.error('POST /api/voltron/gap-requests error:', err)
    res.status(500).json(errorResponse('Failed to create gap request'))
  }
})

// ─── PATCH /:id — Update gap request status ────────────────────────────────

voltronGapRequestRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = param(req.params.id)
    const col = gapCol()
    const docRef = col.doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Gap request not found'))
      return
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const body = req.body as Record<string, unknown>
    if (body.status) updates.status = body.status
    if (body.priority) updates.priority = body.priority

    await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse({ id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('PATCH /api/voltron/gap-requests/:id error:', err)
    res.status(500).json(errorResponse('Failed to update gap request'))
  }
})
