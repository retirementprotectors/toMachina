/**
 * Communications routes — Twilio SMS/Voice + SendGrid Email.
 * Ported from RAPID_COMMS GAS library.
 * Supports ?dryRun=true for testing without actually sending.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, validateRequired, param } from '../lib/helpers.js'

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
        sent_by: (req as any).user?.email || 'api',
      })
      res.status(200).json(successResponse({ statusCode: 200, messageId: null, to, from, dryRun: true, commId }))
      return
    }

    const result = await sendgridRequest('POST', '/v3/mail/send', sgPayload)
    const commId = await logCommunication({
      channel: 'email', direction: 'outbound', recipient: to,
      subject: body.subject || '[template]', status: 'sent',
      message_id: result.messageId,
      sent_by: (req as any).user?.email || 'api',
    })
    res.status(201).json(successResponse({ statusCode: result.statusCode, messageId: result.messageId, to, from, commId }))
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
        sent_by: (req as any).user?.email || 'api',
      })
      res.status(200).json(successResponse({ messageSid: null, to, from, status: 'dry_run', dryRun: true, commId }))
      return
    }

    const payload: Record<string, string> = { To: to, From: from, Body: messageBody }
    if (body.statusCallback) payload.StatusCallback = String(body.statusCallback)

    const result = await twilioRequest('POST', 'Messages.json', payload)
    const commId = await logCommunication({
      channel: 'sms', direction: 'outbound', recipient: to,
      body: messageBody, status: String(result.status || 'queued'),
      message_sid: String(result.sid || ''),
      sent_by: (req as any).user?.email || 'api',
    })
    res.status(201).json(successResponse({
      messageSid: result.sid, to: result.to, from: result.from,
      status: result.status, dateCreated: result.date_created,
      numSegments: result.num_segments, commId,
    }))
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
        sent_by: (req as any).user?.email || 'api',
      })
      res.status(200).json(successResponse({ callSid: null, to, from, status: 'dry_run', dryRun: true, commId }))
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
      sent_by: (req as any).user?.email || 'api',
    })
    res.status(201).json(successResponse({
      callSid: result.sid, to: result.to, from: result.from,
      status: result.status, direction: result.direction,
      dateCreated: result.date_created, commId,
    }))
  } catch (err) {
    console.error('POST /api/comms/send-voice error:', err)
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
    res.json(successResponse({
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
    }))
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
