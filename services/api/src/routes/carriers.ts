import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { CarrierDTO } from '@tomachina/core'

export const carrierRoutes = Router()
const COLLECTION = 'carriers'

carrierRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)

    const search = (req.query.q as string) || ''
    if (search) {
      const term = search.trim()
      const end = term.slice(0, -1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1)
      query = query.where('carrier_name', '>=', term).where('carrier_name', '<', end)
    }

    const snap = await query.limit(200).get()
    const carriers = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse<unknown>(carriers, { pagination: { count: carriers.length, total: carriers.length } }))
  } catch (err) {
    console.error('GET /api/carriers error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

carrierRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Carrier not found')); return }
    res.json(successResponse<unknown>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/carriers/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
