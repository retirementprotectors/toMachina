/**
 * Connect routes — Channels, Calendar, Presence, Google Chat Spaces + DMs + Meet.
 *
 * Seeds default Firestore channels (#general, #sales, #service) on first GET if empty.
 *
 * Google Chat routes (TKO-CONN-002 through TKO-CONN-007):
 *   GET  /api/connect/spaces                        — list Chat Spaces
 *   GET  /api/connect/spaces/:spaceId/messages      — list messages (+ polling support)
 *   POST /api/connect/spaces/:spaceId/messages      — send a message
 *   GET  /api/connect/spaces/:spaceId/members       — list Space members
 *   GET  /api/connect/spaces/:spaceId/read-state    — read state (TKO-CONN-006)
 *   GET  /api/connect/dms                           — list DM spaces
 *   GET  /api/connect/meet/:meetSpaceName/transcripts — Meet transcripts (TKO-CONN-005)
 *   GET  /api/connect/meet/:meetSpaceName/recordings  — Meet recordings (TKO-CONN-005)
 *
 * Prerequisites (TKO-CONN-001 admin action):
 *   - GCP OAuth client flipped to Internal
 *   - Domain-wide delegation authorized for all CHAT_SCOPES
 *   - chat.googleapis.com enabled in project claude-mcp-484718
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import type {
  ConnectCalendarData,
  ConnectMeetResult,
  ConnectChannelDTO,
  ConnectChannelListDTO,
  ConnectChannelUpdateResult,
  ConnectPresenceResult,
  ConnectSpaceListDTO,
  ConnectMessageListDTO,
  ConnectSendMessageResult,
  ConnectMemberListDTO,
  ConnectDMListDTO,
  ConnectReadStateResult,
  ConnectMeetTranscriptsDTO,
  ConnectMeetRecordingsDTO,
} from '@tomachina/core'
import { getUserCalendarEvents, createQuickMeet } from '../lib/calendar-client.js'
import {
  listChatSpaces,
  listChatMessages,
  sendChatMessage,
  listChatMembers,
  getSpaceReadState,
  listDMSpaces,
} from '../lib/google-chat-client.js'

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
// Works keyless on Cloud Run (IAM signJwt) or with GOOGLE_CALENDAR_CREDENTIALS locally.
// ============================================================================

connectRoutes.get('/calendar', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const meetings = await getUserCalendarEvents(email)
    res.json(successResponse<ConnectCalendarData>({ meetings, recordings: [] } as unknown as ConnectCalendarData))
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

    const body = req.body as Record<string, unknown>
    const title = body.title ? String(body.title).trim() : undefined

    const result = await createQuickMeet(email, title)
    res.json(successResponse<ConnectMeetResult>(result as unknown as ConnectMeetResult))
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
    res.json(successResponse<ConnectChannelListDTO>(channels as unknown as ConnectChannelListDTO))
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

    res.status(201).json(successResponse<ConnectChannelDTO>({ id: ref.id, ...data } as unknown as ConnectChannelDTO))
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
    res.json(successResponse<ConnectChannelUpdateResult>({ id, ...updates } as unknown as ConnectChannelUpdateResult))
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

    res.json(successResponse<ConnectPresenceResult>({ email, updated: true } as unknown as ConnectPresenceResult))
  } catch (err) {
    console.error('POST /api/connect/presence error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TKO-CONN-002: GET /api/connect/spaces
// List all Google Chat Spaces the authenticated user is a member of.
// Requires TKO-CONN-001 admin action (GCP OAuth → Internal + DWD authorized).
// ============================================================================

connectRoutes.get('/spaces', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }
    const spaces = await listChatSpaces(email)
    res.json(successResponse<ConnectSpaceListDTO>(spaces))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('GET /api/connect/spaces error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-002: GET /api/connect/spaces/:spaceId/messages
// List messages in a Chat Space. Supports ?pageToken= for pagination.
// TKO-CONN-007 (5-sec polling) calls this endpoint with pageToken to get delta.
// ============================================================================

connectRoutes.get('/spaces/:spaceId/messages', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const spaceId = param(req.params.spaceId)
    if (!spaceId) {
      res.status(400).json(errorResponse('spaceId is required'))
      return
    }

    const spaceName = spaceId.startsWith('spaces/') ? spaceId : `spaces/${spaceId}`
    const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined
    const pageSize = req.query.pageSize ? Math.min(Number(req.query.pageSize), 100) : 50

    const result = await listChatMessages(email, spaceName, { pageToken, pageSize })
    res.json(successResponse<ConnectMessageListDTO>(result))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('GET /api/connect/spaces/:spaceId/messages error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-002 (write) + TKO-CONN-004 (DM write):
// POST /api/connect/spaces/:spaceId/messages
// Send a message to a Chat Space or DM.
// Body: { text: string, threadName?: string }
// ============================================================================

connectRoutes.post('/spaces/:spaceId/messages', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const spaceId = param(req.params.spaceId)
    if (!spaceId) {
      res.status(400).json(errorResponse('spaceId is required'))
      return
    }

    const body = req.body as Record<string, unknown>
    const text = body.text ? String(body.text).trim() : ''
    if (!text) {
      res.status(400).json(errorResponse('text is required'))
      return
    }
    const threadName = body.threadName ? String(body.threadName) : undefined

    const spaceName = spaceId.startsWith('spaces/') ? spaceId : `spaces/${spaceId}`
    const message = await sendChatMessage(email, spaceName, text, threadName)
    res.status(201).json(successResponse<ConnectSendMessageResult>(message))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('POST /api/connect/spaces/:spaceId/messages error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-002: GET /api/connect/spaces/:spaceId/members
// List members of a Chat Space.
// ============================================================================

connectRoutes.get('/spaces/:spaceId/members', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const spaceId = param(req.params.spaceId)
    if (!spaceId) {
      res.status(400).json(errorResponse('spaceId is required'))
      return
    }

    const spaceName = spaceId.startsWith('spaces/') ? spaceId : `spaces/${spaceId}`
    const members = await listChatMembers(email, spaceName)
    res.json(successResponse<ConnectMemberListDTO>(members))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/connect/spaces/:spaceId/members error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-004: GET /api/connect/dms
// List DM spaces for the authenticated user.
// ============================================================================

connectRoutes.get('/dms', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }
    const dms = await listDMSpaces(email)
    res.json(successResponse<ConnectDMListDTO>(dms))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('invalid_grant') || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('GET /api/connect/dms error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-006: GET /api/connect/spaces/:spaceId/read-state
// Get the read state (last read position) for the current user in a space.
// Requires chat.users.readstate scope (granted via TKO-CONN-001 + Internal OAuth).
// Returns null gracefully if scope not yet authorized.
// ============================================================================

connectRoutes.get('/spaces/:spaceId/read-state', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const spaceId = param(req.params.spaceId)
    if (!spaceId) {
      res.status(400).json(errorResponse('spaceId is required'))
      return
    }

    const spaceName = spaceId.startsWith('spaces/') ? spaceId : `spaces/${spaceId}`
    const readState = await getSpaceReadState(email, spaceName)
    res.json(successResponse<ConnectReadStateResult>(readState))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/connect/spaces/:spaceId/read-state error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-005: GET /api/connect/meet/:meetSpaceName/transcripts
// Fetch Meet transcript stubs for a conference space.
// meetSpaceName is URL-encoded (e.g. "xxxxxx-yyy-zzz" from a meet.google.com link).
// Uses Meet REST API v2. Returns empty array gracefully if no transcripts exist.
// ============================================================================

connectRoutes.get('/meet/:meetSpaceName/transcripts', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const meetSpaceName = param(req.params.meetSpaceName)
    if (!meetSpaceName) {
      res.status(400).json(errorResponse('meetSpaceName is required'))
      return
    }

    // Meet REST API v2: GET /v2/conferenceRecords/{conferenceRecord}/transcripts
    // The conferenceRecord ID comes from a previous meet_create_meeting or
    // from the Meet Activity API. For now we return an empty list as the
    // conferenceRecord is not surfaced in connect/meet POST response yet.
    // TODO (TKO-CONN-005 follow-up): store conferenceRecord ID from Meet
    // activity feed and join it to the calendar event for full transcript fetch.
    const result: ConnectMeetTranscriptsDTO = { transcripts: [] }
    res.json(successResponse<ConnectMeetTranscriptsDTO>(result))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/connect/meet/:meetSpaceName/transcripts error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

// ============================================================================
// TKO-CONN-005: GET /api/connect/meet/:meetSpaceName/recordings
// Fetch Meet recording stubs. Same deferred note as /transcripts above.
// ============================================================================

connectRoutes.get('/meet/:meetSpaceName/recordings', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as { user?: { email?: string } }).user
    const email = user?.email
    if (!email) {
      res.status(401).json(errorResponse('No authenticated user'))
      return
    }

    const meetSpaceName = param(req.params.meetSpaceName)
    if (!meetSpaceName) {
      res.status(400).json(errorResponse('meetSpaceName is required'))
      return
    }

    // Deferred: same as /transcripts — conferenceRecord linkage needed.
    // TODO (TKO-CONN-005 follow-up): wire Meet Activity API to store
    // conferenceRecord per calendar event, then fetch recordings here.
    const result: ConnectMeetRecordingsDTO = { recordings: [] }
    res.json(successResponse<ConnectMeetRecordingsDTO>(result))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('GET /api/connect/meet/:meetSpaceName/recordings error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})
