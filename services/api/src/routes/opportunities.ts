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
import type { OpportunityDTO, OpportunityDeleteResult } from '@tomachina/core'

export const opportunityRoutes = Router()
const COLLECTION = 'opportunities'

opportunityRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.pipeline) query = query.where('pipeline', '==', req.query.pipeline)
    if (req.query.stage) query = query.where('stage', '==', req.query.stage)
    if (req.query.client_id) query = query.where('client_id', '==', req.query.client_id)
    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse<OpportunityDTO[]>(data as unknown as OpportunityDTO[], { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/opportunities error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

opportunityRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Opportunity not found')); return }
    res.json(successResponse<OpportunityDTO>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>) as unknown as OpportunityDTO))
  } catch (err) {
    console.error('GET /api/opportunities/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

opportunityRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['pipeline', 'stage'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const oppId = req.body.opportunity_id || db.collection(COLLECTION).doc().id
    const data = { ...req.body, opportunity_id: oppId, value: parseFloat(req.body.value) || 0, created_at: req.body.created_at || now, updated_at: now, _created_by: (req as any).user?.email || 'api' }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', oppId, data)
    if (!bridgeResult.success) await db.collection(COLLECTION).doc(oppId).set(data)

    res.status(201).json(successResponse<OpportunityDTO>({ id: oppId, ...data } as unknown as OpportunityDTO))
  } catch (err) {
    console.error('POST /api/opportunities error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

opportunityRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Opportunity not found')); return }

    const updates: Record<string, unknown> = { ...req.body, updated_at: new Date().toISOString(), _updated_by: (req as any).user?.email || 'api' }
    if (updates.value != null) updates.value = parseFloat(String(updates.value)) || 0
    delete updates.opportunity_id; delete updates.id; delete updates.created_at

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse<OpportunityDTO>(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>) as unknown as OpportunityDTO))
  } catch (err) {
    console.error('PATCH /api/opportunities/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

opportunityRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Opportunity not found')); return }

    const updates = { stage: 'closed_lost', updated_at: new Date().toISOString(), _deleted_by: (req as any).user?.email || 'api' }
    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    res.json(successResponse<OpportunityDeleteResult>({ id, stage: 'closed_lost' } as unknown as OpportunityDeleteResult))
  } catch (err) {
    console.error('DELETE /api/opportunities/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
