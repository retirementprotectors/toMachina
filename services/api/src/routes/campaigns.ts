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

export const campaignRoutes = Router()
const COLLECTION = 'campaigns'

campaignRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.type) query = query.where('campaign_type', '==', req.query.type)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/campaigns error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

campaignRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Campaign not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/campaigns/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

campaignRoutes.get('/:id/templates', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const snap = await db.collection('templates').where('campaign_id', '==', id).get()
    const templates = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse(templates, { count: templates.length }))
  } catch (err) {
    console.error('GET /api/campaigns/:id/templates error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
