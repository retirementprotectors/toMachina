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

export const caseTaskRoutes = Router()
const COLLECTION = 'case_tasks'

caseTaskRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.assigned_to) query = query.where('assigned_to', '==', req.query.assigned_to)
    if (req.query.client_id) query = query.where('client_id', '==', req.query.client_id)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/case-tasks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

caseTaskRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Case task not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/case-tasks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

caseTaskRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['task_type', 'status'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const taskId = req.body.task_id || db.collection(COLLECTION).doc().id
    const data = { ...req.body, task_id: taskId, created_at: req.body.created_at || now, updated_at: now, _created_by: (req as any).user?.email || 'api' }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', taskId, data)
    if (!bridgeResult.success) await db.collection(COLLECTION).doc(taskId).set(data)

    res.status(201).json(successResponse({ id: taskId, ...data }))
  } catch (err) {
    console.error('POST /api/case-tasks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

caseTaskRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Case task not found')); return }

    const updates = { ...req.body, updated_at: new Date().toISOString(), _updated_by: (req as any).user?.email || 'api' }
    delete updates.task_id; delete updates.id; delete updates.created_at

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/case-tasks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
