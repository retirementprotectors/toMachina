import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export const smsConsentRoutes = Router()

// ─── Constants ────────────────────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '+18886208587'

// MUSASHI Part 3 — Confirmation SMS (155 chars). Verbatim per sms-consent-copy.md v1.0.
// Do not edit without MUSASHI + JDM sign-off. Increment MUSASHI_COPY_VERSION in page.tsx.
const SMS_PART3_CONFIRMATION_BODY =
  "You're signed up for Retirement Protectors SMS updates. Msg & data rates may apply. Reply HELP for help, STOP to cancel. We're Your People."

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidE164(phone: string): boolean {
  return /^\+1[2-9]\d{9}$/.test(phone)
}

// ─── POST /public/sms-consent ─────────────────────────────────────────────────
// Public endpoint — no Firebase Auth required. Cold-lead opt-in funnel.
// SHINOB1 ruling 2026-04-13: public, not token-gated.
//
// Required body fields: phone_e164, consented, copy_version, source_channel, source_url
// Optional body fields: lead_id, device_fingerprint
//
// PII: phone_e164 stored in Firestore only. Never surfaces in logs or error responses.

smsConsentRoutes.post('/', async (req: Request, res: Response) => {
  const fs = getFirestore()

  const {
    phone_e164,
    consented,
    copy_version,
    source_channel,
    source_url,
    lead_id,
    device_fingerprint,
  } = req.body as {
    phone_e164?: string
    consented?: boolean
    copy_version?: string
    source_channel?: string
    source_url?: string
    lead_id?: string | null
    device_fingerprint?: string | null
  }

  // ── Step 1: Validate required fields ────────────────────────────────────────
  if (!phone_e164 || !isValidE164(phone_e164)) {
    res.status(400).json({ success: false, error: 'A valid US mobile number in E.164 format is required.' })
    return
  }
  if (consented !== true) {
    res.status(400).json({ success: false, error: 'Consent checkbox must be checked.' })
    return
  }
  if (!copy_version) {
    res.status(400).json({ success: false, error: 'copy_version is required.' })
    return
  }
  if (!source_channel) {
    res.status(400).json({ success: false, error: 'source_channel is required.' })
    return
  }
  if (!source_url) {
    res.status(400).json({ success: false, error: 'source_url is required.' })
    return
  }

  // ── Step 2: Write to sms_consent_log ────────────────────────────────────────
  // Must succeed before Twilio send. The Firestore record is the TCPA legal artifact.
  // Opt-in records retained for 5 years minimum (MUSASHI compliance note v1.0).
  // PII: phone_e164 written to Firestore only. Never in logs or error messages.
  const ipAddress =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'

  const consentRecord = {
    phone_e164,
    consented_at: FieldValue.serverTimestamp(),
    ip_address: ipAddress,
    user_agent: req.headers['user-agent'] || 'unknown',
    copy_version,
    source_url,
    source_channel,
    confirmation_sms_sent: false,
    client_id: null,
    lead_id: lead_id || null,
    device_fingerprint: device_fingerprint || null,
    created_by: 'system:sms-consent-page',
  }

  const consentCol = fs.collection('sms_consent_log')
  let consentId: string
  let docRef: FirebaseFirestore.DocumentReference
  try {
    docRef = await consentCol.add(consentRecord)
    consentId = docRef.id
  } catch (err) {
    // Sanitized — no PII in error output
    const msg = err instanceof Error ? err.message : 'unknown'
    process.stderr.write(`[sms-consent] Firestore write failed: ${msg}\n`)
    res.status(500).json({ success: false, error: 'Failed to record consent. Please try again.' })
    return
  }

  // ── Step 3: Send Twilio confirmation SMS (MUSASHI Part 3) ──────────────────
  // If Twilio fails: return success — consent record is already written (legal record).
  // Errors logged to stderr only. No PII surfaces in any log output.
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
      const params = new URLSearchParams({
        To: phone_e164,
        From: TWILIO_FROM_NUMBER,
        Body: SMS_PART3_CONFIRMATION_BODY,
      })
      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })
      if (twilioRes.ok) {
        // Non-fatal if this update fails — consent record is already safe
        await docRef.update({ confirmation_sms_sent: true }).catch(() => undefined)
      } else {
        process.stderr.write(`[sms-consent] Twilio send failed — HTTP ${twilioRes.status}\n`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      process.stderr.write(`[sms-consent] Twilio send error: ${msg}\n`)
    }
  }

  // ── Step 4: Return success ─────────────────────────────────────────────────
  res.status(200).json({ success: true, data: { consent_id: consentId } })
})
