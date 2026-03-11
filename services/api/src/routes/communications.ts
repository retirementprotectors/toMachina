import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const communicationRoutes = Router()
const COLLECTION = 'communications'

communicationRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.client_id) query = query.where('client_id', '==', req.query.client_id)
    if (req.query.channel) query = query.where('channel', '==', req.query.channel)
    if (req.query.direction) query = query.where('direction', '==', req.query.direction)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/communications error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

communicationRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Communication record not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/communications/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
