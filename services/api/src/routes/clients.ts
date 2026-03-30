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
import type { ClientDTO, ClientListDTO, ClientDeleteResult, AccountDTO, ActivityDTO, RelationshipDTO } from '@tomachina/core'
import { quickContactScore } from '@tomachina/core'

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
      query = query.where('status', '==', statusFilter)
    }

    if (search) {
      const upper = search.charAt(0).toUpperCase() + search.slice(1).toLowerCase()
      const end = upper.slice(0, -1) + String.fromCharCode(upper.charCodeAt(upper.length - 1) + 1)

      // Search both last_name AND first_name in parallel, merge + deduplicate
      const [lastSnap, firstSnap] = await Promise.all([
        db.collection(COLLECTION).where('last_name', '>=', upper).where('last_name', '<', end).limit(params.limit).get(),
        db.collection(COLLECTION).where('first_name', '>=', upper).where('first_name', '<', end).limit(params.limit).get(),
      ])
      const seen = new Set<string>()
      const merged: Record<string, unknown>[] = []
      for (const doc of [...lastSnap.docs, ...firstSnap.docs]) {
        if (seen.has(doc.id)) continue
        seen.add(doc.id)
        merged.push({ id: doc.id, ...doc.data() })
      }
      const data = merged.slice(0, params.limit).map((d) => stripInternalFields(d))
      res.json(successResponse<ClientDTO[]>(data as unknown as ClientDTO[], { pagination: { count: data.length, total: data.length } }))
      return
    }

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))

    res.json(successResponse<ClientDTO[]>(data as unknown as ClientDTO[], { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/clients/search?q=<query>
 * Lightweight search returning id, name, email, phone, status, account_count.
 * Used by MDJ Mobile client search screen.
 */
clientRoutes.get('/search', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const search = ((req.query.q as string) || '').trim()
    if (!search) {
      res.json(successResponse<ClientDTO[]>([] as unknown as ClientDTO[]))
      return
    }

    const upper = search.charAt(0).toUpperCase() + search.slice(1).toLowerCase()
    const end = upper.slice(0, -1) + String.fromCharCode(upper.charCodeAt(upper.length - 1) + 1)

    const snap = await db.collection(COLLECTION)
      .where('last_name', '>=', upper)
      .where('last_name', '<', end)
      .limit(25)
      .get()

    const results = await Promise.all(
      snap.docs.map(async (doc) => {
        const d = doc.data()
        // Count accounts subcollection
        const accountsSnap = await db.collection(COLLECTION).doc(doc.id).collection('accounts').count().get()
        return {
          id: doc.id,
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          email: d.email || undefined,
          phone: d.phone || undefined,
          status: d.status || 'active',
          account_count: accountsSnap.data().count,
        }
      })
    )

    res.json(successResponse(results))
  } catch (err) {
    console.error('GET /api/clients/search error:', err)
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

    res.json(successResponse<ClientDTO>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>) as unknown as ClientDTO))
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

    res.json(successResponse<AccountDTO[]>(accounts as unknown as AccountDTO[], { pagination: { count: accounts.length, total: accounts.length } }))
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

    res.json(successResponse<ActivityDTO[]>(activities as unknown as ActivityDTO[], { pagination: { count: activities.length, total: activities.length } }))
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

    res.json(successResponse<RelationshipDTO[]>(relationships as unknown as RelationshipDTO[], { pagination: { count: relationships.length, total: relationships.length } }))
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

    res.status(201).json(successResponse<ClientDTO>({ id: clientId, ...clientData } as unknown as ClientDTO))
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
    res.json(successResponse<ClientDTO>(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>) as unknown as ClientDTO))
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
      status: 'deleted',
      updated_at: new Date().toISOString(),
      _deleted_by: (req as any).user?.email || 'api',
    }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) {
      await docRef.update(updates)
    }

    res.json(successResponse<ClientDeleteResult>({ id, status: 'deleted' } as unknown as ClientDeleteResult))
  } catch (err) {
    console.error('DELETE /api/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:id/dismiss-duplicate — dismiss a duplicate match (TRK-13681)
clientRoutes.post('/:id/dismiss-duplicate', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.id)
    const { match_id } = req.body
    if (!match_id) { res.status(400).json(errorResponse('match_id required')); return }
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
    const now = new Date().toISOString()

    const batch = db.batch()
    // Add to both client docs (bidirectional dismiss)
    const { FieldValue } = require('firebase-admin/firestore')
    batch.update(db.collection(COLLECTION).doc(clientId), {
      dismissed_duplicates: FieldValue.arrayUnion(match_id),
      updated_at: now,
      _updated_by: userEmail,
    })
    batch.update(db.collection(COLLECTION).doc(match_id), {
      dismissed_duplicates: FieldValue.arrayUnion(clientId),
      updated_at: now,
      _updated_by: userEmail,
    })
    await batch.commit()

    res.json(successResponse<{ dismissed: true }>({ dismissed: true }))
  } catch (err) {
    console.error('POST /api/clients/:id/dismiss-duplicate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/clients/:id/quality-score
 * Quick quality score from stored contact data (no external API calls).
 * For full validated scoring, use POST /api/validation/score.
 */
clientRoutes.get('/:id/quality-score', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const data = doc.data() as Record<string, unknown>

    // Build address from client fields
    const address = data.address_1 || data.street_address
      ? {
          streetAddress: String(data.address_1 || data.street_address || ''),
          secondaryAddress: String(data.address_2 || ''),
          city: String(data.city || ''),
          state: String(data.state || ''),
          ZIPCode: String(data.zip || data.zip_code || ''),
        }
      : undefined

    const score = quickContactScore({
      phone: data.phone ? String(data.phone) : undefined,
      email: data.email ? String(data.email) : undefined,
      address,
    })

    res.json(successResponse(score))
  } catch (err) {
    console.error('GET /api/clients/:id/quality-score error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

