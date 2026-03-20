/**
 * Connect routes — Channels, Calendar, Presence for RPI Connect module.
 * Seeds default channels (#general, #sales, #service) on first GET if empty.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import { getUserCalendarEvents, createQuickMeet } from '../lib/calendar-client.js'

export const connectRoutes = Router()

const CHANNELS_COLLECTION = 'connect_channels'

// Default seed channels — created on first GET if collection is empty
const SEED_CHANNELS = [
  { name: 'general', slug: 'general', pinned: true },
  { name: 'sales', slug: 'sales', pinned: true },
  { name: 'service', slug: 'service', pinned: false },
]

// ============================================================================
// GET /api/connect/calendar
// Returns today's upcoming Google Calendar events via domain-wide delegation.
// Requires GOOGLE_CALENDAR_CREDENTIALS env var with service account key JSON.
// ============================================================================

connectRoutes.get('/calendar', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    // If calendar credentials aren't configured, return empty gracefully
    if (!process.env.GOOGLE_CALENDAR_CREDENTIALS) {
      res.json(successResponse({ meetings: [], recordings: [] }))
      return
    }

    const meetings = await getUserCalendarEvents(email)
    res.json(successResponse({ meetings, recordings: [] }))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    // Handle Google auth expiry gracefully
    if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('GET /api/connect/calendar error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// POST /api/connect/meet
// Create a quick Google Meet via Calendar API with auto-generated Meet link.
// ============================================================================

connectRoutes.post('/meet', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    if (!process.env.GOOGLE_CALENDAR_CREDENTIALS) {
      res.status(503).json(errorResponse('Calendar integration not configured'))
      return
    }

    const body = req.body as Record<string, unknown>
    const title = body.title ? String(body.title).trim() : undefined

    const result = await createQuickMeet(email, title)
    res.json(successResponse(result))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('POST /api/connect/meet error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// GET /api/connect/channels
// List all connect_channels. Seeds defaults if collection is empty.
// ============================================================================

connectRoutes.get('/channels', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const col = db.collection(CHANNELS_COLLECTION)
    let snapshot = await col.get()

    // Seed if empty
    if (snapshot.empty) {
      const now = new Date().toISOString()
      const batch = db.batch()
      for (const seed of SEED_CHANNELS) {
        const ref = col.doc()
        batch.set(ref, { ...seed, created_at: now, updated_at: now })
      }
      await batch.commit()
      snapshot = await col.get()
    }

    const channels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    res.json(successResponse(channels))
  } catch (err) {
    console.error('GET /api/connect/channels error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/connect/channels
// Create a new channel with name slug
// ============================================================================

connectRoutes.post('/channels', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const rawName = body.name ? String(body.name).trim() : ''
    if (!rawName) {
      res.status(400).json(errorResponse('name is required'))
      return
    }

    const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) {
      res.status(400).json(errorResponse('Invalid channel name'))
      return
    }

    const db = getFirestore()
    const col = db.collection(CHANNELS_COLLECTION)

    // Check for duplicate slug
    const existing = await col.where('slug', '==', slug).limit(1).get()
    if (!existing.empty) {
      res.status(409).json(errorResponse(`Channel "${slug}" already exists`))
      return
    }

    const now = new Date().toISOString()
    const ref = col.doc()
    const data = {
      name: slug,
      slug,
      pinned: false,
      created_at: now,
      updated_at: now,
    }
    await ref.set(data)

    res.status(201).json(successResponse({ id: ref.id, ...data }))
  } catch (err) {
    console.error('POST /api/connect/channels error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PATCH /api/connect/channels/:id
// Toggle pin status on a channel
// ============================================================================

connectRoutes.patch('/channels/:id', async (req: Request, res: Response) => {
  try {
    const id = param(req.params.id)
    if (!id) {
      res.status(400).json(errorResponse('Channel id is required'))
      return
    }

    const body = req.body as Record<string, unknown>
    const db = getFirestore()
    const ref = db.collection(CHANNELS_COLLECTION).doc(id)
    const doc = await ref.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Channel not found'))
      return
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.pinned === 'boolean') {
      updates.pinned = body.pinned
    }

    await ref.update(updates)
    res.json(successResponse({ id, ...updates }))
  } catch (err) {
    console.error('PATCH /api/connect/channels/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/connect/presence
// Update users/{email}.last_active timestamp
// ============================================================================

connectRoutes.post('/presence', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const db = getFirestore()
    const userRef = db.collection('users').doc(email)
    await userRef.update({
      last_active: FieldValue.serverTimestamp(),
    })

    res.json(successResponse({ email, updated: true }))
  } catch (err) {
    console.error('POST /api/connect/presence error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
