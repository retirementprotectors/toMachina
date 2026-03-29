import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import {
  successResponse,
  errorResponse,
  validateRequired,
} from '../lib/helpers.js'
import type {
  SenseiAnalyticsEvent,
  SenseiEventType,
  SenseiHeatmapDTO,
  SenseiModuleHeatmapRow,
  SenseiTopDTO,
  SenseiTopModuleRow,
  SenseiLogBody,
} from '@tomachina/core'

export const senseiAnalyticsRoutes = Router()
const COLLECTION = 'sensei_analytics'

/** Valid event types for validation. */
const VALID_EVENT_TYPES: SenseiEventType[] = ['train_response', 'voltron_query', 'popup_view']

/** Parse a period query param into a cutoff Date. */
function periodCutoff(period: string): Date {
  const now = new Date()
  switch (period) {
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '7d':
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
}

/** Normalize period param to valid value. */
function normalizePeriod(raw: unknown): '7d' | '30d' | '90d' {
  if (raw === '30d' || raw === '90d') return raw
  return '7d'
}

// ============================================================================
// POST /api/sensei/analytics/log — Log a single event
// ============================================================================

senseiAnalyticsRoutes.post('/log', async (req: Request, res: Response) => {
  try {
    const body = req.body as SenseiLogBody

    const missing = validateRequired(body as unknown as Record<string, unknown>, [
      'event_type',
      'module_id',
      'module_label',
      'user_id',
    ])
    if (missing) {
      res.status(400).json(errorResponse(missing))
      return
    }

    if (!VALID_EVENT_TYPES.includes(body.event_type)) {
      res.status(400).json(errorResponse(`Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`))
      return
    }

    const db = getFirestore()
    const event: SenseiAnalyticsEvent = {
      event_id: randomUUID(),
      event_type: body.event_type,
      module_id: body.module_id,
      module_label: body.module_label,
      user_id: body.user_id,
      user_email: body.user_email || undefined,
      metadata: body.metadata || undefined,
      created_at: new Date().toISOString(),
    }

    await db.collection(COLLECTION).doc(event.event_id).set(event)

    res.status(201).json(successResponse(event))
  } catch (err) {
    console.error('POST /api/sensei/analytics/log error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET /api/sensei/analytics/heatmap — Aggregated counts by module
// ============================================================================

senseiAnalyticsRoutes.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const period = normalizePeriod(req.query.period)
    const cutoff = periodCutoff(period)

    let query: Query<DocumentData> = db.collection(COLLECTION)
    query = query.where('created_at', '>=', cutoff.toISOString())

    const snap = await query.get()
    const moduleMap = new Map<string, SenseiModuleHeatmapRow>()

    for (const doc of snap.docs) {
      const d = doc.data() as SenseiAnalyticsEvent
      const key = d.module_id

      if (!moduleMap.has(key)) {
        moduleMap.set(key, {
          module_id: d.module_id,
          module_label: d.module_label,
          total: 0,
          train_response: 0,
          voltron_query: 0,
          popup_view: 0,
        })
      }

      const row = moduleMap.get(key)!
      row.total++
      row[d.event_type]++
    }

    const modules = Array.from(moduleMap.values()).sort((a, b) => b.total - a.total)

    res.json(successResponse<SenseiHeatmapDTO>({ period, modules }))
  } catch (err) {
    console.error('GET /api/sensei/analytics/heatmap error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET /api/sensei/analytics/top — Top-10 most-queried modules
// ============================================================================

senseiAnalyticsRoutes.get('/top', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const period = normalizePeriod(req.query.period)
    const cutoff = periodCutoff(period)

    let query: Query<DocumentData> = db.collection(COLLECTION)
    query = query.where('created_at', '>=', cutoff.toISOString())

    const snap = await query.get()
    const moduleMap = new Map<string, Omit<SenseiTopModuleRow, 'rank'>>()

    for (const doc of snap.docs) {
      const d = doc.data() as SenseiAnalyticsEvent
      const key = d.module_id

      if (!moduleMap.has(key)) {
        moduleMap.set(key, {
          module_id: d.module_id,
          module_label: d.module_label,
          total: 0,
          train_response: 0,
          voltron_query: 0,
          popup_view: 0,
        })
      }

      const row = moduleMap.get(key)!
      row.total++
      row[d.event_type]++
    }

    const sorted = Array.from(moduleMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const modules: SenseiTopModuleRow[] = sorted.map((m, i) => ({ rank: i + 1, ...m }))

    res.json(successResponse<SenseiTopDTO>({ period, modules }))
  } catch (err) {
    console.error('GET /api/sensei/analytics/top error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
