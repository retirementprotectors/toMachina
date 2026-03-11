import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'

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
