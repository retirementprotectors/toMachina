import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
  param,
} from '../lib/helpers.js'
import type { BookingConfigData, BookingBusyData, BookingCreateResult, BookingClientSearchDTO } from '@tomachina/core'
import { randomUUID } from 'crypto'

export const bookingRoutes = Router()

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_AVAILABILITY = {
  timezone: 'America/Chicago',
  business_hours: {
    1: { start: '09:00', end: '17:00' },
    2: { start: '09:00', end: '17:00' },
    3: { start: '09:00', end: '17:00' },
    4: { start: '09:00', end: '17:00' },
    5: { start: '09:00', end: '12:00' },
  } as Record<number, { start: string; end: string }>,
  buffer_minutes: 15,
  max_advance_days: 90,
  slot_increment_minutes: 30,
}

const TEAM_BOOKING_CONFIG: Record<string, { title: string; leader_emails: string[] }> = {
  'retirement-sales':   { title: 'Retirement Sales',   leader_emails: ['vince@retireprotected.com'] },
  'retirement-service': { title: 'Retirement Service',  leader_emails: ['nikki@retireprotected.com'] },
  'medicare-sales':     { title: 'Medicare Sales',      leader_emails: ['vince@retireprotected.com'] },
  'medicare-service':   { title: 'Medicare Service',    leader_emails: ['nikki@retireprotected.com'] },
  'legacy-sales':       { title: 'Legacy Sales',        leader_emails: ['aprille@retireprotected.com'] },
  'legacy-service':     { title: 'Legacy Service',      leader_emails: ['aprille@retireprotected.com'] },
  'general':            { title: 'General',             leader_emails: ['nikki@retireprotected.com', 'vince@retireprotected.com'] },
}

const STANDARD_BOOKING_TYPES = [
  { name: 'Discovery Call',  duration_minutes: 60, category: 'standard', modes: ['meet', 'call'], auto_confirm: true },
  { name: 'Follow-Up',      duration_minutes: 30, category: 'standard', modes: ['meet', 'call'], auto_confirm: true },
  { name: 'Consultation',   duration_minutes: 45, category: 'standard', modes: ['meet', 'call'], auto_confirm: true },
  { name: 'Quick Question',  duration_minutes: 15, category: 'standard', modes: ['meet', 'call'], auto_confirm: true },
]

// ============================================================================
// GET BOOKING CONFIG
// ============================================================================

/**
 * GET /api/booking/config/:slug
 * Get booking configuration for an agent or team by slug
 */
