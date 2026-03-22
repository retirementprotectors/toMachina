import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const specialistConfigRoutes = Router()
const COLLECTION = 'specialist_configs'

// ─── GET / — list specialist configs with optional filters ───
specialistConfigRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection(COLLECTION).orderBy('specialist_name', 'asc').get()
    let data: Record<string, unknown>[] = snapshot.docs.map(doc =>
      stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)
    )

    // Filters
    if (req.query.territory_id) {
      data = data.filter(d => d.territory_id === req.query.territory_id)
    }
    if (req.query.status) {
      data = data.filter(d => d.status === req.query.status)
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 500)
    const total = data.length
    data = data.slice(0, limit)

    res.json(successResponse(data, { pagination: { count: data.length, total, hasMore: total > limit } }))
  } catch (err) {
    console.error('GET /api/specialist-configs error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── GET /:id — single specialist config ───
specialistConfigRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Specialist config not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/specialist-configs/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST / — create specialist config ───
specialistConfigRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { specialist_name, territory_id } = req.body as Record<string, unknown>
    if (!specialist_name) { res.status(400).json(errorResponse('specialist_name is required')); return }
    if (!territory_id) { res.status(400).json(errorResponse('territory_id is required')); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const configId = db.collection(COLLECTION).doc().id
    const email = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    const configData: Record<string, unknown> = {
      ...req.body,
      config_id: configId,
      status: (req.body as Record<string, unknown>).status || (req.body as Record<string, unknown>).config_status || 'Active',
      tier_map: (req.body as Record<string, unknown>).tier_map || [],
      office_days: (req.body as Record<string, unknown>).office_days || [],
      field_days: (req.body as Record<string, unknown>).field_days || [],
      slot_templates: (req.body as Record<string, unknown>).slot_templates || [],
      meeting_criteria: (req.body as Record<string, unknown>).meeting_criteria || {},
      zone_lead_criteria: (req.body as Record<string, unknown>).zone_lead_criteria || {},
      team: (req.body as Record<string, unknown>).team || [],
      created_at: now,
      updated_at: now,
      _created_by: email,
    }

    await db.collection(COLLECTION).doc(configId).set(configData)

    res.status(201).json(successResponse(stripInternalFields({ id: configId, ...configData })))
  } catch (err) {
    console.error('POST /api/specialist-configs error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── PATCH /:id — update specialist config ───
specialistConfigRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Specialist config not found')); return }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    } as Record<string, unknown>
    delete updates.config_id
    delete updates.id
    delete updates.created_at

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/specialist-configs/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
