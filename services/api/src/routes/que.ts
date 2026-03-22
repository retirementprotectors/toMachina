import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { QueSessionDetailData, QueSessionCreateResult } from '@tomachina/core'

export const queRoutes = Router()

const SESSIONS = 'que_sessions'
const QUOTES = 'que_quotes'
const RECOMMENDATIONS = 'que_recommendations'

function getUserEmail(req: Request): string {
  return (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
}

// GET / — List sessions
queRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query = db.collection(SESSIONS).orderBy('created_at', 'desc').limit(100)
    if (req.query.product_line) {
      query = db.collection(SESSIONS).where('product_line', '==', req.query.product_line).orderBy('created_at', 'desc').limit(100)
    }
    const snap = await query.get()
    const sessions = snap.docs.map(d => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))
    res.json(successResponse<unknown>(sessions, { pagination: { count: sessions.length, total: sessions.length } }))
  } catch (err) {
    console.error('GET /api/que error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST / — Create session
queRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const userEmail = getUserEmail(req)
    const now = new Date().toISOString()
    const { product_line, household_id } = req.body as { product_line: string; household_id?: string }
    if (!product_line) { res.status(400).json(errorResponse('product_line is required')); return }
    const session_id = `QUE-${Date.now()}`
    const data = {
      session_id, product_line, household_id: household_id || '', status: 'draft',
      client_snapshot: null, quote_ids: [] as string[], selected_quote_ids: [] as string[],
      recommendation_id: null, output_ids: [] as string[], assigned_to: userEmail,
      _created_by: userEmail, created_at: now, updated_at: now,
    }
    await db.collection(SESSIONS).doc(session_id).set(data)
    res.status(201).json(successResponse<unknown>({ session_id }))
  } catch (err) {
    console.error('POST /api/que error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:sessionId — Get session with quotes + recommendation
queRoutes.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const sessionId = param(req.params.sessionId)
    const doc = await db.collection(SESSIONS).doc(sessionId).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Session not found')); return }
    const session = stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)
    const quoteIds = (session.quote_ids as string[]) || []
    let quotes: Record<string, unknown>[] = []
    if (quoteIds.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < quoteIds.length; i += 30) chunks.push(quoteIds.slice(i, i + 30))
      for (const chunk of chunks) {
        const snap = await db.collection(QUOTES).where('quote_id', 'in', chunk).get()
        quotes.push(...snap.docs.map(d => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>)))
      }
    }
    let recommendation: Record<string, unknown> | null = null
    const recId = session.recommendation_id as string | null
    if (recId) {
      const recDoc = await db.collection(RECOMMENDATIONS).doc(recId).get()
      if (recDoc.exists) recommendation = stripInternalFields({ id: recDoc.id, ...recDoc.data() } as Record<string, unknown>)
    }
    res.json(successResponse<unknown>({ ...session, quotes, recommendation }))
  } catch (err) {
    console.error('GET /api/que/:sessionId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:sessionId/quote — Add a quote
queRoutes.post('/:sessionId/quote', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const userEmail = getUserEmail(req)
    const sessionId = param(req.params.sessionId)
    const now = new Date().toISOString()
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get()
    if (!sessionDoc.exists) { res.status(404).json(errorResponse('Session not found')); return }
    const { carrier_name, product_name, premium_annual, premium_monthly, details, source_id } = req.body as {
      carrier_name: string; product_name: string; premium_annual?: number; premium_monthly?: number
      details?: Record<string, unknown>; source_id?: string
    }
    if (!carrier_name || !product_name) { res.status(400).json(errorResponse('carrier_name and product_name are required')); return }
    const quote_id = `QUOTE-${Date.now()}`
    const quoteData = {
      quote_id, session_id: sessionId, source_id: source_id || 'manual',
      carrier_name, product_name, premium_annual: premium_annual || null,
      premium_monthly: premium_monthly || null, details: details || {},
      score: null, rank: null, flags: [] as string[],
      _created_by: userEmail, fetched_at: now, created_at: now,
    }
    await db.collection(QUOTES).doc(quote_id).set(quoteData)
    const sessionStatus = (sessionDoc.data()?.status === 'draft') ? 'quoting' : sessionDoc.data()?.status
    await db.collection(SESSIONS).doc(sessionId).update({
      quote_ids: FieldValue.arrayUnion(quote_id), status: sessionStatus,
      updated_at: now, _updated_by: userEmail,
    })
    res.status(201).json(successResponse<unknown>({ quote_id }))
  } catch (err) {
    console.error('POST /api/que/:sessionId/quote error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// PATCH /:sessionId — Update session fields
queRoutes.patch('/:sessionId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const userEmail = getUserEmail(req)
    const sessionId = param(req.params.sessionId)
    const now = new Date().toISOString()
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get()
    if (!sessionDoc.exists) { res.status(404).json(errorResponse('Session not found')); return }
    const updates = { ...req.body } as Record<string, unknown>
    delete updates.session_id; delete updates.created_at; delete updates._created_by
    updates.updated_at = now; updates._updated_by = userEmail
    await db.collection(SESSIONS).doc(sessionId).update(updates)
    res.json(successResponse<unknown>({ session_id: sessionId, updated: Object.keys(req.body as Record<string, unknown>) }))
  } catch (err) {
    console.error('PATCH /api/que/:sessionId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:sessionId/recommendation — Save recommendation
queRoutes.post('/:sessionId/recommendation', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const userEmail = getUserEmail(req)
    const sessionId = param(req.params.sessionId)
    const now = new Date().toISOString()
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get()
    if (!sessionDoc.exists) { res.status(404).json(errorResponse('Session not found')); return }
    const { solution_category, selected_products, advisor_notes, product_line } = req.body as {
      solution_category: string; advisor_notes: string; product_line: string
      selected_products: Array<{ quote_id: string; carrier_name: string; product_name: string; rationale: string }>
    }
    const recommendation_id = `REC-${Date.now()}`
    const recData = {
      recommendation_id, session_id: sessionId,
      household_id: sessionDoc.data()?.household_id || '',
      product_line: product_line || sessionDoc.data()?.product_line || '',
      solution_category: solution_category || '', selected_products: selected_products || [],
      advisor_notes: advisor_notes || '', _created_by: userEmail, created_at: now, updated_at: now,
    }
    await db.collection(RECOMMENDATIONS).doc(recommendation_id).set(recData)
    await db.collection(SESSIONS).doc(sessionId).update({
      recommendation_id, status: 'recommending', updated_at: now, _updated_by: userEmail,
    })
    res.status(201).json(successResponse<unknown>({ recommendation_id }))
  } catch (err) {
    console.error('POST /api/que/:sessionId/recommendation error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:sessionId/generate-output — Generate output docs (stub)
queRoutes.post('/:sessionId/generate-output', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const sessionId = param(req.params.sessionId)
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get()
    if (!sessionDoc.exists) { res.status(404).json(errorResponse('Session not found')); return }
    const outputs = [
      { key: 'client_summary', status: 'pending' as const, drive_url: null },
      { key: 'comparison_report', status: 'pending' as const, drive_url: null },
      { key: 'suitability_letter', status: 'pending' as const, drive_url: null },
      { key: 'illustration_request', status: 'pending' as const, drive_url: null },
      { key: 'meeting_prep', status: 'pending' as const, drive_url: null },
    ]
    res.json(successResponse<unknown>({ outputs }))
  } catch (err) {
    console.error('POST /api/que/:sessionId/generate-output error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:sessionId/complete — Mark session complete
queRoutes.post('/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const userEmail = getUserEmail(req)
    const sessionId = param(req.params.sessionId)
    const now = new Date().toISOString()
    const sessionDoc = await db.collection(SESSIONS).doc(sessionId).get()
    if (!sessionDoc.exists) { res.status(404).json(errorResponse('Session not found')); return }
    await db.collection(SESSIONS).doc(sessionId).update({
      status: 'complete', finalized_at: now, updated_at: now, _updated_by: userEmail,
    })
    res.json(successResponse<unknown>({ session_id: sessionId, status: 'complete' }))
  } catch (err) {
    console.error('POST /api/que/:sessionId/complete error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
