import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const territoryRoutes = Router()
const COLLECTION = 'territories'

// ─── GET / — list territories with optional filters ───
territoryRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection(COLLECTION).orderBy('territory_name', 'asc').get()
    let data: Record<string, unknown>[] = snapshot.docs.map(doc =>
      stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)
    )

    // Filters
    if (req.query.state) {
      const stateUpper = (req.query.state as string).toUpperCase()
      data = data.filter(d => (d.state as string || '').toUpperCase() === stateUpper)
    }
    if (req.query.status) {
      data = data.filter(d => d.territory_status === req.query.status)
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 500)
    const total = data.length
    data = data.slice(0, limit)

    res.json(successResponse(data, { pagination: { count: data.length, total, hasMore: total > limit } }))
  } catch (err) {
    console.error('GET /api/territories error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── GET /:id — single territory with zones ───
territoryRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Territory not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/territories/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST / — create territory ───
territoryRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { territory_name, state } = req.body as Record<string, unknown>
    if (!territory_name) { res.status(400).json(errorResponse('territory_name is required')); return }
    if (!state) { res.status(400).json(errorResponse('state is required')); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const territoryId = db.collection(COLLECTION).doc().id
    const email = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    const territoryData: Record<string, unknown> = {
      ...req.body,
      territory_id: territoryId,
      territory_status: (req.body as Record<string, unknown>).territory_status || 'Active',
      counties: (req.body as Record<string, unknown>).counties || [],
      zones: (req.body as Record<string, unknown>).zones || [],
      created_at: now,
      updated_at: now,
      _created_by: email,
    }

    await db.collection(COLLECTION).doc(territoryId).set(territoryData)

    res.status(201).json(successResponse(stripInternalFields({ id: territoryId, ...territoryData })))
  } catch (err) {
    console.error('POST /api/territories error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── PATCH /:id — update territory ───
territoryRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Territory not found')); return }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    } as Record<string, unknown>
    delete updates.territory_id
    delete updates.id
    delete updates.created_at

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/territories/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
