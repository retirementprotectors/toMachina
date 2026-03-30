/**
 * SENSEI Content CRUD Routes — TRK-SNS-003
 *
 * CRUD for sensei_content collection. One entry per module.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, validateRequired } from '../lib/helpers.js'
import type { SenseiContent, SenseiContentBody } from '@tomachina/core'

export const senseiContentRoutes = Router()
const COLLECTION = 'sensei_content'

/** GET /content — list all */
senseiContentRoutes.get('/content', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).orderBy('title').get()
    const items: SenseiContent[] = snap.docs.map((doc) => ({
      ...(doc.data() as SenseiContent),
      module_id: doc.id,
    }))
    res.json(successResponse(items))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/** GET /content/:moduleId — get by module */
senseiContentRoutes.get('/content/:moduleId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const doc = await db.collection(COLLECTION).doc((req.params.moduleId as string)).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Module ${(req.params.moduleId as string)} not found`))
      return
    }
    res.json(successResponse({ ...(doc.data() as SenseiContent), module_id: doc.id }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/** POST /content — create or upsert */
senseiContentRoutes.post('/content', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['module_id', 'title', 'template_type'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const body = req.body as SenseiContentBody
    const db = getFirestore()
    const now = new Date().toISOString()

    const data: SenseiContent = {
      module_id: body.module_id,
      title: body.title,
      description: body.description || '',
      screenshot_urls: body.screenshot_urls || [],
      stats_query: body.stats_query,
      template_type: body.template_type,
      role_filter: body.role_filter,
      version: 1,
      created_at: now,
      updated_at: now,
    }

    await db.collection(COLLECTION).doc(body.module_id).set(data, { merge: true })
    res.status(201).json(successResponse(data))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/** PATCH /content/:moduleId — update */
senseiContentRoutes.patch('/content/:moduleId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const docRef = db.collection(COLLECTION).doc((req.params.moduleId as string))
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Module ${(req.params.moduleId as string)} not found`))
      return
    }

    const now = new Date().toISOString()
    const existing = doc.data() as SenseiContent
    const updates = {
      ...req.body,
      updated_at: now,
      version: (existing.version || 0) + 1,
    }
    delete (updates as Record<string, unknown>).module_id
    delete (updates as Record<string, unknown>).created_at

    await docRef.update(updates)
    res.json(successResponse({ module_id: (req.params.moduleId as string), ...updates }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/** POST /generate/:moduleId — trigger training generation */
senseiContentRoutes.post('/generate/:moduleId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const doc = await db.collection(COLLECTION).doc((req.params.moduleId as string)).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Module ${(req.params.moduleId as string)} not found`))
      return
    }

    const content = doc.data() as SenseiContent
    const now = new Date().toISOString()
    await db.collection(COLLECTION).doc((req.params.moduleId as string)).update({
      last_generated: now,
      updated_at: now,
    })

    res.json(successResponse({
      module_id: (req.params.moduleId as string),
      status: 'generated',
      last_generated: now,
      title: content.title,
    }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/** GET /:moduleId/training — get training content */
senseiContentRoutes.get('/:moduleId/training', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const doc = await db.collection(COLLECTION).doc((req.params.moduleId as string)).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Module ${(req.params.moduleId as string)} not found`))
      return
    }

    const content = doc.data() as SenseiContent
    res.json(successResponse({
      module_id: (req.params.moduleId as string),
      title: content.title,
      description: content.description,
      screenshot_urls: content.screenshot_urls,
      last_generated: content.last_generated,
      template_type: content.template_type,
    }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/** POST /content/:moduleId/screenshots — update screenshot_urls for a module */
senseiContentRoutes.post('/content/:moduleId/screenshots', async (req: Request, res: Response) => {
  try {
    const moduleId = req.params.moduleId as string
    const db = getFirestore()
    const docRef = db.collection(COLLECTION).doc(moduleId)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse(`Module ${moduleId} not found`))
      return
    }

    const body = req.body as { screenshots?: unknown }
    if (!Array.isArray(body.screenshots)) {
      res.status(400).json(errorResponse('screenshots must be an array of URLs'))
      return
    }

    // Validate each entry is a non-empty string
    const urls = body.screenshots as unknown[]
    for (const url of urls) {
      if (typeof url !== 'string' || url.trim().length === 0) {
        res.status(400).json(errorResponse('All screenshots must be non-empty URL strings'))
        return
      }
    }

    const screenshotUrls = (urls as string[]).map((u) => u.trim())
    const now = new Date().toISOString()
    const existing = doc.data() as SenseiContent

    await docRef.update({
      screenshot_urls: screenshotUrls,
      updated_at: now,
      version: (existing.version || 0) + 1,
    })

    res.json(successResponse({
      module_id: moduleId,
      screenshot_urls: screenshotUrls,
      updated_at: now,
    }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})
