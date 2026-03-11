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

export const revenueRoutes = Router()
const COLLECTION = 'revenue'

revenueRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)
    if (req.query.account_id) query = query.where('account_id', '==', req.query.account_id)
    if (req.query.type) query = query.where('revenue_type', '==', req.query.type)
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.get('/summary/by-agent', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const snap = await query.get()
    const byAgent: Record<string, { total: number; count: number; agent_id: string }> = {}

    snap.docs.forEach(doc => {
      const d = doc.data()
      const agentId = String(d.agent_id || 'unknown')
      if (!byAgent[agentId]) byAgent[agentId] = { total: 0, count: 0, agent_id: agentId }
      byAgent[agentId].total += parseFloat(String(d.amount)) || 0
      byAgent[agentId].count += 1
    })

    const summary = Object.values(byAgent).sort((a, b) => b.total - a.total)
    res.json(successResponse(summary, { count: summary.length }))
  } catch (err) {
    console.error('GET /api/revenue/summary/by-agent error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Revenue record not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/revenue/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['account_id', 'amount', 'revenue_type'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const revenueId = req.body.revenue_id || db.collection(COLLECTION).doc().id
    const data = { ...req.body, revenue_id: revenueId, amount: parseFloat(req.body.amount) || 0, created_at: req.body.created_at || now, updated_at: now, _created_by: (req as any).user?.email || 'api' }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', revenueId, data)
    if (!bridgeResult.success) await db.collection(COLLECTION).doc(revenueId).set(data)

    res.status(201).json(successResponse({ id: revenueId, ...data }))
  } catch (err) {
    console.error('POST /api/revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Revenue record not found')); return }

    const updates: Record<string, unknown> = { ...req.body, updated_at: new Date().toISOString(), _updated_by: (req as any).user?.email || 'api' }
    if (updates.amount != null) updates.amount = parseFloat(String(updates.amount)) || 0
    delete updates.revenue_id; delete updates.id; delete updates.created_at

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/revenue/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
