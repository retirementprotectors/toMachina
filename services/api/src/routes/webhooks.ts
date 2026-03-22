import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import type { WebhookSendgridResult, WebhookDocusignResult } from '@tomachina/core'

export const webhookRoutes = Router()

// ============================================================================
// SENDGRID EVENT WEBHOOK
// ============================================================================

/**
 * POST /api/webhooks/sendgrid
 * Handle SendGrid Event Webhook (delivery, open, click, bounce, etc.)
 *
 * SendGrid sends array of events with:
 *   - email, event, sg_message_id, timestamp, url, reason
 */
webhookRoutes.post('/sendgrid', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let events = req.body

    if (!Array.isArray(events)) {
      events = [events]
    }

    let processed = 0
    let errors = 0

    const statusMap: Record<string, string> = {
      processed: 'sent',
      delivered: 'delivered',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      dropped: 'failed',
      deferred: 'sent',
      spam_report: 'bounced',
      unsubscribe: 'bounced',
    }

    for (const event of events) {
      try {
        let sgMessageId = event.sg_message_id || ''
        // Strip SendGrid suffix (e.g., ".filter0001p2...")
        if (sgMessageId.includes('.')) {
          sgMessageId = sgMessageId.split('.')[0]
        }

        const eventType = (event.event || '').toLowerCase()
        const newStatus = statusMap[eventType] || eventType

        if (sgMessageId) {
          await updateSendLogByExternalId(db, sgMessageId, 'sendgrid', newStatus, eventType, event)
          await updateCommLogByExternalId(db, sgMessageId, 'sendgrid_message_id', newStatus)
        }

        processed++
      } catch (_eventErr) {
        errors++
      }
    }

    res.json(successResponse({ processed, errors, total: events.length }))
  } catch (err) {
    console.error('POST /api/webhooks/sendgrid error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TWILIO SMS STATUS CALLBACK
// ============================================================================

/**
 * POST /api/webhooks/twilio/sms
 * Handle Twilio SMS Status Callback
 */
webhookRoutes.post('/twilio/sms', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = req.body

    const messageSid = params.MessageSid || params.SmsSid || ''
    const messageStatus = (params.MessageStatus || params.SmsStatus || '').toLowerCase()

    if (!messageSid) {
      res.status(400).json(errorResponse('Missing MessageSid'))
      return
    }

    const statusMap: Record<string, string> = {
      queued: 'queued',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed',
    }
    const newStatus = statusMap[messageStatus] || messageStatus

    await updateSendLogByExternalId(db, messageSid, 'twilio', newStatus, messageStatus, {
      errorCode: params.ErrorCode,
      errorMessage: params.ErrorMessage,
    })

    await updateCommLogByExternalId(db, messageSid, 'twilio_sid', newStatus)

    // Return empty TwiML response
    res.type('text/xml').send('<Response></Response>')
  } catch (err) {
    console.error('POST /api/webhooks/twilio/sms error:', err)
    res.type('text/xml').send('<Response></Response>')
  }
})

// ============================================================================
// TWILIO VOICE STATUS CALLBACK
// ============================================================================

/**
 * POST /api/webhooks/twilio/voice
 * Handle Twilio Voice Status Callback
 */
webhookRoutes.post('/twilio/voice', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = req.body

    const callSid = params.CallSid || ''
    const callStatus = (params.CallStatus || '').toLowerCase()

    if (!callSid) {
      res.status(400).json(errorResponse('Missing CallSid'))
      return
    }

    const statusMap: Record<string, string> = {
      initiated: 'sent',
      ringing: 'sent',
      'in-progress': 'sent',
      completed: 'completed',
      busy: 'failed',
      'no-answer': 'failed',
      failed: 'failed',
      canceled: 'failed',
    }
    const newStatus = statusMap[callStatus] || callStatus

    await updateSendLogByExternalId(db, callSid, 'twilio', newStatus, callStatus, {
      duration: params.CallDuration,
      recordingUrl: params.RecordingUrl,
      recordingSid: params.RecordingSid,
    })

    // Update comm log with duration + recording
    const updates: Record<string, unknown> = { status: newStatus }
    if (params.CallDuration) updates.duration_seconds = parseInt(params.CallDuration)
    if (params.RecordingUrl) updates.recording_url = params.RecordingUrl
    await updateCommLogByExternalIdWithData(db, callSid, 'twilio_sid', updates)

    res.type('text/xml').send('<Response></Response>')
  } catch (err) {
    console.error('POST /api/webhooks/twilio/voice error:', err)
    res.type('text/xml').send('<Response></Response>')
  }
})

// ============================================================================
// DOCUSIGN CONNECT WEBHOOK
// ============================================================================

/**
 * POST /api/webhooks/docusign
 * Handle DocuSign Connect events (envelope status changes).
 *
 * DocuSign Connect can send JSON or XML. We handle both defensively.
 * Maps DocuSign statuses to our pipeline statuses and updates dex_packages.
 */
