import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  param,
} from '../lib/helpers.js'
import type { IntakeQueueListDTO, IntakeQueueUpdateResult } from '@tomachina/core'

export const intakeQueueRoutes = Router()
const COLLECTION = 'intake_queue'

// GET / — list all intake queue items (ordered by created_at desc)
intakeQueueRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).orderBy('created_at', 'desc').limit(200).get()
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    res.json(successResponse<IntakeQueueListDTO>(data as unknown as IntakeQueueListDTO))
  } catch (err) {
    console.error('GET /api/intake-queue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// PATCH /:id — update queue item (status changes for approve/reject/skip)
intakeQueueRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const ref = db.collection(COLLECTION).doc(id)
    const existing = await ref.get()
    if (!existing.exists) { res.status(404).json(errorResponse('Queue item not found')); return }

    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: userEmail,
    }

    await ref.update(updates)
    res.json(successResponse<IntakeQueueUpdateResult>({ id, ...updates } as unknown as IntakeQueueUpdateResult))
  } catch (err) {
    console.error('PATCH /api/intake-queue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
