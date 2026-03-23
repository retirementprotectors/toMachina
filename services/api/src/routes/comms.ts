/**
 * Communications routes — Twilio SMS/Voice + SendGrid Email.
 * Ported from RAPID_COMMS GAS library.
 * Supports ?dryRun=true for testing without actually sending.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import AccessToken from 'twilio/lib/jwt/AccessToken.js'
import { successResponse, errorResponse, validateRequired, param } from '../lib/helpers.js'
import type {
  CommsSendEmailResult,
  CommsSendEmailDryRunResult,
  CommsSendSmsResult,
  CommsSendSmsDryRunResult,
  CommsSendVoiceResult,
  CommsSendVoiceDryRunResult,
  CommsLogCallResult,
  CommsMessageStatusData,
  CommsCallStatusData,
} from '@tomachina/core'

export const commsRoutes = Router()

const COLLECTION = 'communications'

// ============================================================================
// Env vars
// ============================================================================

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+18886208587',
    smsNumber: process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER || '+18886208587',
  }
}

function getSendGridConfig() {
  return {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@retireprotected.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'Retirement Protectors',
  }
}

// ============================================================================
// Twilio HTTP helper
// ============================================================================

async function twilioRequest(
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, string>
): Promise<Record<string, unknown>> {
  const { accountSid, authToken } = getTwilioConfig()
  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured')

  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
  }

  const options: RequestInit = { method, headers }

  let url = baseUrl
  if (method === 'POST' && payload) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    options.body = new URLSearchParams(payload).toString()
  } else if (method === 'GET' && payload) {
    url += '?' + new URLSearchParams(payload).toString()
  }

  options.headers = headers
  const response = await fetch(url, options)
  const body = await response.text()

  if (!response.ok) {
    const parsed = safeJsonParse(body)
    const msg = parsed?.message || parsed?.error_message || body
    throw new Error(`Twilio API error (${response.status}): ${msg}`)
  }

  if (response.status === 204) return { _statusCode: 204 }
  return safeJsonParse(body) || { _statusCode: response.status }
}

// ============================================================================
// SendGrid HTTP helper
// ============================================================================

async function sendgridRequest(
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, unknown>
): Promise<{ statusCode: number; messageId: string | null; body?: unknown }> {
  const { apiKey } = getSendGridConfig()
  if (!apiKey) throw new Error('SendGrid API key not configured')

  const url = `https://api.sendgrid.com${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const options: RequestInit = { method, headers }
  if (method === 'POST' && payload) {
    options.body = JSON.stringify(payload)
  }

  const response = await fetch(url, options)
  const messageId = response.headers.get('X-Message-Id') || response.headers.get('x-message-id') || null

  if (response.status === 202) {
    return { statusCode: 202, messageId }
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`SendGrid API error (${response.status}): ${body}`)
  }

  const body = await response.json()
  return { statusCode: response.status, messageId, body }
}

// ============================================================================
// Firestore logging helper
// ============================================================================

async function logCommunication(data: Record<string, unknown>) {
  const db = getFirestore()
  const id = crypto.randomUUID()
  await db.collection(COLLECTION).doc(id).set({
    comm_id: id,
    ...data,
    created_at: new Date().toISOString(),
  })
  return id
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/comms/send-email
 * Send email via SendGrid.
 */
