import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  validateRequired,
  writeThroughBridge,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const producerRoutes = Router()
const COLLECTION = 'producers'

producerRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    const search = (req.query.q as string) || ''
    const statusFilter = (req.query.status as string) || ''

    if (!params.orderBy) params.orderBy = 'last_name'
    if (!req.query.orderDir) params.orderDir = 'asc'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (statusFilter) query = query.where('producer_status', '==', statusFilter)

    if (search) {
      const upper = search.charAt(0).toUpperCase() + search.slice(1).toLowerCase()
      const end = upper.slice(0, -1) + String.fromCharCode(upper.charCodeAt(upper.length - 1) + 1)
      query = query.where('last_name', '>=', upper).where('last_name', '<', end)
      params.orderBy = 'last_name'
      params.orderDir = 'asc'
    }

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/producers error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

producerRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Producer not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/producers/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

producerRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['first_name', 'last_name'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const producerId = req.body.producer_id || db.collection(COLLECTION).doc().id
    const data = { ...req.body, producer_id: producerId, created_at: req.body.created_at || now, updated_at: now, _created_by: (req as any).user?.email || 'api' }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', producerId, data)
    if (!bridgeResult.success) await db.collection(COLLECTION).doc(producerId).set(data)

    res.status(201).json(successResponse({ id: producerId, ...data }))
  } catch (err) {
    console.error('POST /api/producers error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

producerRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Producer not found')); return }

    const updates = { ...req.body, updated_at: new Date().toISOString(), _updated_by: (req as any).user?.email || 'api' }
    delete updates.producer_id; delete updates.id; delete updates.created_at

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/producers/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
