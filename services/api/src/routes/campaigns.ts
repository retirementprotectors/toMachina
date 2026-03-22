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
import { assembleCampaign, assembleCampaignFull, type MergeContext } from '../lib/campaign-assembler.js'
import { randomUUID } from 'crypto'

export const campaignRoutes = Router()
const COLLECTION = 'campaigns'

campaignRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.type) query = query.where('campaign_type', '==', req.query.type)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/campaigns error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

campaignRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Campaign not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/campaigns/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

campaignRoutes.get('/:id/templates', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const snap = await db.collection('templates').where('campaign_id', '==', id).get()
    const templates = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse(templates, { pagination: { count: templates.length, total: templates.length } }))
  } catch (err) {
    console.error('GET /api/campaigns/:id/templates error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ASSEMBLE
// ============================================================================

/**
 * POST /api/campaigns/:id/assemble
 * Assemble all templates in a campaign: resolve blocks, apply merge fields.
 * Body: { template_id?: string, merge_context?: MergeContext }
 * If template_id provided, assembles that one template. Otherwise assembles all.
 */
campaignRoutes.post('/:id/assemble', async (req: Request, res: Response) => {
  try {
    const id = param(req.params.id)
    const { template_id, merge_context } = req.body || {}
    const ctx = merge_context as MergeContext | undefined

    if (template_id) {
      const result = await assembleCampaign(id, template_id, ctx)
      res.json(successResponse(result))
    } else {
      const results = await assembleCampaignFull(id, ctx)
      res.json(successResponse(results, { pagination: { count: results.length, total: results.length } }))
    }
  } catch (err) {
    console.error('POST /api/campaigns/:id/assemble error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PREVIEW
// ============================================================================

/**
 * GET /api/campaigns/:id/preview
 * Preview assembled content for a campaign (no merge field replacement).
 */
campaignRoutes.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const id = param(req.params.id)
    const results = await assembleCampaignFull(id)
    res.json(successResponse(results, { pagination: { count: results.length, total: results.length }, note: 'Merge fields left unresolved' }))
  } catch (err) {
    console.error('GET /api/campaigns/:id/preview error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SCHEDULE
// ============================================================================

/**
 * POST /api/campaigns/:id/schedule
 * Schedule a campaign send. Creates a job record.
 * Body: { scheduled_for: string, target_criteria?: object }
 */
const scheduleValidation = validateWrite({
  required: ['scheduled_for'],
  types: { scheduled_for: 'string' },
})

campaignRoutes.post('/:id/schedule', scheduleValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const now = new Date().toISOString()
    const userEmail = ((req as unknown as Record<string, unknown>).user as Record<string, string> | undefined)?.email || 'api'

    // Verify campaign exists
    const campDoc = await db.collection(COLLECTION).doc(id).get()
    if (!campDoc.exists) { res.status(404).json(errorResponse('Campaign not found')); return }

    const jobId = `JOB_${randomUUID().slice(0, 8)}`
    const jobData = {
      job_id: jobId,
      campaign_id: id,
      scheduled_for: req.body.scheduled_for,
      target_criteria: req.body.target_criteria || null,
      status: 'scheduled',
      _created_by: userEmail,
      created_at: now,
      updated_at: now,
    }

    await db.collection('campaign_jobs').doc(jobId).set(jobData)

    res.status(201).json(successResponse(jobData))
  } catch (err) {
    console.error('POST /api/campaigns/:id/schedule error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// DUPLICATE
// ============================================================================

/**
 * POST /api/campaigns/:id/duplicate
 * Clone a campaign and all its templates.
 */
campaignRoutes.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const now = new Date().toISOString()

    // Read source campaign
    const campDoc = await db.collection(COLLECTION).doc(id).get()
    if (!campDoc.exists) { res.status(404).json(errorResponse('Campaign not found')); return }

    const original = campDoc.data() as Record<string, unknown>
    const newCampaignId = `CAMP_${randomUUID().slice(0, 8)}`
    const newName = `${original.name || original.campaign_name || 'Campaign'} (Copy)`

    const newCampaign: Record<string, unknown> = {
      ...original,
      campaign_id: newCampaignId,
      name: newName,
      campaign_name: newName,
      status: 'Draft',
      created_at: now,
      updated_at: now,
    }
    delete newCampaign._migrated_at
    delete newCampaign._source

    await db.collection(COLLECTION).doc(newCampaignId).set(newCampaign)

    // Clone templates
    const templateSnap = await db.collection('templates').where('campaign_id', '==', id).get()
    let clonedTemplates = 0

    const batch = db.batch()
    for (const tDoc of templateSnap.docs) {
      const tData = tDoc.data() as Record<string, unknown>
      const newTemplateId = `TMPL_${randomUUID().slice(0, 8)}`
      const newTemplate: Record<string, unknown> = {
        ...tData,
        template_id: newTemplateId,
        campaign_id: newCampaignId,
        status: 'draft',
        created_at: now,
        updated_at: now,
      }
      delete newTemplate._migrated_at
      delete newTemplate._source
      batch.set(db.collection('templates').doc(newTemplateId), newTemplate)
      clonedTemplates++
    }

    if (clonedTemplates > 0) await batch.commit()

    await writeThroughBridge(COLLECTION, 'insert', newCampaignId, newCampaign)

    res.status(201).json(successResponse({
      campaign_id: newCampaignId,
      name: newName,
      cloned_templates: clonedTemplates,
    }))
  } catch (err) {
    console.error('POST /api/campaigns/:id/duplicate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
