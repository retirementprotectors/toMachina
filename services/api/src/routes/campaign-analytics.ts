import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import { randomUUID } from 'crypto'

export const campaignAnalyticsRoutes = Router()

const EVENTS_COLLECTION = 'campaign_delivery_events'
const SEND_LOG = 'campaign_send_log'

// ============================================================================
// CAMPAIGN PERFORMANCE SUMMARY
// ============================================================================

/**
 * GET /api/campaign-analytics/:campaignId
 * Campaign performance summary: total sends, delivery rate, open rate, click rate
 */
campaignAnalyticsRoutes.get('/:campaignId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const campaignId = param(req.params.campaignId)

    // Get send log entries for this campaign
    const sendSnap = await db.collection(SEND_LOG)
      .where('campaign_id', '==', campaignId)
      .limit(5000)
      .get()

    const sends = sendSnap.docs.map((d) => d.data() as Record<string, unknown>)

    // Get delivery events
    const eventSnap = await db.collection(EVENTS_COLLECTION)
      .where('campaign_id', '==', campaignId)
      .limit(10000)
      .get()

    const events = eventSnap.docs.map((d) => d.data() as Record<string, unknown>)

    // Calculate metrics
    const totalSent = sends.filter((s) => s.status !== 'skipped' && s.status !== 'failed').length
    const delivered = events.filter((e) => e.event_type === 'delivered').length
    const bounced = events.filter((e) => e.event_type === 'bounced').length
    const opened = events.filter((e) => e.event_type === 'opened').length
    const clicked = events.filter((e) => e.event_type === 'clicked').length
    const failed = sends.filter((s) => s.status === 'failed').length
    const skipped = sends.filter((s) => s.status === 'skipped').length

    const safeTotal = Math.max(totalSent, 1)
    const safeDelivered = Math.max(delivered, 1)

    // Get scheduled sends
    const schedSnap = await db.collection('campaign_schedules')
      .where('campaign_id', '==', campaignId)
      .limit(20)
      .get()
    const schedules = schedSnap.docs.map((d) => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    // Channel breakdown
    const emailSends = sends.filter((s) => s.channel === 'email').length
    const smsSends = sends.filter((s) => s.channel === 'sms').length

    const metrics = {
      campaign_id: campaignId,
      total_sends: sends.length,
      total_sent: totalSent,
      total_delivered: delivered,
      total_bounced: bounced,
      total_opened: opened,
      total_clicked: clicked,
      total_failed: failed,
      total_skipped: skipped,
      delivery_rate: Math.round((delivered / safeTotal) * 10000) / 100,
      open_rate: Math.round((opened / safeDelivered) * 10000) / 100,
      click_rate: Math.round((clicked / safeDelivered) * 10000) / 100,
      bounce_rate: Math.round((bounced / safeTotal) * 10000) / 100,
      channel_breakdown: { email: emailSends, sms: smsSends },
      schedules,
    }

    res.json(successResponse(metrics))
  } catch (err) {
    console.error('GET /api/campaign-analytics/:campaignId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TIMELINE
// ============================================================================

/**
 * GET /api/campaign-analytics/:campaignId/timeline
 * Send activity over time (daily)
 */
campaignAnalyticsRoutes.get('/:campaignId/timeline', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const campaignId = param(req.params.campaignId)

    const eventSnap = await db.collection(EVENTS_COLLECTION)
      .where('campaign_id', '==', campaignId)
      .orderBy('timestamp', 'asc')
      .limit(10000)
      .get()

    // Also include send log for sent events
    const sendSnap = await db.collection(SEND_LOG)
      .where('campaign_id', '==', campaignId)
      .orderBy('created_at', 'asc')
      .limit(5000)
      .get()

    // Build daily counts
    const daily: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }> = {}

    sendSnap.docs.forEach((d) => {
      const data = d.data()
      const date = String(data.created_at || '').split('T')[0]
      if (!date) return
      if (!daily[date]) daily[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
      if (data.status !== 'skipped' && data.status !== 'failed') daily[date].sent++
    })

    eventSnap.docs.forEach((d) => {
      const data = d.data()
      const date = String(data.timestamp || '').split('T')[0]
      if (!date) return
      if (!daily[date]) daily[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
      const day = daily[date]
      const type = data.event_type as string
      if (type === 'delivered') day.delivered++
      else if (type === 'opened') day.opened++
      else if (type === 'clicked') day.clicked++
      else if (type === 'bounced') day.bounced++
    })

    const timeline = Object.entries(daily)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))

    res.json(successResponse(timeline, { count: timeline.length }))
  } catch (err) {
    console.error('GET /api/campaign-analytics/:campaignId/timeline error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// RECIPIENTS
// ============================================================================

/**
 * GET /api/campaign-analytics/:campaignId/recipients
 * Per-recipient delivery status
 */
campaignAnalyticsRoutes.get('/:campaignId/recipients', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const campaignId = param(req.params.campaignId)

    const sendSnap = await db.collection(SEND_LOG)
      .where('campaign_id', '==', campaignId)
      .orderBy('created_at', 'desc')
      .limit(500)
      .get()

    const recipients: Record<string, unknown>[] = sendSnap.docs.map((d) => {
      const data = d.data()
      return {
        contact_id: data.contact_id,
        channel: data.channel,
        status: data.status,
        provider: data.provider,
        sent_at: data.created_at,
        error_message: data.error_message || null,
      }
    })

    res.json(successResponse(recipients, { count: recipients.length }))
  } catch (err) {
    console.error('GET /api/campaign-analytics/:campaignId/recipients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SENDGRID WEBHOOK
// ============================================================================

/**
 * POST /api/campaign-analytics/webhook/sendgrid
 * SendGrid delivery event webhook. Updates campaign delivery events.
 */
campaignAnalyticsRoutes.post('/webhook/sendgrid', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const events = Array.isArray(req.body) ? req.body : [req.body]
    const now = new Date().toISOString()

    let processed = 0
    const batch = db.batch()

    for (const event of events as Record<string, unknown>[]) {
      const sgMessageId = event.sg_message_id as string
      const sgEvent = event.event as string

      if (!sgEvent) continue

      // Map SendGrid event types to our types
      let eventType: string
      if (sgEvent === 'delivered') eventType = 'delivered'
      else if (sgEvent === 'open') eventType = 'opened'
      else if (sgEvent === 'click') eventType = 'clicked'
      else if (sgEvent === 'bounce' || sgEvent === 'dropped') eventType = 'bounced'
      else if (sgEvent === 'unsubscribe' || sgEvent === 'group_unsubscribe') eventType = 'unsubscribed'
      else continue // skip unknown events

      const eventId = `EVT_${randomUUID().slice(0, 8)}`
      batch.set(db.collection(EVENTS_COLLECTION).doc(eventId), {
        event_id: eventId,
        send_job_id: sgMessageId || '',
        campaign_id: (event.campaign_id as string) || '',
        recipient_id: (event.contact_id as string) || '',
        event_type: eventType,
        channel: 'email',
        provider: 'sendgrid',
        provider_event_id: sgMessageId,
        metadata: { email: event.email, reason: event.reason, url: event.url },
        timestamp: event.timestamp ? new Date(Number(event.timestamp) * 1000).toISOString() : now,
      })

      processed++
    }

    if (processed > 0) await batch.commit()

    res.json(successResponse({ processed }))
  } catch (err) {
    console.error('POST /api/campaign-analytics/webhook/sendgrid error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TWILIO WEBHOOK
// ============================================================================

/**
 * POST /api/campaign-analytics/webhook/twilio
 * Twilio delivery status webhook. Updates campaign delivery events.
 */
campaignAnalyticsRoutes.post('/webhook/twilio', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const { MessageSid, MessageStatus, To, ErrorCode, campaign_id, contact_id } = req.body

    if (!MessageStatus) {
      res.json(successResponse({ skipped: true, reason: 'no_status' }))
      return
    }

    // Map Twilio statuses to our types
    let eventType: string
    if (MessageStatus === 'delivered') eventType = 'delivered'
    else if (MessageStatus === 'sent') eventType = 'sent'
    else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') eventType = 'bounced'
    else return void res.json(successResponse({ skipped: true, reason: `unmapped_status_${MessageStatus}` }))

    const eventId = `EVT_${randomUUID().slice(0, 8)}`
    await db.collection(EVENTS_COLLECTION).doc(eventId).set({
      event_id: eventId,
      send_job_id: MessageSid || '',
      campaign_id: campaign_id || '',
      recipient_id: contact_id || '',
      event_type: eventType,
      channel: 'sms',
      provider: 'twilio',
      provider_event_id: MessageSid,
      metadata: { to: To, error_code: ErrorCode },
      timestamp: now,
    })

    res.json(successResponse({ processed: true, event_type: eventType }))
  } catch (err) {
    console.error('POST /api/campaign-analytics/webhook/twilio error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
