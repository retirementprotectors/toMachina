import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import type { UnitDefaultDTO } from '@tomachina/core'
import { requireLevel } from '../middleware/rbac.js'

export const unitDefaultRoutes = Router()
const COLLECTION = 'unit_module_defaults'

/**
 * GET /api/unit-defaults
 * List all unit module defaults.
 */
unitDefaultRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).get()
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    res.json(successResponse(items, { pagination: { count: items.length, total: items.length } }))
  } catch (err) {
    console.error('GET /api/unit-defaults error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PUT /api/unit-defaults/:unitKey
 * Update a single unit module default. OWNER only.
 */
unitDefaultRoutes.put('/:unitKey', requireLevel('OWNER'), async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const unitKey = param(req.params.unitKey).toUpperCase()
    const { label, description, modules } = req.body as {
      label?: string
      description?: string
      modules?: string[]
    }

    if (!unitKey) {
      res.status(400).json(errorResponse('unitKey is required'))
      return
    }

    if (modules && !Array.isArray(modules)) {
      res.status(400).json(errorResponse('modules must be an array of strings'))
      return
    }

    // Build update payload — only include provided fields
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (label !== undefined) update.label = label
    if (description !== undefined) update.description = description
    if (modules !== undefined) update.modules = modules

    const docRef = db.collection(COLLECTION).doc(unitKey)
    const existing = await docRef.get()

    if (existing.exists) {
      await docRef.update(update)
    } else {
      // Create new unit default
      if (!label || !modules) {
        res.status(400).json(errorResponse('label and modules are required when creating a new unit default'))
        return
      }
      await docRef.set(update)
    }

    const updated = await docRef.get()
    res.json(successResponse({ id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('PUT /api/unit-defaults/:unitKey error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
