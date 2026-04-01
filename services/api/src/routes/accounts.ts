import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  validateRequired,
  writeThroughBridge,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { AccountDTO, AccountWithClientDTO, AccountCreateDTO, AccountUpdateDTO } from '@tomachina/core'

export const accountRoutes = Router()

/**
 * GET /api/accounts
 * List accounts across all clients (collection group query)
 */
accountRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    const typeFilter = (req.query.type as string) || ''
    const statusFilter = (req.query.status as string) || ''
    const search = (req.query.q as string) || ''

    let query: Query<DocumentData> = db.collectionGroup('accounts')

    if (typeFilter) query = query.where('account_type_category', '==', typeFilter)
    if (statusFilter) query = query.where('status', '==', statusFilter)

    if (search) {
      const term = search.trim()
      const end = term.slice(0, -1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1)
      query = query.where('carrier_name', '>=', term).where('carrier_name', '<', end)
    }

    const limit = params.limit
    let finalQuery = query.limit(limit + 1)

    if (params.startAfter) {
      const parts = params.startAfter.split('__')
      if (parts.length === 2) {
        const cursorDoc = await db.collection('clients').doc(parts[0]).collection('accounts').doc(parts[1]).get()
        if (cursorDoc.exists) {
          finalQuery = query.startAfter(cursorDoc).limit(limit + 1)
        }
      }
    }

    const snap = await finalQuery.get()
    const docs = snap.docs.slice(0, limit)
    const hasMore = snap.docs.length > limit

    const data = docs.map(doc => {
      const pathParts = doc.ref.path.split('/')
      const clientId = pathParts[1] || ''
      return stripInternalFields({ id: doc.id, _client_id: clientId, ...doc.data() } as Record<string, unknown>)
    })

    const nextCursor = hasMore && docs.length > 0
      ? `${(data[data.length - 1] as Record<string, unknown>)._client_id}__${docs[docs.length - 1].id}`
      : null

    res.json(successResponse<AccountDTO[]>(data as unknown as AccountDTO[], { pagination: { count: data.length, hasMore, nextCursor } }))
  } catch (err) {
    console.error('GET /api/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/accounts/:clientId/:accountId
 */
accountRoutes.get('/:clientId/:accountId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const accountId = param(req.params.accountId)
    const doc = await db.collection('clients').doc(clientId).collection('accounts').doc(accountId).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Account not found'))
      return
    }

    res.json(successResponse<AccountDTO>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>) as unknown as AccountDTO))
  } catch (err) {
    console.error('GET /api/accounts/:clientId/:accountId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/accounts/:clientId
 */
accountRoutes.post('/:clientId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)

    const clientDoc = await db.collection('clients').doc(clientId).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Parent client not found'))
      return
    }

    const err = validateRequired(req.body, ['account_type'])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const now = new Date().toISOString()
    const accountId = req.body.account_id || db.collection('_').doc().id

    const accountData = {
      ...req.body,
      account_id: accountId,
      client_id: clientId,
      created_at: req.body.created_at || now,
      updated_at: now,
      _created_by: (req as any).user?.email || 'api',
    }

    const bridgeResult = await writeThroughBridge('accounts', 'insert', accountId, accountData)
    if (!bridgeResult.success) {
      await db.collection('clients').doc(clientId).collection('accounts').doc(accountId).set(accountData)
    }

    res.status(201).json(successResponse<AccountCreateDTO>({ id: accountId, ...accountData } as unknown as AccountCreateDTO))
  } catch (err) {
    console.error('POST /api/accounts/:clientId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/accounts/:clientId/:accountId
 */
accountRoutes.patch('/:clientId/:accountId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const accountId = param(req.params.accountId)
    const docRef = db.collection('clients').doc(clientId).collection('accounts').doc(accountId)

    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Account not found'))
      return
    }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as any).user?.email || 'api',
    }
    delete updates.account_id
    delete updates.client_id
    delete updates.id
    delete updates.created_at

    const bridgeResult = await writeThroughBridge('accounts', 'update', accountId, updates)
    if (!bridgeResult.success) {
      await docRef.update(updates)
    }

    const updated = await docRef.get()
    res.json(successResponse<AccountUpdateDTO>(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>) as unknown as AccountUpdateDTO))
  } catch (err) {
    console.error('PATCH /api/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/accounts/:clientId/:accountId
 * Soft-delete: sets status to 'deleted' + deleted_at timestamp
 */
accountRoutes.delete('/:clientId/:accountId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const cId = param(req.params.clientId)
    const aId = param(req.params.accountId)
    const ref = db.collection('clients').doc(cId).collection('accounts').doc(aId)

    const snap = await ref.get()
    if (!snap.exists) {
      res.status(404).json(errorResponse('Account not found'))
      return
    }

    const updates = {
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      _deleted_by: (req as any).user?.email || 'api',
      updated_at: new Date().toISOString(),
    }

    const bridgeResult = await writeThroughBridge('accounts', 'update', aId, updates)
    if (!bridgeResult.success) {
      await ref.update(updates)
    }

    res.json(successResponse({ deleted: true, id: aId }))
  } catch (err) {
    console.error('DELETE /api/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