commsRoutes.post('/send-email', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['to'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const to = String(body.to)
    const dryRun = req.query.dryRun === 'true'
    const { fromEmail, fromName } = getSendGridConfig()

    const from = String(body.from || fromEmail)
    const fromNameVal = String(body.fromName || fromName)
    const templateId = body.templateId ? String(body.templateId) : undefined

    // Build SendGrid payload
    const sgPayload: Record<string, unknown> = {
      personalizations: [{
        to: [{ email: to }],
        ...(templateId && body.dynamicTemplateData ? { dynamic_template_data: body.dynamicTemplateData } : {}),
      }],
      from: { email: from, name: fromNameVal },
    }

    if (templateId) {
      sgPayload.template_id = templateId
    } else {
      sgPayload.subject = String(body.subject || 'No Subject')
      sgPayload.content = [{ type: 'text/html', value: String(body.html || body.text || '') }]
    }

    if (body.replyTo) sgPayload.reply_to = { email: String(body.replyTo) }
    if (body.categories) sgPayload.categories = body.categories

    if (dryRun) {
      const commId = await logCommunication({
        channel: 'email', direction: 'outbound', recipient: to,
        subject: body.subject || '[template]', status: 'dry_run',
        sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        client_id: body.client_id || null,
      })
      res.status(200).json(successResponse<CommsSendEmailDryRunResult>({ statusCode: 200, messageId: null, to, from, dryRun: true, commId } as unknown as CommsSendEmailDryRunResult))
      return
    }

    const result = await sendgridRequest('POST', '/v3/mail/send', sgPayload)
    const commId = await logCommunication({
      channel: 'email', direction: 'outbound', recipient: to,
      subject: body.subject || '[template]', status: 'sent',
      message_id: result.messageId,
      sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        client_id: body.client_id || null,
    })
    res.status(201).json(successResponse<CommsSendEmailResult>({ statusCode: result.statusCode, messageId: result.messageId, to, from, commId } as unknown as CommsSendEmailResult))
  } catch (err) {
    console.error('POST /api/comms/send-email error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/comms/send-sms
 * Send SMS via Twilio.
 */
commsRoutes.post('/send-sms', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['to', 'body'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const to = String(body.to)
    const messageBody = String(body.body)
    const dryRun = req.query.dryRun === 'true'
    const { smsNumber } = getTwilioConfig()
    const from = String(body.from || smsNumber)

    if (dryRun) {
      const commId = await logCommunication({
        channel: 'sms', direction: 'outbound', recipient: to,
        body: messageBody, status: 'dry_run',
        sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        client_id: body.client_id || null,
      })
      res.status(200).json(successResponse<CommsSendSmsDryRunResult>({ messageSid: null, to, from, status: 'dry_run', dryRun: true, commId } as unknown as CommsSendSmsDryRunResult))
      return
    }

    const payload: Record<string, string> = { To: to, From: from, Body: messageBody }
    if (body.statusCallback) payload.StatusCallback = String(body.statusCallback)

    const result = await twilioRequest('POST', 'Messages.json', payload)
    const commId = await logCommunication({
      channel: 'sms', direction: 'outbound', recipient: to,
      body: messageBody, status: String(result.status || 'queued'),
      message_sid: String(result.sid || ''),
      sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        client_id: body.client_id || null,
    })
    res.status(201).json(successResponse<CommsSendSmsResult>({
      messageSid: result.sid, to: result.to, from: result.from,
      status: result.status, dateCreated: result.date_created,
      numSegments: result.num_segments, commId,
    } as unknown as CommsSendSmsResult))
  } catch (err) {
    console.error('POST /api/comms/send-sms error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/comms/send-voice
 * Initiate voice call via Twilio.
 */
commsRoutes.post('/send-voice', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['to'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    if (!body.twiml && !body.url) {
      res.status(400).json(errorResponse('Either twiml or url is required'))
      return
    }

    const to = String(body.to)
    const dryRun = req.query.dryRun === 'true'
    const { phoneNumber } = getTwilioConfig()
    const from = String(body.from || phoneNumber)

    if (dryRun) {
      const commId = await logCommunication({
        channel: 'voice', direction: 'outbound', recipient: to,
        status: 'dry_run',
        sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        client_id: body.client_id || null,
      })
      res.status(200).json(successResponse<CommsSendVoiceDryRunResult>({ callSid: null, to, from, status: 'dry_run', dryRun: true, commId } as unknown as CommsSendVoiceDryRunResult))
      return
    }

    const payload: Record<string, string> = { To: to, From: from }
    if (body.twiml) payload.Twiml = String(body.twiml)
    if (body.url) payload.Url = String(body.url)
    if (body.record) payload.Record = 'true'
    if (body.statusCallback) payload.StatusCallback = String(body.statusCallback)
    if (body.machineDetection) payload.MachineDetection = String(body.machineDetection)

    const result = await twilioRequest('POST', 'Calls.json', payload)
    const commId = await logCommunication({
      channel: 'voice', direction: 'outbound', recipient: to,
      status: String(result.status || 'queued'),
      call_sid: String(result.sid || ''),
      sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        client_id: body.client_id || null,
    })
    res.status(201).json(successResponse<CommsSendVoiceResult>({
      callSid: result.sid, to: result.to, from: result.from,
      status: result.status, direction: result.direction,
      dateCreated: result.date_created, commId,
    } as unknown as CommsSendVoiceResult))
  } catch (err) {
    console.error('POST /api/comms/send-voice error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/comms/token
 * Generate a Twilio Access Token with VoiceGrant for the Twilio Client SDK.
 * Identity = authenticated user's email from Firebase auth middleware.
 */
commsRoutes.post('/token', async (req: Request, res: Response) => {
  try {
    const VoiceGrant = AccessToken.VoiceGrant

    const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
    const apiKeySid = process.env.TWILIO_API_KEY_SID || ''
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || ''
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID || ''

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      res.status(500).json(errorResponse('Twilio API key credentials not configured'))
      return
    }

    const identity = (req as unknown as { user?: { email?: string } }).user?.email || 'anonymous'

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    })

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    })
    token.addGrant(voiceGrant)

    res.json(successResponse({ token: token.toJwt(), identity }))
  } catch (err) {
    console.error('POST /api/comms/token error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/comms/webhook/voice
 * TwiML webhook — called by Twilio when Device.connect() is invoked from the browser.
 * Reads the To param and returns TwiML to dial the client's phone number.
 * Auth bypass: Twilio calls this directly, no Firebase token.
 */
commsRoutes.post('/webhook/voice', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>
    const to = body.To || ''
    const from = body.From || body.Caller || ''

    if (!to) {
      res.set('Content-Type', 'text/xml')
      res.send('<Response><Say>No destination number provided.</Say></Response>')
      return
    }

    const statusCallbackUrl =
      'https://tm-api-365181509090.us-central1.run.app/api/comms/webhook/call-status'

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+18886208587" record="record-from-answer-dual">
    <Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${statusCallbackUrl}">${to}</Number>
  </Dial>
</Response>`

    // Log outbound call to Firestore (fire-and-forget — don't block TwiML response)
    logCommunication({
      channel: 'voice',
      direction: 'outbound',
      recipient: to,
      sender: from,
      status: 'initiated',
      call_type: 'browser_sdk',
      caller_id: '+18886208587',
    }).catch((err: unknown) => console.error('comms/webhook/voice log error:', err))

    res.set('Content-Type', 'text/xml')
    res.send(twiml)
  } catch (err) {
    console.error('POST /api/comms/webhook/voice error:', err)
    res.set('Content-Type', 'text/xml')
    res.send('<Response><Say>An error occurred. Please try again.</Say></Response>')
  }
})

// ============================================================================
// Twilio Webhook Routes (no Firebase auth — Twilio calls these directly)
// ============================================================================

/**
 * POST /api/comms/webhook/voice-incoming
 * TRK-13655: Inbound voice call to the 888 toll-free number.
 * Routes the call to the browser client via Twilio Client. Logs to Firestore.
 */
commsRoutes.post('/webhook/voice-incoming', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>
    const from = body.From || ''
    const to = body.To || ''
    const callSid = body.CallSid || ''

    // Default identity to route to — Phase 2 will add smart routing
    const defaultIdentity = process.env.TWILIO_DEFAULT_IDENTITY || 'josh@retireprotected.com'

    // Log inbound call to Firestore (fire-and-forget — don't block TwiML response)
    logCommunication({
      channel: 'voice',
      direction: 'inbound',
      sender: from,
      recipient: to,
      call_sid: callSid,
      status: 'ringing',
      routed_to: defaultIdentity,
      call_type: 'inbound_phone',
    }).catch((err: unknown) => {
      console.error('webhook/voice-incoming Firestore log error:', err)
    })

    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `  <Dial record="record-from-answer-dual">`,
      `    <Client>${defaultIdentity}</Client>`,
      '  </Dial>',
      '  <Say>We\'re sorry, no one is available to take your call. Please leave a message.</Say>',
      '  <Record maxLength="120" action="/api/comms/webhook/voicemail" />',
      '</Response>',
    ].join('\n')

    res.set('Content-Type', 'text/xml')
    res.send(twiml)
  } catch (err) {
    console.error('POST /api/comms/webhook/voice-incoming error:', err)
    // Return valid empty TwiML on error so Twilio doesn't retry infinitely
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
})

/**
 * POST /api/comms/webhook/sms-incoming
 * TRK-13665: Inbound SMS to the 888 toll-free number.
 * Looks up client by phone number. Logs to Firestore. Returns empty TwiML (no auto-reply).
 */
commsRoutes.post('/webhook/sms-incoming', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>
    const from = body.From || ''
    const msgBody = body.Body || ''
    const messageSid = body.MessageSid || ''
    const numMedia = Number(body.NumMedia || '0')

    // Collect any media URLs
    const mediaUrls: string[] = []
    for (let i = 0; i < numMedia; i++) {
      const url = body[`MediaUrl${i}`]
      if (url) mediaUrls.push(url)
    }

    // Look up client by phone number (strip +1 and non-digits for matching)
    let clientId: string | null = null
    try {
      const db = getFirestore()
      const digits = from.replace(/\D/g, '').replace(/^1/, '')
      // Try cell_phone first, then phone — both fields are stored as plain digits
      const [cellSnap, phoneSnap] = await Promise.all([
        db.collection('clients').where('cell_phone', '==', digits).limit(1).get(),
        db.collection('clients').where('phone', '==', digits).limit(1).get(),
      ])
      const match = cellSnap.docs[0] || phoneSnap.docs[0]
      if (match) clientId = match.id
    } catch (lookupErr: unknown) {
      console.error('webhook/sms-incoming client lookup error:', lookupErr)
    }

    await logCommunication({
      channel: 'sms',
      direction: 'inbound',
      sender: from,
      body: msgBody,
      message_sid: messageSid,
      media_urls: mediaUrls,
      status: 'received',
      client_id: clientId,
    })

    // Empty TwiML — no auto-reply
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  } catch (err) {
    console.error('POST /api/comms/webhook/sms-incoming error:', err)
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
})

/**
 * POST /api/comms/webhook/recording-status
 * TRK-13650: Recording callback — updates Firestore comm doc with recording URL + duration.
 * Twilio POSTs when a recording is complete.
 */
commsRoutes.post('/webhook/recording-status', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>
    const callSid = body.CallSid || ''
    const recordingSid = body.RecordingSid || ''
    const recordingUrl = body.RecordingUrl || ''
    const recordingDuration = body.RecordingDuration ? Number(body.RecordingDuration) : null

    if (callSid && recordingUrl) {
      const db = getFirestore()
      const snap = await db
        .collection('communications')
        .where('call_sid', '==', callSid)
        .limit(1)
        .get()

      if (!snap.empty) {
        await snap.docs[0].ref.update({
          recording_url: `${recordingUrl}.mp3`,
          recording_sid: recordingSid,
          recording_duration: recordingDuration,
          updated_at: new Date().toISOString(),
        })
      } else {
        console.error(`webhook/recording-status: no comm doc found for CallSid ${callSid}`)
      }
    }

    res.status(204).send()
  } catch (err) {
    console.error('POST /api/comms/webhook/recording-status error:', err)
    res.status(204).send()
  }
})

/**
 * POST /api/comms/webhook/call-status
 * TRK-13650: Call status callback — updates Firestore comm doc on state changes.
 * Twilio POSTs on transitions: initiated → ringing → answered → completed.
 */
commsRoutes.post('/webhook/call-status', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>
    const callSid = body.CallSid || ''
    const callStatus = body.CallStatus || ''
    const callDuration = body.CallDuration ? Number(body.CallDuration) : null
    const direction = body.Direction || ''

    if (callSid && callStatus) {
      const db = getFirestore()
      const snap = await db
        .collection('communications')
        .where('call_sid', '==', callSid)
        .limit(1)
        .get()

      if (!snap.empty) {
        const update: Record<string, unknown> = {
          status: callStatus,
          updated_at: new Date().toISOString(),
        }
        if (callDuration !== null) update.duration = callDuration
        if (direction) update.direction = direction
        if (callStatus === 'completed') update.completed_at = new Date().toISOString()

        await snap.docs[0].ref.update(update)
      } else {
        console.error(`webhook/call-status: no comm doc found for CallSid ${callSid}`)
      }
    }

    res.status(204).send()
  } catch (err) {
    console.error('POST /api/comms/webhook/call-status error:', err)
    res.status(204).send()
  }
})

/**
 * POST /api/comms/log-call
 * Manually log a phone call (inbound or outbound) to Firestore.
 */
commsRoutes.post('/log-call', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['client_id'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const direction = String(body.direction || 'outbound')
    const outcome = String(body.outcome || 'connected')
    const notes = body.notes ? String(body.notes) : ''
    const duration = body.duration ? Number(body.duration) : null
    const clientId = String(body.client_id)

    const commId = await logCommunication({
      channel: 'voice',
      direction,
      recipient: body.recipient ? String(body.recipient) : null,
      status: outcome,
      body: notes,
      duration,
      client_id: clientId,
      sent_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
      call_type: 'manual_log',
    })

    res.status(201).json(successResponse<CommsLogCallResult>({ commId, direction, outcome, duration, notes } as unknown as CommsLogCallResult))
  } catch (err) {
    console.error('POST /api/comms/log-call error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/comms/status/:sid
 * Check delivery status of a message or call.
 */
commsRoutes.get('/status/:sid', async (req: Request, res: Response) => {
  try {
    const sid = param(req.params.sid)
    if (!sid) { res.status(400).json(errorResponse('sid is required')); return }

    // Determine type from SID prefix
    const isCall = sid.startsWith('CA')
    const path = isCall ? `Calls/${sid}.json` : `Messages/${sid}.json`

    const result = await twilioRequest('GET', path)
    res.json(successResponse<CommsMessageStatusData | CommsCallStatusData>({
      sid: result.sid,
      to: result.to,
      from: result.from,
      status: result.status,
      direction: result.direction,
      dateCreated: result.date_created,
      ...(isCall ? {
        startTime: result.start_time,
        endTime: result.end_time,
        duration: result.duration,
        answeredBy: result.answered_by,
        price: result.price,
        priceUnit: result.price_unit,
      } : {
        body: result.body,
        dateSent: result.date_sent,
        dateUpdated: result.date_updated,
        errorCode: result.error_code,
        errorMessage: result.error_message,
        numSegments: result.num_segments,
        price: result.price,
        priceUnit: result.price_unit,
      }),
    } as unknown as CommsMessageStatusData | CommsCallStatusData))
  } catch (err) {
    console.error('GET /api/comms/status/:sid error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Helpers
// ============================================================================

function safeJsonParse(str: string): Record<string, unknown> | null {
  try { return JSON.parse(str) } catch { return null }
}
