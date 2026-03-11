import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const productRoutes = Router()
const COLLECTION = 'products'

productRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)

    if (req.query.carrier_id) query = query.where('carrier_id', '==', req.query.carrier_id)
    if (req.query.type) query = query.where('product_type', '==', req.query.type)

    const search = (req.query.q as string) || ''
    if (search) {
      const term = search.trim()
      const end = term.slice(0, -1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1)
      query = query.where('product_name', '>=', term).where('product_name', '<', end)
    }

    const snap = await query.limit(500).get()
    const products = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse(products, { count: products.length }))
  } catch (err) {
    console.error('GET /api/products error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

productRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Product not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/products/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
