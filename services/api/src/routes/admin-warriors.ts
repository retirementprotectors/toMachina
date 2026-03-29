/**
 * Admin Warriors route — GET /api/admin/warriors
 * TRK-14183 | Sprint: Learning Loop 2.0 v2
 *
 * Returns the full warrior registry from the dojo_warriors Firestore collection.
 * Requires JDM entitlement (EXECUTIVE or OWNER role).
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'

export const adminWarriorRoutes = Router()

const DOJO_WARRIORS_COLLECTION = 'dojo_warriors'

// ── Auth Guard — require executive-level access ──────────────────────

const ALLOWED_ROLES = ['EXECUTIVE', 'OWNER', 'SUPER_ADMIN']

async function requireExecutive(req: Request, res: Response, next: NextFunction) {
  try {
    const email: string | undefined = (req as unknown as { user?: { email?: string } }).user?.email
    if (!email) {
      res.status(401).json(errorResponse('Authentication required'))
      return
    }

    const db = getFirestore()
    const userDoc = await db.collection('users').doc(email).get()

    if (!userDoc.exists) {
      res.status(403).json(errorResponse('Warrior registry requires executive access'))
      return
    }

    const userData = userDoc.data() as Record<string, unknown>
    const role = String(userData.role || '')
    const level = parseInt(String(userData.level || '99'), 10)

    if (!ALLOWED_ROLES.includes(role) && level > 1) {
      res.status(403).json(errorResponse('Warrior registry requires executive access'))
      return
    }

    next()
  } catch (err) {
    console.error('[admin-warriors] Auth check failed:', err)
    res.status(500).json(errorResponse('Authorization check failed'))
  }
}

// ── GET /api/admin/warriors — full registry ──────────────────────────

adminWarriorRoutes.get('/', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
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
