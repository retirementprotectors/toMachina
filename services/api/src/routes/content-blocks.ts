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
import type { ContentBlockDTO, ContentBlockCreateDTO, ContentBlockUpdateResult, ContentBlockDeleteResult } from '@tomachina/core'
import { randomUUID } from 'crypto'
import { getConfig } from '../lib/config-helper.js'

export const contentBlockRoutes = Router()
const COLLECTION = 'content_blocks'

// Default block type prefixes — fallback when config_registry/content_block_types unavailable
const DEFAULT_TYPE_PREFIX: Record<string, string> = {
  SubjectLine: 'SUBJ',
  Greeting: 'GRT',
  Introduction: 'INT',
  ValueProp: 'VP',
  PainPoint: 'PP',
  CTA: 'CTA',
  Signature: 'SIG',
  Compliance: 'COMP',
  TextTemplate: 'TXT',
  VMScript: 'VM',
  EmailBody: 'EM',
}

/** Resolve type prefix from config registry, falling back to hardcoded defaults */
async function getTypePrefix(blockType: string): Promise<string> {
  const config = await getConfig<{ types: Array<{ name: string; prefix: string }> }>(
    'content_block_types',
    { types: Object.entries(DEFAULT_TYPE_PREFIX).map(([name, prefix]) => ({ name, prefix, description: '' })) }
  )
  const match = config.types?.find(t => t.name === blockType)
  return match?.prefix || DEFAULT_TYPE_PREFIX[blockType] || 'BLK'
}

// ============================================================================
// LIST
// ============================================================================

/**
 * GET /api/content-blocks
 * List blocks with optional filters: type, status, pillar, channel, owner
 */
contentBlockRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.type) query = query.where('block_type', '==', req.query.type)
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.pillar) query = query.where('pillar', '==', req.query.pillar)
    if (req.query.channel) query = query.where('channel', '==', req.query.channel)
    if (req.query.owner) query = query.where('owner', '==', req.query.owner)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse<ContentBlockDTO[]>(data as unknown as ContentBlockDTO[], { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/content-blocks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET BY ID
// ============================================================================

contentBlockRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Content block not found')); return }
    res.json(successResponse<ContentBlockDTO>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>) as unknown as ContentBlockDTO))
  } catch (err) {
    console.error('GET /api/content-blocks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CREATE
// ============================================================================

const createValidation = validateWrite({
  required: ['block_type', 'content'],
  types: {
    block_type: 'string',
    content: 'string',
    block_name: 'string',
    name: 'string',
    pillar: 'string',
    channel: 'string',
    owner: 'string',
  },
})

contentBlockRoutes.post('/', createValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const blockType = String(req.body.block_type || req.body.type || 'TXT')
    const prefix = await getTypePrefix(blockType)
    const blockId = `${prefix}_${randomUUID().slice(0, 8)}`

    const data: Record<string, unknown> = {
      block_id: blockId,
      block_type: blockType,
      ...req.body,
      status: req.body.status || 'Draft',
      version: req.body.version || '1.0',
      character_count: String(req.body.content || '').length,
      created_at: now,
      updated_at: now,
    }

    await db.collection(COLLECTION).doc(blockId).set(data)
    await writeThroughBridge(COLLECTION, 'insert', blockId, data)

    res.status(201).json(successResponse<ContentBlockCreateDTO>({ id: blockId, ...data } as unknown as ContentBlockCreateDTO))
  } catch (err) {
    console.error('POST /api/content-blocks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// UPDATE
// ============================================================================

contentBlockRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Content block not found')); return }

    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    }

    // Recalculate character count if content changed
    if (updates.content) {
      updates.character_count = String(updates.content).length
    }

    await docRef.update(updates)
    await writeThroughBridge(COLLECTION, 'update', id, updates)

    res.json(successResponse<ContentBlockUpdateResult>({ id, updated: Object.keys(updates) } as unknown as ContentBlockUpdateResult))
  } catch (err) {
    console.error('PATCH /api/content-blocks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// DELETE (soft)
// ============================================================================

contentBlockRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Content block not found')); return }

    const updates = { status: 'Archived', updated_at: new Date().toISOString() }
    await docRef.update(updates)
    await writeThroughBridge(COLLECTION, 'update', id, updates)

    res.json(successResponse<ContentBlockDeleteResult>({ id, deleted: true } as unknown as ContentBlockDeleteResult))
  } catch (err) {
    console.error('DELETE /api/content-blocks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
