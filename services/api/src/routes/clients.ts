import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  writeThroughBridge,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const clientRoutes = Router()
const COLLECTION = 'clients'

// Validation rules for client writes
const clientValidation = validateWrite({
  required: ['first_name', 'last_name'],
  types: {
    first_name: 'string',
    last_name: 'string',
    email: 'string',
    phone: 'string',
    dob: 'string',
    state: 'string',
    zip: 'string',
  },
  immutable: ['_migrated_at', '_source', '_created_by', '_updated_by', '_deleted_by'],
  maxFields: 120,
})

/**
 * GET /api/clients
 * List clients with pagination + optional search
 */
clientRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    const search = (req.query.q as string) || ''
    const statusFilter = (req.query.status as string) || ''

    if (!params.orderBy) params.orderBy = 'last_name'
    if (!req.query.orderDir) params.orderDir = 'asc'

    let query: Query<DocumentData> = db.collection(COLLECTION)

    if (statusFilter) {
      query = query.where('client_status', '==', statusFilter)
    }

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
    console.error('GET /api/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/clients/:id
 */
clientRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error(`GET /api/clients error:`, err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/clients/:id/accounts
 */
clientRoutes.get('/:id/accounts', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const typeFilter = (req.query.type as string) || ''

    let query: Query<DocumentData> = db.collection(COLLECTION).doc(id).collection('accounts')

    if (typeFilter) {
      query = query.where('account_type_category', '==', typeFilter)
    }

    const snap = await query.get()
    const accounts = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(accounts, { count: accounts.length }))
  } catch (err) {
    console.error('GET /api/clients/:id/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/clients/:id/activities
 */
clientRoutes.get('/:id/activities', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

    const snap = await db
      .collection(COLLECTION)
      .doc(id)
      .collection('activities')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()

    const activities = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(activities, { count: activities.length }))
  } catch (err) {
    console.error('GET /api/clients/:id/activities error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/clients/:id/relationships
 */
clientRoutes.get('/:id/relationships', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const snap = await db
      .collection(COLLECTION)
      .doc(id)
      .collection('relationships')
      .get()

    const relationships = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(relationships, { count: relationships.length }))
  } catch (err) {
    console.error('GET /api/clients/:id/relationships error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/clients
 */
clientRoutes.post('/', clientValidation, async (req: Request, res: Response) => {
  try {
    const body = req.body
    const db = getFirestore()
    const now = new Date().toISOString()
    const clientId = body.client_id || db.collection(COLLECTION).doc().id

    const clientData = {
      ...body,
      client_id: clientId,
      created_at: body.created_at || now,
      updated_at: now,
      _created_by: (req as any).user?.email || 'api',
    }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', clientId, clientData)
    if (!bridgeResult.success) {
      await db.collection(COLLECTION).doc(clientId).set(clientData)
    }

    res.status(201).json(successResponse({ id: clientId, ...clientData }))
  } catch (err) {
    console.error('POST /api/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/clients/:id
 */
clientRoutes.patch('/:id', clientValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as any).user?.email || 'api',
    }
    delete updates.client_id
    delete updates.id
    delete updates.created_at

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) {
      await docRef.update(updates)
    }

    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/clients/:id (soft delete)
 */
clientRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const updates = {
      client_status: 'deleted',
      updated_at: new Date().toISOString(),
      _deleted_by: (req as any).user?.email || 'api',
    }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) {
      await docRef.update(updates)
    }

    res.json(successResponse({ id, status: 'deleted' }))
  } catch (err) {
    console.error('DELETE /api/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
