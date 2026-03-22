import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { OrgUnitDTO } from '@tomachina/core'

export const orgRoutes = Router()
const COLLECTION = 'org'

orgRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).get()
    const units = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse(units, { pagination: { count: units.length, total: units.length } }))
  } catch (err) {
    console.error('GET /api/org error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

orgRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Org unit not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/org/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

orgRoutes.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const orgDoc = await db.collection(COLLECTION).doc(id).get()
    if (!orgDoc.exists) { res.status(404).json(errorResponse('Org unit not found')); return }

    const orgData = orgDoc.data()
    const unitName = orgData?.unit_name || orgData?.entity_name || id

    const snap = await db.collection('users').where('unit', '==', unitName).get()
    const members = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse(members, { pagination: { count: members.length, total: members.length } }))
  } catch (err) {
    console.error('GET /api/org/:id/members error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
