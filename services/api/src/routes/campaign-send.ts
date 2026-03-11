import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import { randomUUID } from 'crypto'

export const campaignSendRoutes = Router()

// ============================================================================
// ENROLLMENT
// ============================================================================

const enrollValidation = validateWrite({
  required: ['campaign_id', 'contact_ids'],
  types: {
    campaign_id: 'string',
    contact_ids: 'array',
    start_date: 'string',
    enrolled_by: 'string',
  },
})

/**
 * POST /api/campaign-send/enroll
 * Enroll contacts in a campaign — creates enrollment + queued send records
 */
campaignSendRoutes.post('/enroll', enrollValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { campaign_id, contact_ids, start_date, enrolled_by } = req.body

    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      res.status(400).json(errorResponse('contact_ids must be a non-empty array'))
      return
    }

    // Get campaign templates (touchpoints)
    const templateSnap = await db
      .collection('templates')
      .where('campaign_id', '==', campaign_id)
      .get()

    const templates = templateSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
      .sort((a, b) => (Number(a.touchpoint_day) || 0) - (Number(b.touchpoint_day) || 0))

    const start = start_date ? new Date(start_date) : new Date()
    const now = new Date().toISOString()
    const userEmail = (req as any).user?.email || enrolled_by || 'api'

    let enrollmentCount = 0
    let queuedSendCount = 0
    let skippedDuplicates = 0

    // Check existing active enrollments
    const existingSnap = await db
      .collection('campaign_enrollments')
      .where('campaign_id', '==', campaign_id)
      .where('status', '==', 'active')
      .get()

    const enrolledSet = new Set<string>()
    existingSnap.docs.forEach((d) => {
      const data = d.data()
      if (data.contact_id) enrolledSet.add(data.contact_id as string)
    })

    const batch = db.batch()

    for (const contactId of contact_ids as string[]) {
      if (enrolledSet.has(contactId)) {
        skippedDuplicates++
        continue
      }

      const enrollmentId = randomUUID()
      const firstDay = templates.length > 0 ? (Number(templates[0].touchpoint_day) || 0) : 0
      const nextSendDate = new Date(start.getTime() + firstDay * 86400000)

      const enrollmentData = {
        enrollment_id: enrollmentId,
        campaign_id,
        contact_id: contactId,
        enrolled_at: now,
        enrolled_by: userEmail,
        start_date: start.toISOString().split('T')[0],
        current_step: 0,
        next_send_at: nextSendDate.toISOString(),
        status: 'active',
        created_at: now,
        updated_at: now,
      }

      batch.set(db.collection('campaign_enrollments').doc(enrollmentId), enrollmentData)
      enrollmentCount++

      // Create queued sends for each touchpoint
      for (let t = 0; t < templates.length; t++) {
        const template = templates[t]
        const dayOffset = Number(template.touchpoint_day) || 0
        const scheduledDate = new Date(start.getTime() + dayOffset * 86400000)
        const queuedSendId = randomUUID()

        batch.set(db.collection('queued_sends').doc(queuedSendId), {
          queued_send_id: queuedSendId,
          enrollment_id: enrollmentId,
          campaign_id,
          contact_id: contactId,
          step_index: t,
          scheduled_for: scheduledDate.toISOString(),
          channel: (template.channel as string) || 'email',
          content_id: (template.template_id as string) || '',
          content_preview: (template.touchpoint as string) || `Step ${t + 1}`,
          status: 'queued',
          created_at: now,
          updated_at: now,
        })
        queuedSendCount++
      }
    }

    await batch.commit()

    // Bridge write for Sheets sync
    await writeThroughBridge('campaign_enrollments', 'insert', 'batch', {
      _batch: true,
      campaign_id,
      enrollmentCount,
      queuedSendCount,
    })

    res.json(successResponse({ enrollmentCount, queuedSendCount, skippedDuplicates }))
  } catch (err) {
    console.error('POST /api/campaign-send/enroll error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// MANUAL SEND
// ============================================================================

const manualSendValidation = validateWrite({
  required: ['contact_id', 'campaign_id', 'channel'],
  types: {
    contact_id: 'string',
    campaign_id: 'string',
    channel: 'string',
    content: 'string',
    subject: 'string',
  },
})

/**
 * POST /api/campaign-send/manual
 * Send a single campaign message to a contact (email, sms, or vm)
 */
campaignSendRoutes.post('/manual', manualSendValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { contact_id, campaign_id, channel, content, subject } = req.body

    // Look up client for DND + contact info
    const clientDoc = await db.collection('clients').doc(contact_id).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Contact not found'))
      return
    }

    const client = clientDoc.data() as Record<string, unknown>
    const ch = (channel as string).toLowerCase()

    // DND enforcement
    if (String(client.dnd_all || '') === 'true') {
      const sendLog = await logCampaignSend(db, {
        campaign_id,
        contact_id,
        channel: ch,
        status: 'skipped',
        error_message: 'DND_ALL',
      })
      res.json(successResponse(sendLog))
      return
    }

    if (ch === 'email' && String(client.dnd_email || '') === 'true') {
      const sendLog = await logCampaignSend(db, {
        campaign_id, contact_id, channel: ch,
        status: 'skipped', error_message: 'DND_EMAIL',
      })
      res.json(successResponse(sendLog))
      return
    }

    if ((ch === 'sms' || ch === 'vm') && String(client.dnd_sms || '') === 'true') {
      const sendLog = await logCampaignSend(db, {
        campaign_id, contact_id, channel: ch,
        status: 'skipped', error_message: 'DND_SMS',
      })
      res.json(successResponse(sendLog))
      return
    }

    // Log as queued — actual send will go through RAPID_COMMS or external service
    // In toMachina, campaign sends are queued and processed by the send processor
    const sendLog = await logCampaignSend(db, {
      campaign_id,
      contact_id,
      channel: ch,
      content_preview: (content || '').substring(0, 200),
      subject: subject || '',
      status: 'queued',
      provider: ch === 'email' ? 'sendgrid' : 'twilio',
    })

    await writeThroughBridge('campaign_send_log', 'insert', sendLog.send_id as string, sendLog)

    res.json(successResponse(sendLog))
  } catch (err) {
    console.error('POST /api/campaign-send/manual error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SEND HISTORY
// ============================================================================

/**
 * GET /api/campaign-send/history
 * Get campaign send history (filter by campaign_id and/or contact_id)
 */
campaignSendRoutes.get('/history', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const campaignId = req.query.campaign_id as string
    const contactId = req.query.contact_id as string

    let query: Query<DocumentData> = db.collection('campaign_send_log')

    if (campaignId) query = query.where('campaign_id', '==', campaignId)
    if (contactId) query = query.where('contact_id', '==', contactId)

    const snap = await query.orderBy('created_at', 'desc').limit(200).get()
    const data = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(data, { count: data.length }))
  } catch (err) {
    console.error('GET /api/campaign-send/history error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ENROLLMENTS
// ============================================================================

/**
 * GET /api/campaign-send/enrollments
 * Get campaign enrollments (filter by campaign_id)
 */
campaignSendRoutes.get('/enrollments', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const campaignId = req.query.campaign_id as string

    let query: Query<DocumentData> = db.collection('campaign_enrollments')
    if (campaignId) query = query.where('campaign_id', '==', campaignId)

    const snap = await query.orderBy('created_at', 'desc').limit(500).get()
    const data = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(data, { count: data.length }))
  } catch (err) {
    console.error('GET /api/campaign-send/enrollments error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TARGET CONTACTS
// ============================================================================

/**
 * POST /api/campaign-send/targets
 * Get contacts matching campaign trigger criteria
 */
campaignSendRoutes.post('/targets', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const triggers = req.body || {}

    let query: Query<DocumentData> = db.collection('clients')

    if (triggers.trigger_client_status) {
      query = query.where('client_status', '==', triggers.trigger_client_status)
    }
    if (triggers.trigger_state) {
      query = query.where('state', '==', triggers.trigger_state)
    }
    if (triggers.trigger_bob) {
      query = query.where('book_of_business', '==', triggers.trigger_bob)
    }

    const snap = await query.limit(1000).get()
    let matches = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))

    // Client-side filters for fields Firestore can't compound-query
    if (triggers.trigger_age_min || triggers.trigger_age_max) {
      const now = Date.now()
      matches = matches.filter((client) => {
        const dob = client.dob as string
        if (!dob) return false
        const age = Math.floor((now - new Date(dob).getTime()) / (365.25 * 86400000))
        if (triggers.trigger_age_min && age < parseInt(triggers.trigger_age_min, 10)) return false
        if (triggers.trigger_age_max && age > parseInt(triggers.trigger_age_max, 10)) return false
        return true
      })
    }

    if (triggers.trigger_tags) {
      const requiredTags = String(triggers.trigger_tags).split(',').map((t: string) => t.trim().toLowerCase())
      matches = matches.filter((client) => {
        const clientTags = String(client.tags || '').split(',').map((t: string) => t.trim().toLowerCase())
        return requiredTags.some((tag: string) => clientTags.includes(tag))
      })
    }

    const data = matches.map((m) => stripInternalFields(m))
    res.json(successResponse(data, { count: data.length }))
  } catch (err) {
    console.error('POST /api/campaign-send/targets error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// EXECUTE SEND BATCH
// ============================================================================

/**
 * POST /api/campaign-send/execute
 * Process queued sends that are due. Called by Cloud Scheduler or manually.
 */
campaignSendRoutes.post('/execute', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()

    // Find queued sends that are scheduled for now or earlier
    const snap = await db
      .collection('queued_sends')
      .where('status', '==', 'queued')
      .where('scheduled_for', '<=', now)
      .orderBy('scheduled_for', 'asc')
      .limit(100)
      .get()

    if (snap.empty) {
      res.json(successResponse({ processed: 0, message: 'No sends due' }))
      return
    }

    let processed = 0
    let skipped = 0
    const batch = db.batch()

    for (const doc of snap.docs) {
      const send = doc.data() as Record<string, unknown>
      const contactId = send.contact_id as string

      // Check DND
      const clientDoc = await db.collection('clients').doc(contactId).get()
      if (!clientDoc.exists) {
        batch.update(doc.ref, { status: 'failed', error_message: 'contact_not_found', updated_at: now })
        skipped++
        continue
      }

      const client = clientDoc.data() as Record<string, unknown>
      const channel = (send.channel as string || 'email').toLowerCase()

      if (String(client.dnd_all || '') === 'true') {
        batch.update(doc.ref, { status: 'skipped', error_message: 'DND_ALL', updated_at: now })
        skipped++
        continue
      }
      if (channel === 'email' && String(client.dnd_email || '') === 'true') {
        batch.update(doc.ref, { status: 'skipped', error_message: 'DND_EMAIL', updated_at: now })
        skipped++
        continue
      }
      if ((channel === 'sms' || channel === 'vm') && String(client.dnd_sms || '') === 'true') {
        batch.update(doc.ref, { status: 'skipped', error_message: 'DND_SMS', updated_at: now })
        skipped++
        continue
      }

      // Mark as processing — actual delivery goes through RAPID_COMMS or external provider
      batch.update(doc.ref, {
        status: 'processing',
        processed_at: now,
        updated_at: now,
      })

      // Log the send
      const sendLogId = randomUUID()
      batch.set(db.collection('campaign_send_log').doc(sendLogId), {
        send_id: sendLogId,
        campaign_id: send.campaign_id,
        contact_id: contactId,
        channel,
        enrollment_id: send.enrollment_id || null,
        content_preview: send.content_preview || '',
        status: 'processing',
        provider: channel === 'email' ? 'sendgrid' : 'twilio',
        created_at: now,
      })

      processed++
    }

    await batch.commit()

    res.json(successResponse({ processed, skipped, total_found: snap.size }))
  } catch (err) {
    console.error('POST /api/campaign-send/execute error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SEND QUEUE
// ============================================================================

/**
 * GET /api/campaign-send/queue
 * View the send queue. Filter by status, campaign_id.
 */
campaignSendRoutes.get('/queue', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('queued_sends')

    const status = req.query.status as string
    if (status) {
      query = query.where('status', '==', status)
    } else {
      query = query.where('status', '==', 'queued')
    }

    if (req.query.campaign_id) {
      query = query.where('campaign_id', '==', req.query.campaign_id)
    }

    const snap = await query.orderBy('scheduled_for', 'asc').limit(200).get()
    const data = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(data, { count: data.length }))
  } catch (err) {
    console.error('GET /api/campaign-send/queue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CANCEL SCHEDULED SEND
// ============================================================================

/**
 * POST /api/campaign-send/cancel/:id
 * Cancel a queued send. Only queued sends can be cancelled.
 */
campaignSendRoutes.post('/cancel/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection('queued_sends').doc(id)
    const doc = await docRef.get()

    if (!doc.exists) { res.status(404).json(errorResponse('Queued send not found')); return }

    const data = doc.data() as Record<string, unknown>
    if (data.status !== 'queued') {
      res.status(400).json(errorResponse(`Cannot cancel send with status: ${data.status}`))
      return
    }

    await docRef.update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    res.json(successResponse({ id, cancelled: true }))
  } catch (err) {
    console.error('POST /api/campaign-send/cancel/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SCHEDULE A FUTURE SEND
// ============================================================================

const scheduleValidation = validateWrite({
  required: ['campaign_id', 'scheduled_for', 'channel'],
  types: {
    campaign_id: 'string',
    scheduled_for: 'string',
    channel: 'string',
    timezone: 'string',
  },
})

/**
 * POST /api/campaign-send/schedule
 * Schedule a future campaign send.
 */
campaignSendRoutes.post('/schedule', scheduleValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const { campaign_id, scheduled_for, channel, timezone, audience_filter } = req.body
    const userEmail = (req as unknown as Record<string, unknown>).user
      ? ((req as unknown as Record<string, unknown>).user as Record<string, string>).email
      : 'api'

    // Validate schedule date
    const schedDate = new Date(scheduled_for)
    if (isNaN(schedDate.getTime())) {
      res.status(400).json(errorResponse('Invalid scheduled_for date'))
      return
    }
    if (schedDate.getTime() < Date.now() - 60000) {
      res.status(400).json(errorResponse('Scheduled time is in the past'))
      return
    }

    // Check AEP blackout for Medicare campaigns
    const campDoc = await db.collection('campaigns').doc(campaign_id).get()
    if (campDoc.exists) {
      const campData = campDoc.data() as Record<string, unknown>
      const campType = String(campData.campaign_type || campData.type || '').toUpperCase()
      const medicareCodes = ['AEP', 'T65', 'MAPD', 'MED_SUPP', 'MEDICARE']
      if (medicareCodes.some((c) => campType.includes(c))) {
        const month = schedDate.getMonth() + 1
        const day = schedDate.getDate()
        if ((month === 10 && day >= 1) || month === 11 || (month === 12 && day <= 7)) {
          res.status(400).json(errorResponse('Medicare campaigns cannot be sent during AEP blackout (Oct 1 - Dec 7)'))
          return
        }
      }
    }

    const scheduleId = `SCHED_${randomUUID().slice(0, 8)}`
    const scheduleData = {
      schedule_id: scheduleId,
      campaign_id,
      scheduled_for: schedDate.toISOString(),
      timezone: timezone || 'America/Chicago',
      channel,
      audience_filter: audience_filter || null,
      status: 'scheduled',
      created_by: userEmail,
      created_at: now,
      updated_at: now,
    }

    await db.collection('campaign_schedules').doc(scheduleId).set(scheduleData)

    res.status(201).json(successResponse(scheduleData))
  } catch (err) {
    console.error('POST /api/campaign-send/schedule error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// LIST SCHEDULED SENDS
// ============================================================================

/**
 * GET /api/campaign-send/scheduled
 * List scheduled sends. Filter by status, campaign_id.
 */
campaignSendRoutes.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('campaign_schedules')

    const status = req.query.status as string
    if (status) {
      query = query.where('status', '==', status)
    }
    if (req.query.campaign_id) {
      query = query.where('campaign_id', '==', req.query.campaign_id)
    }

    const snap = await query.orderBy('scheduled_for', 'asc').limit(100).get()
    const data = snap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    res.json(successResponse(data, { count: data.length }))
  } catch (err) {
    console.error('GET /api/campaign-send/scheduled error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// UPDATE/CANCEL SCHEDULED SEND
// ============================================================================

/**
 * PATCH /api/campaign-send/scheduled/:id
 * Reschedule or cancel a scheduled send.
 */
campaignSendRoutes.patch('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection('campaign_schedules').doc(id)
    const doc = await docRef.get()

    if (!doc.exists) { res.status(404).json(errorResponse('Scheduled send not found')); return }

    const current = doc.data() as Record<string, unknown>
    if (current.status !== 'scheduled') {
      res.status(400).json(errorResponse(`Cannot modify schedule with status: ${current.status}`))
      return
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (req.body.scheduled_for) updates.scheduled_for = req.body.scheduled_for
    if (req.body.audience_filter) updates.audience_filter = req.body.audience_filter
    if (req.body.channel) updates.channel = req.body.channel
    if (req.body.status === 'cancelled') {
      updates.status = 'cancelled'
      updates.cancelled_at = new Date().toISOString()
    }

    await docRef.update(updates)

    res.json(successResponse({ id, updated: Object.keys(updates) }))
  } catch (err) {
    console.error('PATCH /api/campaign-send/scheduled/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// EXECUTE DUE SCHEDULES
// ============================================================================

/**
 * POST /api/campaign-send/execute-due
 * Process all scheduled sends whose time has passed.
 * Called by Cloud Scheduler on a cron.
 */
campaignSendRoutes.post('/execute-due', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()

    const snap = await db
      .collection('campaign_schedules')
      .where('status', '==', 'scheduled')
      .where('scheduled_for', '<=', now)
      .orderBy('scheduled_for', 'asc')
      .limit(20)
      .get()

    if (snap.empty) {
      res.json(successResponse({ processed: 0, message: 'No schedules due' }))
      return
    }

    let processed = 0
    const results: Record<string, unknown>[] = []

    for (const schedDoc of snap.docs) {
      const sched = schedDoc.data() as Record<string, unknown>
      const campaignId = sched.campaign_id as string

      // Mark as processing
      await schedDoc.ref.update({ status: 'processing', updated_at: now })

      // Get campaign templates
      const templateSnap = await db
        .collection('templates')
        .where('campaign_id', '==', campaignId)
        .get()

      if (templateSnap.empty) {
        await schedDoc.ref.update({
          status: 'failed',
          error_message: 'No templates found for campaign',
          updated_at: now,
        })
        continue
      }

      // Build audience from clients (simplified — full audience builder in @tomachina/core)
      const channel = (sched.channel as string) || 'email'
      const clientSnap = await db.collection('clients').where('client_status', '==', 'Active').limit(1000).get()
      let clients = clientSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)

      // DND filtering
      clients = clients.filter((c) => {
        if (String(c.dnd_all || '') === 'true') return false
        if (channel === 'email' && String(c.dnd_email || '') === 'true') return false
        if (channel === 'sms' && String(c.dnd_sms || '') === 'true') return false
        return true
      })

      // Queue sends for first template (simplified batch)
      const template = templateSnap.docs[0]
      const batch = db.batch()
      let queued = 0

      for (const client of clients.slice(0, 500)) {
        const queuedId = randomUUID()
        batch.set(db.collection('queued_sends').doc(queuedId), {
          queued_send_id: queuedId,
          schedule_id: schedDoc.id,
          campaign_id: campaignId,
          contact_id: client.id,
          channel,
          content_id: template.id,
          content_preview: String(template.data().touchpoint || 'Campaign Send'),
          status: 'queued',
          scheduled_for: now,
          created_at: now,
          updated_at: now,
        })
        queued++
      }

      if (queued > 0) await batch.commit()

      await schedDoc.ref.update({
        status: 'completed',
        executed_at: now,
        updated_at: now,
        result: { total_queued: queued, total_clients: clients.length },
      })

      results.push({ schedule_id: schedDoc.id, queued })
      processed++
    }

    res.json(successResponse({ processed, results }))
  } catch (err) {
    console.error('POST /api/campaign-send/execute-due error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// HELPERS
// ============================================================================

async function logCampaignSend(
  db: FirebaseFirestore.Firestore,
  sendData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const sendId = randomUUID()
  const logEntry = {
    send_id: sendId,
    ...sendData,
    created_at: new Date().toISOString(),
  }
  await db.collection('campaign_send_log').doc(sendId).set(logEntry)
  return logEntry
}
