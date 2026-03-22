import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { UserDTO } from '@tomachina/core'
import { requireLevel, invalidateProfileCache } from '../middleware/rbac.js'

export const userRoutes = Router()
const COLLECTION = 'users'

userRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).get()
    const users = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse<unknown>(users, { pagination: { count: users.length, total: users.length } }))
  } catch (err) {
    console.error('GET /api/users error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

userRoutes.get('/me', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const email = (req as unknown as { user?: { email?: string } }).user?.email
    if (!email) { res.status(401).json(errorResponse('No authenticated user')); return }

    const doc = await db.collection(COLLECTION).doc(email).get()
    if (!doc.exists) {
      res.json(successResponse<unknown>({ id: email, email, role: 'USER', level: 3, status: 'active', _note: 'Profile not found in users collection' }))
      return
    }
    res.json(successResponse<unknown>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/users/me error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

userRoutes.get('/:email', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const email = param(req.params.email)
    const doc = await db.collection(COLLECTION).doc(email).get()
    if (!doc.exists) { res.status(404).json(errorResponse('User not found')); return }
    res.json(successResponse<unknown>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/users/:email error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

userRoutes.patch('/:email', requireLevel('EXECUTIVE'), async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const requestingUser = (req as unknown as { user?: { email?: string } }).user?.email
    const email = param(req.params.email)

    const docRef = db.collection(COLLECTION).doc(email)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('User not found')); return }

    const updates = { ...req.body, updated_at: new Date().toISOString(), _updated_by: requestingUser }
    delete updates.email; delete updates.id; delete updates.created_at
    await docRef.update(updates)

    invalidateProfileCache(email)

    const updated = await docRef.get()
    res.json(successResponse<unknown>(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/users/:email error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
