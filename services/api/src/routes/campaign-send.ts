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