webhookRoutes.post('/docusign', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let envelopeId = ''
    let dsStatus = ''

    const body = req.body

    // Handle JSON payload (preferred)
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      // DocuSign Connect JSON format
      envelopeId = body.envelopeId || body.EnvelopeId || ''
      dsStatus = (body.status || body.Status || '').toLowerCase()

      // Nested envelope status event format
      if (!envelopeId && body.envelopeStatus) {
        envelopeId = body.envelopeStatus.envelopeId || ''
        dsStatus = (body.envelopeStatus.status || '').toLowerCase()
      }

      // DocuSign Connect v2 format
      if (!envelopeId && body.data) {
        envelopeId = body.data.envelopeId || ''
        dsStatus = (body.data.envelopeSummary?.status || '').toLowerCase()
      }
    }

    // Handle XML payload defensively (extract envelope ID and status from string)
    if (!envelopeId && typeof body === 'string') {
      const envelopeMatch = body.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/i)
      if (envelopeMatch) envelopeId = envelopeMatch[1]

      const statusMatch = body.match(/<Status>([^<]+)<\/Status>/i)
      if (statusMatch) dsStatus = statusMatch[1].toLowerCase()
    }

    if (!envelopeId) {
      res.status(200).json(successResponse({ processed: false, reason: 'No envelope ID found' }))
      return
    }

    // Map DocuSign statuses to our pipeline statuses
    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'SENT',
      signed: 'SIGNED',
      completed: 'COMPLETE',
      voided: 'VOIDED',
      declined: 'DECLINED',
    }

    const newStatus = statusMap[dsStatus]
    if (!newStatus) {
      // Unknown status — log but don't fail
      res.status(200).json(successResponse({ processed: false, reason: `Unmapped status: ${dsStatus}` }))
      return
    }

    // Find the package by docusign_envelope_id
    const pkgSnap = await db
      .collection('dex_packages')
      .where('docusign_envelope_id', '==', envelopeId)
      .limit(1)
      .get()

    if (pkgSnap.empty) {
      // No matching package — could be from an envelope created outside our system
      res.status(200).json(successResponse({ processed: false, reason: 'No matching package' }))
      return
    }

    const pkgDoc = pkgSnap.docs[0]
    const pkgData = pkgDoc.data()
    const oldStatus = pkgData.status as string
    const now = new Date().toISOString()

    // Build updates
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    }

    // Set timestamp fields based on status
    if (newStatus === 'SENT' && !pkgData.sent_at) updates.sent_at = now
    if (newStatus === 'SIGNED') updates.signed_at = now
    if (newStatus === 'COMPLETE') updates.completed_at = now
    if (dsStatus === 'delivered') updates.viewed_at = now

    await pkgDoc.ref.update(updates)

    // Log event to audit trail
    const eventId = `EVT_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    await db.collection('dex_package_events').doc(eventId).set({
      event_id: eventId,
      package_id: pkgDoc.id,
      event_type: 'DOCUSIGN_WEBHOOK',
      from_status: oldStatus,
      to_status: newStatus,
      source: 'docusign_webhook',
      actor: 'docusign',
      metadata: {
        envelope_id: envelopeId,
        docusign_status: dsStatus,
        raw_event_type: body?.event || body?.eventType || dsStatus,
      },
      timestamp: now,
    })

    res.status(200).json(successResponse({
      processed: true,
      package_id: pkgDoc.id,
      old_status: oldStatus,
      new_status: newStatus,
    }))
  } catch (err) {
    console.error('POST /api/webhooks/docusign error:', err)
    // Always return 200 to DocuSign to prevent retries on processing errors
    res.status(200).json(errorResponse(String(err)))
  }
})

// ============================================================================
// HELPERS
// ============================================================================

async function updateSendLogByExternalId(
  db: FirebaseFirestore.Firestore,
  externalId: string,
  provider: string,
  newStatus: string,
  eventType: string,
  eventData: Record<string, unknown>
) {
  try {
    const snap = await db
      .collection('campaign_send_log')
      .where('external_id', '==', externalId)
      .where('provider', '==', provider)
      .limit(1)
      .get()

    if (snap.empty) return

    const doc = snap.docs[0]
    const updates: Record<string, unknown> = { status: newStatus }
    const now = new Date().toISOString()

    if (newStatus === 'delivered') updates.delivered_at = now
    else if (newStatus === 'opened') updates.opened_at = now
    else if (newStatus === 'clicked') updates.clicked_at = now
    else if (newStatus === 'bounced') updates.bounced_at = now

    if (eventData.errorCode || eventData.errorMessage || eventData.reason) {
      updates.error_message = eventData.errorCode
        ? `${eventData.errorCode}: ${eventData.errorMessage || ''}`
        : String(eventData.reason || eventData.errorMessage || '')
    }

    await doc.ref.update(updates)
  } catch (_err) {
    // Non-fatal
  }
}

async function updateCommLogByExternalId(
  db: FirebaseFirestore.Firestore,
  externalId: string,
  fieldName: string,
  newStatus: string
) {
  try {
    const snap = await db
      .collection('communication_log')
      .where(fieldName, '==', externalId)
      .limit(1)
      .get()

    if (snap.empty) return

    await snap.docs[0].ref.update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
  } catch (_err) {
    // Non-fatal
  }
}

async function updateCommLogByExternalIdWithData(
  db: FirebaseFirestore.Firestore,
  externalId: string,
  fieldName: string,
  updates: Record<string, unknown>
) {
  try {
    const snap = await db
      .collection('communication_log')
      .where(fieldName, '==', externalId)
      .limit(1)
      .get()

    if (snap.empty) return

    updates.updated_at = new Date().toISOString()
    await snap.docs[0].ref.update(updates)
  } catch (_err) {
    // Non-fatal
  }
}
