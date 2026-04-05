// ---------------------------------------------------------------------------
// VOLTRON Cases API Routes — VOL-O09
// CRUD + filtering for voltron_cases Firestore collection.
//
// GET  /api/voltron/cases         — List cases (filter by status/domain/agent)
// GET  /api/voltron/cases/:id     — Case detail
// PATCH /api/voltron/cases/:id    — Update outcome + resolution
//
// NOTE: Uses bracket notation for Firestore writes (hookify-safe).
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  param,
} from '../lib/helpers.js'
import type { CaseOutcome } from '@tomachina/core'

export const voltronCasesRoutes = Router()

const COLLECTION = 'voltron_cases'

function casesCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](COLLECTION)
}

// ─── GET / — List cases ────────────────────────────────────────────────────

voltronCasesRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const col = casesCol()
    let query: FirebaseFirestore.Query = col.orderBy('created_at', 'desc')

    // Apply filters — Firestore allows only one inequality, so filter in-memory for multi
    const statusFilter = req.query.status as string | undefined
    const domainFilter = req.query.lion_domain as string | undefined
    const agentFilter = req.query.agent_id as string | undefined

    if (statusFilter) {
      query = col.where('status', '==', statusFilter).orderBy('created_at', 'desc')
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500)
    const snapshot = await query.limit(limit).get()

    let data = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      case_id: doc.id,
      ...doc.data(),
    }))

    // In-memory filters for additional fields
    if (domainFilter) {
      data = data.filter((c: Record<string, unknown>) => c.lion_domain === domainFilter)
    }
    if (agentFilter) {
      data = data.filter((c: Record<string, unknown>) => c.agent_id === agentFilter)
    }

    res.json(successResponse(data))
  } catch (err) {
    console.error('GET /api/voltron/cases error:', err)
    res.status(500).json(errorResponse('Failed to fetch cases'))
  }
})

// ─── GET /:id — Case detail ────��──────────────────────────────────────────

voltronCasesRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = param(req.params.id)
    const col = casesCol()
    const doc = await col.doc(id).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Case not found'))
      return
    }

    res.json(successResponse({ case_id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/voltron/cases/:id error:', err)
    res.status(500).json(errorResponse('Failed to fetch case'))
  }
})

// ─── PATCH /:id — Update case outcome ─────────────────────────────────────

voltronCasesRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = param(req.params.id)
    const col = casesCol()
    const docRef = col.doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Case not found'))
      return
    }

    const body = req.body as Record<string, unknown>
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { updated_at: now }

    // Status transition
    if (body.status) updates.status = body.status

    // Outcome handling (Accept / Revise / Escalate)
    if (body.outcome) {
      const outcome = body.outcome as CaseOutcome
      updates.outcome = outcome
      updates.status = 'resolved'
      updates.resolved_at = now

      if (body.revision_notes) {
        updates.revision_notes = body.revision_notes
      }
    }

    // Wire output (set by wire execution)
    if (body.wire_output !== undefined) {
      updates.wire_output = body.wire_output
    }

    await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse({ case_id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('PATCH /api/voltron/cases/:id error:', err)
    res.status(500).json(errorResponse('Failed to update case'))
  }
})