bookingRoutes.get('/config/:slug', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const slug = param(req.params.slug)

    if (!slug) {
      res.status(400).json(errorResponse('Booking slug is required'))
      return
    }

    // Check if team booking first
    const teamCfg = TEAM_BOOKING_CONFIG[slug]
    if (teamCfg) {
      res.json(successResponse<BookingConfigData>({
        agent: {
          email: teamCfg.leader_emails[0],
          all_emails: teamCfg.leader_emails,
          display_name: teamCfg.title,
          slug,
        },
        bookingTypes: STANDARD_BOOKING_TYPES,
        availability: DEFAULT_AVAILABILITY,
        isTeam: true,
      } as unknown as BookingConfigData))
      return
    }

    // Look up individual agent by booking_slug
    const usersSnap = await db
      .collection('users')
      .where('status', '==', 'active')
      .get()

    let agent: Record<string, unknown> | null = null

    for (const doc of usersSnap.docs) {
      const data = doc.data()
      const ep = typeof data.employee_profile === 'string'
        ? JSON.parse(data.employee_profile || '{}')
        : (data.employee_profile || {})

      if (ep.booking_slug === slug) {
        agent = {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          display_name: `${data.first_name} ${data.last_name}`.trim(),
          job_title: data.job_title || '',
          slug,
          photo_url: ep.profile_photo_url || null,
          booking_types: ep.calendar_booking_types || STANDARD_BOOKING_TYPES,
          availability: ep.availability || DEFAULT_AVAILABILITY,
          office_address: ep.office_address || '',
        }
        break
      }
    }

    if (!agent) {
      res.status(404).json(errorResponse(`Agent not found: ${slug}`))
      return
    }

    const bookingTypes = agent.booking_types as Array<Record<string, unknown>>
    if (!bookingTypes || bookingTypes.length === 0) {
      res.status(400).json(errorResponse(`No booking types configured for ${slug}`))
      return
    }

    res.json(successResponse<BookingConfigData>({
      agent: {
        email: agent.email,
        first_name: agent.first_name,
        last_name: agent.last_name,
        display_name: agent.display_name,
        job_title: agent.job_title,
        slug: agent.slug,
        photo_url: agent.photo_url,
        office_address: agent.office_address,
      },
      bookingTypes,
      availability: agent.availability,
      isTeam: false,
    } as unknown as BookingConfigData))
  } catch (err) {
    console.error('GET /api/booking/config/:slug error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET MONTH BUSY
// ============================================================================

/**
 * GET /api/booking/busy
 * Get busy periods for a month (reads from Firestore calendar cache)
 */
bookingRoutes.get('/busy', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const agentEmail = req.query.email as string
    const year = parseInt(req.query.year as string)
    const month = parseInt(req.query.month as string)

    if (!agentEmail || !year || !month) {
      res.status(400).json(errorResponse('email, year, and month are required'))
      return
    }

    // Read from calendar_busy collection (synced by Cloud Function from Google Calendar)
    const busyKey = `${agentEmail}_${year}_${month}`
    const doc = await db.collection('calendar_busy').doc(busyKey).get()

    const busy = doc.exists ? (doc.data()?.periods || []) : []

    res.json(successResponse<BookingBusyData>({ busy } as unknown as BookingBusyData))
  } catch (err) {
    console.error('GET /api/booking/busy error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CREATE BOOKING
// ============================================================================

const bookingValidation = validateWrite({
  required: ['agentEmail', 'slot', 'client'],
  types: {
    agentEmail: 'string',
    slot: 'object',
    client: 'object',
    meetingType: 'string',
    mode: 'string',
  },
})

/**
 * POST /api/booking
 * Create a booking (calendar event + log)
 */
bookingRoutes.post('/', bookingValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { agentEmail, agentName, agentSlug, slot, meetingType, mode, client, allEmails } = req.body

    if (!client.name || (!client.email && !client.phone)) {
      res.status(400).json(errorResponse('Client name and at least one contact method (email or phone) are required'))
      return
    }

    const bookingId = randomUUID()
    const now = new Date().toISOString()
    const startDt = new Date(slot.start)
    const endDt = new Date(slot.end)
    const durationMin = Math.round((endDt.getTime() - startDt.getTime()) / 60000)

    const bookingLog = {
      booking_id: bookingId,
      agent_email: agentEmail,
      agent_name: agentName || '',
      agent_slug: agentSlug || '',
      all_agent_emails: allEmails || [agentEmail],
      client_name: client.name,
      client_email: client.email,
      client_phone: client.phone || '',
      guests: client.guests || '',
      booking_type: meetingType || 'Meeting',
      meeting_mode: mode || 'meet',
      scheduled_start: slot.start,
      scheduled_end: slot.end,
      duration_minutes: durationMin,
      reason: client.reason || '',
      status: 'confirmed',
      created_at: now,
    }

    await db.collection('booking_log').doc(bookingId).set(bookingLog)
    await writeThroughBridge('booking_log', 'insert', bookingId, bookingLog)

    res.status(201).json(successResponse<BookingCreateResult>({
      booking_id: bookingId,
      agent_name: agentName || '',
      meeting_type: meetingType || '',
      start: slot.start,
      end: slot.end,
      mode: mode || 'meet',
      status: 'confirmed',
    } as unknown as BookingCreateResult))
  } catch (err) {
    console.error('POST /api/booking error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SEARCH CLIENTS (for booking form type-ahead)
// ============================================================================

/**
 * GET /api/booking/search-clients
 * Search clients for booking form autocomplete
 */
bookingRoutes.get('/search-clients', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const query = (req.query.q as string || '').trim()

    if (query.length < 2) {
      res.json(successResponse<BookingClientSearchDTO>([] as unknown as BookingClientSearchDTO, { pagination: { count: 0, total: 0 } }))
      return
    }

    // Search by last_name prefix (Firestore range query)
    const upper = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase()
    const end = upper.slice(0, -1) + String.fromCharCode(upper.charCodeAt(upper.length - 1) + 1)

    const snap = await db
      .collection('clients')
      .where('last_name', '>=', upper)
      .where('last_name', '<', end)
      .limit(10)
      .get()

    const results = snap.docs.map((d) => {
      const data = d.data()
      return {
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        email: data.email || '',
        phone: data.phone || data.phone_home || '',
      }
    })

    res.json(successResponse<BookingClientSearchDTO>(results as unknown as BookingClientSearchDTO, { pagination: { count: results.length, total: results.length } }))
  } catch (err) {
    console.error('GET /api/booking/search-clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
