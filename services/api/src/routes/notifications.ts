/**
 * Notifications routes — CRUD for notification docs.
 * TRK-13685: Backend wiring for NotificationsModule.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'

export const notificationRoutes = Router()

const COLLECTION = 'notifications'

/* ─── Types ─── */

interface NotificationDoc {
  type: 'info' | 'warning' | 'action' | 'success'
  title: string
  body: string
  link: string
  portal: string
  category: 'contact' | 'account' | 'myrpi' | 'data' | 'approval'
  read: boolean
  created_at: string
  _created_by: string
  /** COMMS-V2-005: Optional target user email for directed notifications */
  target_user?: string
}

/* ─── Helper: Create notification (used by other route files) ─── */

export async function createNotification(data: Partial<NotificationDoc> & { title: string }) {
  const db = getFirestore()
  const now = new Date().toISOString()
  const doc: Record<string, unknown> = {
    type: data.type || 'info',
    title: data.title,
    body: data.body || '',
    link: data.link || '',
    portal: data.portal || 'all',
    category: data.category || 'data',
    read: false,
    created_at: now,
    _created_by: data._created_by || 'system',
  }
  if (data.target_user) doc.target_user = data.target_user
  const ref = await db.collection(COLLECTION).add(doc)
  return { id: ref.id, ...doc }
}

/* ─── Routes ─── */

/**
 * GET /api/notifications
 * Query params: portal, category, read (true/false), limit (default 200)
 */
notificationRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const portal = req.query.portal as string | undefined
    const category = req.query.category as string | undefined
    const readFilter = req.query.read as string | undefined
    const limitVal = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 500)

    let query: FirebaseFirestore.Query = db.collection(COLLECTION).orderBy('created_at', 'desc')

    // Filter by portal (include docs matching portal OR 'all')
    if (portal) {
      query = query.where('portal', 'in', [portal, 'all'])
    }

    if (readFilter !== undefined) {
      query = query.where('read', '==', readFilter === 'true')
    }

    query = query.limit(limitVal)
    const snapshot = await query.get()

    let data = snapshot.docs.map(doc => ({
      id: doc.id,
      _id: doc.id,
      ...doc.data(),
    }))

    // Category filter applied in-memory (avoids composite index)
    if (category) {
      data = data.filter(d => (d as Record<string, unknown>).category === category)
    }

    res.json(successResponse(data))
  } catch (err) {
    console.error('GET /api/notifications error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/notifications/:id
 * Mark single notification read
 * Body: { read: true }
 */
notificationRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Notification not found'))
      return
    }

    await docRef.update({
      read: req.body.read ?? true,
      updated_at: new Date().toISOString(),
    })

    res.json(successResponse({ id, read: req.body.read ?? true }))
  } catch (err) {
    console.error('PATCH /api/notifications/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/notifications/read-all
 * Batch mark all unread notifications as read for a portal
 * Query param: portal
 */
notificationRoutes.post('/read-all', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const portal = req.query.portal as string | undefined
    const now = new Date().toISOString()

    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .where('read', '==', false)

    if (portal) {
      query = query.where('portal', 'in', [portal, 'all'])
    }

    const snapshot = await query.limit(500).get()

    if (snapshot.empty) {
      res.json(successResponse({ updated: 0 }))
      return
    }

    const batch = db.batch()
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { read: true, updated_at: now })
    }
    await batch.commit()

    res.json(successResponse({ updated: snapshot.docs.length }))
  } catch (err) {
    console.error('POST /api/notifications/read-all error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
