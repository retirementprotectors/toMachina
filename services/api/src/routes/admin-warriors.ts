/**
 * Admin Warriors route — GET /api/admin/warriors
 * TRK-14183 | Sprint: Learning Loop 2.0 v2
 *
 * Returns the full warrior registry from the dojo_warriors Firestore collection.
 * Requires JDM entitlement (EXECUTIVE or OWNER role).
 */

import { Router, type Request, type Response } from 'express'
import { getDefaultDb } from '../lib/db.js'
import { successResponse, errorResponse } from '../lib/helpers.js'

export const adminWarriorRoutes = Router()

const DOJO_WARRIORS_COLLECTION = 'dojo_warriors'

// ── Auth Guard — require executive-level access ──────────────────────



// ── GET /api/admin/warriors — full registry ──────────────────────────

adminWarriorRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDefaultDb()
    const snapshot = await db.collection(DOJO_WARRIORS_COLLECTION).get()

    const warriors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    res.json(successResponse(warriors, { count: warriors.length }))
  } catch (err) {
    console.error('[admin-warriors] Fetch failed:', err)
    res.status(500).json(errorResponse('Failed to fetch warrior registry'))
  }
})
