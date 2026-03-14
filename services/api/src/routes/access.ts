import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import { randomUUID } from 'crypto'

export const accessRoutes = Router()

const CLIENTS = 'clients'
const ACCESS_ITEMS = 'access_items'

// ---------------------------------------------------------------------------
// GET /:clientId — List all access items for a client
// ---------------------------------------------------------------------------

accessRoutes.get('/:clientId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)

    if (!clientId) {
      res.status(400).json(errorResponse('clientId is required'))
      return
    }

    const snap = await db
      .collection(CLIENTS)
      .doc(clientId)
      .collection(ACCESS_ITEMS)
      .orderBy('service_name', 'asc')
      .get()

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    res.json(successResponse(items, { count: items.length }))
  } catch (err) {
    console.error('GET /api/access/:clientId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ---------------------------------------------------------------------------
// GET /:clientId/:accessId — Get single access item
// ---------------------------------------------------------------------------

accessRoutes.get('/:clientId/:accessId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const accessId = param(req.params.accessId)

    const doc = await db
      .collection(CLIENTS)
      .doc(clientId)
      .collection(ACCESS_ITEMS)
      .doc(accessId)
      .get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Access item not found'))
      return
    }

    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/access/:clientId/:accessId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ---------------------------------------------------------------------------
// POST /:clientId — Create access item
// ---------------------------------------------------------------------------

accessRoutes.post('/:clientId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const body = req.body as Record<string, unknown>

    // Validate required fields
    if (!body.type || !body.service_name || !body.category) {
      res.status(400).json(errorResponse('Missing required fields: type, service_name, category'))
      return
    }

    const now = new Date().toISOString()
    const accessId = randomUUID()

    const item = {
      access_id: accessId,
      client_id: clientId,
      type: body.type,
      service_name: body.service_name,
      category: body.category,
      carrier_id: body.carrier_id || null,
      product_type: body.product_type || null,
      status: body.status || 'not_started',
      portal_url: body.portal_url || null,
      username: body.username || null,
      auth_status: body.auth_status || 'none',
      auth_doc_url: body.auth_doc_url || null,
      last_verified: body.last_verified || null,
      last_login: body.last_login || null,
      notes: body.notes || null,
      created_at: now,
      updated_at: now,
    }

    await db
      .collection(CLIENTS)
      .doc(clientId)
      .collection(ACCESS_ITEMS)
      .doc(accessId)
      .set(item)

    res.status(201).json(successResponse(item))
  } catch (err) {
    console.error('POST /api/access/:clientId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ---------------------------------------------------------------------------
// PUT /:clientId/:accessId — Update access item
// ---------------------------------------------------------------------------

accessRoutes.put('/:clientId/:accessId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const accessId = param(req.params.accessId)
    const body = req.body as Record<string, unknown>

    const docRef = db
      .collection(CLIENTS)
      .doc(clientId)
      .collection(ACCESS_ITEMS)
      .doc(accessId)

    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Access item not found'))
      return
    }

    const updates: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString(),
    }
    // Don't allow overwriting immutable fields
    delete updates.access_id
    delete updates.client_id
    delete updates.created_at

    await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse({ id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('PUT /api/access/:clientId/:accessId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ---------------------------------------------------------------------------
// DELETE /:clientId/:accessId — Delete access item
// ---------------------------------------------------------------------------

accessRoutes.delete('/:clientId/:accessId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const accessId = param(req.params.accessId)

    const docRef = db
      .collection(CLIENTS)
      .doc(clientId)
      .collection(ACCESS_ITEMS)
      .doc(accessId)

    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Access item not found'))
      return
    }

    await docRef.delete()
    res.json(successResponse({ id: accessId, status: 'deleted' }))
  } catch (err) {
    console.error('DELETE /api/access/:clientId/:accessId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ---------------------------------------------------------------------------
// POST /:clientId/auto-generate — Auto-generate portal items from accounts
// ---------------------------------------------------------------------------

/**
 * Derive access category from account type.
 */
function deriveCategory(accountType: string): 'medicare' | 'annuity' | 'life' | 'investment' | 'other' {
  const lower = (accountType || '').toLowerCase()
  if (lower.includes('medicare') || lower.includes('mapd') || lower.includes('med supp') || lower.includes('supplement')) return 'medicare'
  if (lower.includes('annuity') || lower.includes('fia') || lower.includes('myga') || lower.includes('spia') || lower.includes('dia')) return 'annuity'
  if (lower.includes('life') || lower.includes('ul') || lower.includes('whole') || lower.includes('term') || lower.includes('iul')) return 'life'
  if (lower.includes('bd') || lower.includes('ria') || lower.includes('mutual') || lower.includes('advisory') || lower.includes('investment') || lower.includes('brokerage')) return 'investment'
  return 'other'
}

accessRoutes.post('/:clientId/auto-generate', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)

    // 1. Read client accounts
    const accountsSnap = await db
      .collection(CLIENTS)
      .doc(clientId)
      .collection('accounts')
      .get()

    // 2. Read existing access items to avoid duplicates
    const existingSnap = await db
      .collection(CLIENTS)
      .doc(clientId)
      .collection(ACCESS_ITEMS)
      .get()

    const existingKeys = new Set(
      existingSnap.docs.map((d) => {
        const data = d.data()
        return `${data.service_name}::${data.client_id}`
      })
    )

    const now = new Date().toISOString()
    let createdCount = 0
    const batch = db.batch()

    // 3. Derive portal access items from each account
    for (const accountDoc of accountsSnap.docs) {
      const account = accountDoc.data()
      const serviceName = account.carrier || account.carrier_name || ''
      if (!serviceName) continue

      const key = `${serviceName}::${clientId}`
      if (existingKeys.has(key)) continue

      const accessId = randomUUID()
      const item = {
        access_id: accessId,
        client_id: clientId,
        type: 'portal',
        service_name: serviceName,
        category: deriveCategory(account.account_type || account.account_type_category || ''),
        carrier_id: account.carrier_id || null,
        product_type: account.product || account.account_type || null,
        status: 'not_started',
        portal_url: null,
        username: null,
        auth_status: 'none',
        auth_doc_url: null,
        last_verified: null,
        last_login: null,
        notes: null,
        created_at: now,
        updated_at: now,
      }

      batch.set(
        db.collection(CLIENTS).doc(clientId).collection(ACCESS_ITEMS).doc(accessId),
        item
      )
      existingKeys.add(key)
      createdCount++
    }

    // 4. Auto-generate standard API items if missing
    const standardApis = [
      { service_name: 'Medicare.gov', category: 'medicare' as const },
      { service_name: 'Social Security / SSA.gov', category: 'government' as const },
      { service_name: 'IRS.gov', category: 'government' as const },
    ]

    for (const api of standardApis) {
      const key = `${api.service_name}::${clientId}`
      if (existingKeys.has(key)) continue

      const accessId = randomUUID()
      const item = {
        access_id: accessId,
        client_id: clientId,
        type: 'api',
        service_name: api.service_name,
        category: api.category,
        carrier_id: null,
        product_type: null,
        status: 'not_started',
        portal_url: null,
        username: null,
        auth_status: 'none',
        auth_doc_url: null,
        last_verified: null,
        last_login: null,
        notes: null,
        created_at: now,
        updated_at: now,
      }

      batch.set(
        db.collection(CLIENTS).doc(clientId).collection(ACCESS_ITEMS).doc(accessId),
        item
      )
      existingKeys.add(key)
      createdCount++
    }

    // 5. Commit batch
    if (createdCount > 0) {
      await batch.commit()
    }

    res.json(successResponse({ created: createdCount }))
  } catch (err) {
    console.error('POST /api/access/:clientId/auto-generate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
