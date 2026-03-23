/**
 * Config Registry API Routes
 * Generic CRUD for platform configs stored in Firestore config_registry collection.
 * Each config is a doc keyed by config name (e.g., dedup_thresholds, carrier_charter_map).
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import { invalidateConfig } from '../lib/config-helper.js'

export const configRoutes = Router()
const COLLECTION = 'config_registry'

// Valid config types — determines which editor the UI renders
const VALID_TYPES = ['sliders', 'table', 'checklist', 'numeric', 'stages', 'year_table'] as const
const VALID_CATEGORIES = ['data_quality', 'financial', 'operations'] as const

function getUserEmail(req: Request): string {
  return (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
}

// GET / — List all config keys with metadata
configRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).get()
    const configs = snap.docs.map(doc => {
      const data = doc.data()
      // Count entries for table/checklist types
      let entry_count = 0
      if (data.entries && Array.isArray(data.entries)) entry_count = data.entries.length
      else if (data.statuses && Array.isArray(data.statuses)) entry_count = data.statuses.length
      else if (data.stages && Array.isArray(data.stages)) entry_count = data.stages.length
      else if (data.years && typeof data.years === 'object') entry_count = Object.keys(data.years).length
      else if (data.products && Array.isArray(data.products)) entry_count = data.products.length

      return {
        key: doc.id,
        type: data.type || 'unknown',
        category: data.category || 'unknown',
        entry_count,
        updated_at: data.updated_at || null,
        _updated_by: data._updated_by || null,
      }
    })

    res.json(successResponse<typeof configs>(configs, { pagination: { count: configs.length, total: configs.length } }))
  } catch (err) {
    console.error('GET /api/config error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:key — Read full config document
configRoutes.get('/:key', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const key = param(req.params.key)
    const doc = await db.collection(COLLECTION).doc(key).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Config not found'))
      return
    }
    res.json(successResponse<Record<string, unknown>>({ key: doc.id, ...doc.data() } as Record<string, unknown>))
  } catch (err) {
    console.error('GET /api/config/:key error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// PUT /:key — Update config (versioned)
configRoutes.put('/:key', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const key = param(req.params.key)
    const userEmail = getUserEmail(req)
    const now = new Date().toISOString()
    const body = req.body as Record<string, unknown>

    // Validate type and category if provided
    if (body.type && !VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
      res.status(400).json(errorResponse('Invalid config type. Must be one of: ' + VALID_TYPES.join(', ')))
      return
    }
    if (body.category && !VALID_CATEGORIES.includes(body.category as typeof VALID_CATEGORIES[number])) {
      res.status(400).json(errorResponse('Invalid category. Must be one of: ' + VALID_CATEGORIES.join(', ')))
      return
    }

    // Type-specific validation
    const configType = body.type as string
    if (configType === 'sliders' || configType === 'numeric') {
      // Validate numeric values are within range
      for (const [field, value] of Object.entries(body)) {
        if (['type', 'category', 'updated_at', '_updated_by'].includes(field)) continue
        if (typeof value === 'number' && (value < 0 || value > 10000)) {
          res.status(400).json(errorResponse('Numeric value out of range (0-10000) for field: ' + field))
          return
        }
      }
    }

    if (configType === 'table' && body.entries) {
      if (!Array.isArray(body.entries)) {
        res.status(400).json(errorResponse('entries must be an array'))
        return
      }
    }

    if (configType === 'checklist' && body.statuses) {
      if (!Array.isArray(body.statuses)) {
        res.status(400).json(errorResponse('statuses must be an array'))
        return
      }
      // Check for duplicates
      const unique = new Set(body.statuses as string[])
      if (unique.size !== (body.statuses as string[]).length) {
        res.status(400).json(errorResponse('Duplicate statuses found'))
        return
      }
    }

    // Merge updates with metadata — strip 'key' so it doesn't get stored as a field
    const { key: _key, ...rest } = body
    const updates = {
      ...rest,
      updated_at: now,
      _updated_by: userEmail,
    }

    await db.collection(COLLECTION).doc(key).set(updates, { merge: true })

    // Invalidate cache
    invalidateConfig(key)

    res.json(successResponse<{ key: string; updated_at: string }>({ key, updated_at: now }))
  } catch (err) {
    console.error('PUT /api/config/:key error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
