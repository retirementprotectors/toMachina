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
    res.json(successResponse<CarrierDTO[]>(carriers as unknown as CarrierDTO[], { pagination: { count: carriers.length, total: carriers.length } }))
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
    res.json(successResponse<CarrierDTO>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>) as unknown as CarrierDTO))
  } catch (err) {
    console.error('GET /api/carriers/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /api/carriers/seed-from-accounts — Extract unique carriers from account docs and populate carriers collection
carrierRoutes.post('/seed-from-accounts', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const dryRun = req.query.dry_run === 'true'

    // Collection group query across all clients/{clientId}/accounts
    const accountSnap = await db.collectionGroup('accounts').get()
    const carrierNames = new Set<string>()

    for (const doc of accountSnap.docs) {
      const data = doc.data()
      const name = (data.carrier_name as string) || (data.carrier as string) || ''
      if (name.trim()) {
        carrierNames.add(name.trim())
      }
    }

    if (dryRun) {
      res.json(successResponse({ carriers: Array.from(carrierNames).sort(), count: carrierNames.size, dry_run: true }))
      return
    }

    // Check existing carriers to avoid duplicates
    const existingSnap = await db.collection(COLLECTION).get()
    const existing = new Set(existingSnap.docs.map((d) => (d.data().carrier_name as string) || ''))

    const now = new Date().toISOString()
    const batch = db.batch()
    let created = 0

    for (const name of carrierNames) {
      if (existing.has(name)) continue
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const ref = db.collection(COLLECTION).doc(slug)
      batch.set(ref, {
        carrier_name: name,
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      created++
    }

    if (created > 0) {
      await batch.commit()
    }

    res.json(successResponse({
      total_unique_carriers: carrierNames.size,
      already_existed: existing.size,
      created,
      carriers: Array.from(carrierNames).sort(),
    }))
  } catch (err) {
    console.error('POST /api/carriers/seed-from-accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
