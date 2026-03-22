import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { CampaignAnalyticsData } from '@tomachina/core'
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

    res.json(successResponse<unknown>(metrics))
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

    res.json(successResponse<unknown>(timeline, { pagination: { count: timeline.length, total: timeline.length } }))
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

    res.json(successResponse<unknown>(recipients, { pagination: { count: recipients.length, total: recipients.length } }))
  } catch (err) {
    console.error('GET /api/campaign-analytics/:campaignId/recipients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// DRIP PROGRESS
// ============================================================================

/**
 * GET /api/campaign-analytics/:campaignId/drip-progress
 * Per-step completion rates for drip sequences in a campaign.
 */
campaignAnalyticsRoutes.get('/:campaignId/drip-progress', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const campaignId = param(req.params.campaignId)

    // Find drip sequences for this campaign
    const dripSnap = await db.collection('drip_sequences')
      .where('campaign_id', '==', campaignId)
      .limit(20)
      .get()

    if (dripSnap.empty) {
      res.json(successResponse<unknown>({ sequences: [], message: 'No drip sequences for this campaign' }))
      return
    }

    const sequences: Record<string, unknown>[] = []

    for (const dripDoc of dripSnap.docs) {
      const drip = dripDoc.data() as Record<string, unknown>
      const dripId = (drip.drip_id as string) || dripDoc.id
      const steps = (drip.steps as Record<string, unknown>[]) || []

      // Get enrollments for this drip
      const enrollSnap = await db.collection('campaign_enrollments')
        .where('drip_sequence_id', '==', dripId)
        .limit(5000)
        .get()

      const enrollments = enrollSnap.docs.map((d) => d.data() as Record<string, unknown>)
      const totalEnrolled = enrollments.length
      const safeTotal = Math.max(totalEnrolled, 1)

      // Get delivery events for this campaign
      const eventSnap = await db.collection(EVENTS_COLLECTION)
        .where('campaign_id', '==', campaignId)
        .limit(10000)
        .get()

      const events = eventSnap.docs.map((d) => d.data() as Record<string, unknown>)

      // Build per-step progress
      const sortedSteps = [...steps].sort(
        (a, b) => (Number(a.step_index) || 0) - (Number(b.step_index) || 0)
      )

      const stepProgress = sortedSteps.map((step) => {
        const stepIndex = Number(step.step_index) || 0

        // Filter events by step metadata
        const stepEvents = events.filter((e) => {
          const meta = e.metadata as Record<string, unknown> | undefined
          return meta && meta.step_index === stepIndex && meta.drip_id === dripId
        })

        // Count enrollments that reached or passed this step
        const reachedStep = enrollments.filter(
          (e) => (Number(e.current_step) || 0) > stepIndex || e.status === 'completed'
        ).length

        return {
          step_index: stepIndex,
          channel: step.channel || 'email',
          template_id: step.template_id || '',
          delay_days: Number(step.delay_days) || 0,
          total_enrolled: totalEnrolled,
          reached: reachedStep,
          completion_rate: Math.round((reachedStep / safeTotal) * 10000) / 100,
          sent: stepEvents.filter((e) => e.event_type === 'sent').length,
          delivered: stepEvents.filter((e) => e.event_type === 'delivered').length,
          opened: stepEvents.filter((e) => e.event_type === 'opened').length,
          clicked: stepEvents.filter((e) => e.event_type === 'clicked').length,
          bounced: stepEvents.filter((e) => e.event_type === 'bounced').length,
        }
      })

      sequences.push({
        drip_id: dripId,
        sequence_name: drip.sequence_name || '',
        status: drip.status || 'active',
        total_enrolled: totalEnrolled,
        active: enrollments.filter((e) => e.status === 'active').length,
        completed: enrollments.filter((e) => e.status === 'completed').length,
        stopped: enrollments.filter((e) => e.status === 'stopped').length,
        steps: stepProgress,
      })
    }

    res.json(successResponse<unknown>({ sequences }))
  } catch (err) {
    console.error('GET /api/campaign-analytics/:campaignId/drip-progress error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SENDGRID WEBHOOK (FIXED — resolves campaign context via send log lookup)
// ============================================================================

/**
 * POST /api/campaign-analytics/webhook/sendgrid
 * SendGrid delivery event webhook. Updates campaign delivery events.
 *
 * FIX: SendGrid does NOT include custom fields (campaign_id, contact_id)
 * in webhook payloads. Instead, we look up the campaign_send_log record
 * by the external message ID (sg_message_id) to resolve campaign context.
 * This pattern is proven in webhooks.ts (lines 184-191).
 */
campaignAnalyticsRoutes.post('/webhook/sendgrid', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const events = Array.isArray(req.body) ? req.body : [req.body]
    const now = new Date().toISOString()

    let processed = 0
    let unmatched = 0
    const batch = db.batch()

    for (const event of events as Record<string, unknown>[]) {
      let sgMessageId = (event.sg_message_id as string) || ''
      const sgEvent = event.event as string

      if (!sgEvent) continue

      // Strip SendGrid suffix (e.g., ".filter0001p2...")
      if (sgMessageId.includes('.')) {
        sgMessageId = sgMessageId.split('.')[0]
      }

      // Map SendGrid event types to our types
      let eventType: string
      if (sgEvent === 'delivered') eventType = 'delivered'
      else if (sgEvent === 'open') eventType = 'opened'
      else if (sgEvent === 'click') eventType = 'clicked'
      else if (sgEvent === 'bounce' || sgEvent === 'dropped') eventType = 'bounced'
      else if (sgEvent === 'unsubscribe' || sgEvent === 'group_unsubscribe') eventType = 'unsubscribed'
      else continue // skip unknown events

      // FIXED: Look up campaign_send_log by external message ID to resolve campaign context
      let resolvedCampaignId = ''
      let resolvedContactId = ''
      let resolvedDripId = ''
      let resolvedStepIndex: number | null = null

      if (sgMessageId) {
        const sendLogSnap = await db.collection(SEND_LOG)
          .where('external_id', '==', sgMessageId)
          .where('provider', '==', 'sendgrid')
          .limit(1)
          .get()

        if (!sendLogSnap.empty) {
          const logData = sendLogSnap.docs[0].data()
          resolvedCampaignId = (logData.campaign_id as string) || ''
          resolvedContactId = (logData.contact_id as string) || ''
          resolvedDripId = (logData.drip_sequence_id as string) || ''
          resolvedStepIndex = logData.step_index != null ? Number(logData.step_index) : null
        } else {
          unmatched++
        }
      }

      const eventId = `EVT_${randomUUID().slice(0, 8)}`
      const metadata: Record<string, unknown> = {
        email: event.email,
        reason: event.reason,
        url: event.url,
      }

      // Include drip metadata if available (for drip-progress queries)
      if (resolvedDripId) metadata.drip_id = resolvedDripId
      if (resolvedStepIndex != null) metadata.step_index = resolvedStepIndex

      batch.set(db.collection(EVENTS_COLLECTION).doc(eventId), {
        event_id: eventId,
        send_job_id: sgMessageId || '',
        campaign_id: resolvedCampaignId,
        recipient_id: resolvedContactId,
        event_type: eventType,
        channel: 'email',
        provider: 'sendgrid',
        provider_event_id: sgMessageId,
        metadata,
        timestamp: event.timestamp ? new Date(Number(event.timestamp) * 1000).toISOString() : now,
      })

      processed++
    }

    if (processed > 0) await batch.commit()

    res.json(successResponse<unknown>({ processed, unmatched }))
  } catch (err) {
    console.error('POST /api/campaign-analytics/webhook/sendgrid error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TWILIO WEBHOOK (FIXED — resolves campaign context via send log lookup)
// ============================================================================

/**
 * POST /api/campaign-analytics/webhook/twilio
 * Twilio delivery status webhook. Updates campaign delivery events.
 *
 * FIX: Twilio does NOT include custom fields (campaign_id, contact_id)
 * in status callbacks. Instead, we look up the campaign_send_log record
 * by the MessageSid to resolve campaign context.
 */
campaignAnalyticsRoutes.post('/webhook/twilio', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const { MessageSid, MessageStatus, To, ErrorCode } = req.body

    if (!MessageStatus) {
      res.json(successResponse<unknown>({ skipped: true, reason: 'no_status' }))
      return
    }

    // Map Twilio statuses to our types
    let eventType: string
    if (MessageStatus === 'delivered') eventType = 'delivered'
    else if (MessageStatus === 'sent') eventType = 'sent'
    else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') eventType = 'bounced'
    else return void res.json(successResponse<unknown>({ skipped: true, reason: `unmapped_status_${MessageStatus}` }))

    // FIXED: Look up campaign_send_log by MessageSid to resolve campaign context
    let resolvedCampaignId = ''
    let resolvedContactId = ''
    let resolvedDripId = ''
    let resolvedStepIndex: number | null = null

    if (MessageSid) {
      const sendLogSnap = await db.collection(SEND_LOG)
        .where('external_id', '==', MessageSid)
        .where('provider', '==', 'twilio')
        .limit(1)
        .get()

      if (!sendLogSnap.empty) {
        const logData = sendLogSnap.docs[0].data()
        resolvedCampaignId = (logData.campaign_id as string) || ''
        resolvedContactId = (logData.contact_id as string) || ''
        resolvedDripId = (logData.drip_sequence_id as string) || ''
        resolvedStepIndex = logData.step_index != null ? Number(logData.step_index) : null
      }
    }

    const metadata: Record<string, unknown> = {
      to: To,
      error_code: ErrorCode,
    }

    if (resolvedDripId) metadata.drip_id = resolvedDripId
    if (resolvedStepIndex != null) metadata.step_index = resolvedStepIndex

    const eventId = `EVT_${randomUUID().slice(0, 8)}`
    await db.collection(EVENTS_COLLECTION).doc(eventId).set({
      event_id: eventId,
      send_job_id: MessageSid || '',
      campaign_id: resolvedCampaignId,
      recipient_id: resolvedContactId,
      event_type: eventType,
      channel: 'sms',
      provider: 'twilio',
      provider_event_id: MessageSid,
      metadata,
      timestamp: now,
    })

    res.json(successResponse<unknown>({ processed: true, event_type: eventType }))
  } catch (err) {
    console.error('POST /api/campaign-analytics/webhook/twilio error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
