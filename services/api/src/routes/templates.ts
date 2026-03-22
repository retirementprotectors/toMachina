import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  stripInternalFields,
  param,
  writeThroughBridge,
} from '../lib/helpers.js'
import type { TemplateDTO } from '@tomachina/core'
import { randomUUID } from 'crypto'

export const templateRoutes = Router()
const COLLECTION = 'templates'

// ============================================================================
// LIST
// ============================================================================

/**
 * GET /api/templates
 * List templates with optional filters: status, channel, type, campaign_id
 */
templateRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.channel) query = query.where('channel', '==', req.query.channel)
    if (req.query.type) query = query.where('template_type', '==', req.query.type)
    if (req.query.campaign_id) query = query.where('campaign_id', '==', req.query.campaign_id)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/templates error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET BY ID
// ============================================================================

/**
 * GET /api/templates/:id
 * Get template detail including resolved block names
 */
templateRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Template not found')); return }

    const template = { id: doc.id, ...doc.data() } as Record<string, unknown>

    // Resolve block names for slot assignments
    const slotKeys = [
      'subject_block', 'greeting_block', 'intro_block', 'valueprop_block',
      'painpoint_block', 'cta_block', 'signature_block', 'compliance_block',
    ]
    const blockIds = slotKeys
      .map((k) => template[k] as string | undefined)
      .filter(Boolean) as string[]

    if (blockIds.length > 0) {
      const blockSnap = await db.collection('content_blocks').where('block_id', 'in', blockIds.slice(0, 30)).get()
      const blockNames: Record<string, string> = {}
      blockSnap.docs.forEach((d) => {
        const data = d.data()
        const bid = (data.block_id as string) || d.id
        blockNames[bid] = (data.block_name as string) || (data.name as string) || bid
      })
      template._resolved_blocks = blockNames
    }

    res.json(successResponse(stripInternalFields(template)))
  } catch (err) {
    console.error('GET /api/templates/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CREATE
// ============================================================================

const createValidation = validateWrite({
  required: ['campaign_id', 'channel'],
  types: {
    campaign_id: 'string',
    channel: 'string',
    touchpoint: 'string',
    touchpoint_day: 'string',
    name: 'string',
    template_name: 'string',
  },
})

templateRoutes.post('/', createValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const templateId = `TMPL_${randomUUID().slice(0, 8)}`

    const data: Record<string, unknown> = {
      template_id: templateId,
      ...req.body,
      status: req.body.status || 'draft',
      created_at: now,
      updated_at: now,
    }

    await db.collection(COLLECTION).doc(templateId).set(data)
    await writeThroughBridge(COLLECTION, 'insert', templateId, data)

    res.status(201).json(successResponse({ id: templateId, ...data }))
  } catch (err) {
    console.error('POST /api/templates error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// UPDATE
// ============================================================================

templateRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Template not found')); return }

    const updates = { ...req.body, updated_at: new Date().toISOString() }
    await docRef.update(updates)
    await writeThroughBridge(COLLECTION, 'update', id, updates)

    res.json(successResponse({ id, updated: Object.keys(updates) }))
  } catch (err) {
    console.error('PATCH /api/templates/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// DELETE (soft)
// ============================================================================

templateRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Template not found')); return }

    const updates = { status: 'archived', updated_at: new Date().toISOString() }
    await docRef.update(updates)
    await writeThroughBridge(COLLECTION, 'update', id, updates)

    res.json(successResponse({ id, deleted: true }))
  } catch (err) {
    console.error('DELETE /api/templates/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
