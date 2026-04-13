/**
 * SendGrid Webhook Signature Verification Middleware
 *
 * SendGrid signs all Event Webhook and Inbound Parse payloads with an
 * ECDSA P-256 / SHA-256 key pair. This middleware validates the signature
 * before allowing a request to reach the route handler.
 *
 * Required env var (set in Cloud Run → Edit & deploy → Variables & Secrets):
 *
 *   SENDGRID_WEBHOOK_PUBLIC_KEY
 *
 *   Value: The ECDSA P-256 public key in PEM format. Find it in the
 *   SendGrid dashboard under:
 *     Settings → Mail Settings → Event Webhook → Signed Event Webhook
 *   Copy the "Public Key" value and paste it as the env var (include the
 *   full -----BEGIN PUBLIC KEY----- / -----END PUBLIC KEY----- block).
 *
 * SendGrid signature headers:
 *   X-Twilio-Email-Event-Webhook-Signature  — base64-encoded ECDSA signature
 *   X-Twilio-Email-Event-Webhook-Timestamp  — Unix timestamp (seconds, as string)
 *
 * The signed payload is: timestamp + rawBody (bytes), no separator.
 *
 * Raw body access:
 *   The middleware reads req.rawBody (a Buffer attached by the express.raw()
 *   hook in server.ts, registered BEFORE express.json()). If rawBody is
 *   absent (unlikely misconfiguration), it falls back to re-serialising the
 *   parsed body — adequate for JSON payloads but not for multipart (inbound).
 *
 * Fail-closed behaviour:
 *   - SENDGRID_WEBHOOK_PUBLIC_KEY unset → 500 (misconfiguration, not 401)
 *   - Missing headers → 401
 *   - Timestamp outside ±10 min replay window → 401
 *   - Invalid signature → 401
 *   - Valid signature → next()
 */

import { createVerify } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

const REPLAY_WINDOW_SECONDS = 600 // 10 minutes

/**
 * Express middleware that verifies the SendGrid ECDSA webhook signature.
 * Mount on routes BEFORE the route handler.
 */
export function verifySendGridSignature(req: Request, res: Response, next: NextFunction): void {
  // --- 1. Check env var is configured ---
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY
  if (!publicKey) {
    console.error('[sendgrid-verify] SENDGRID_WEBHOOK_PUBLIC_KEY is not set — rejecting request (fail-closed)')
    res.status(500).json({ success: false, error: 'Webhook verification not configured' })
    return
  }

  // --- 2. Extract headers ---
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined
  const timestampHeader = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined

  if (!signature || !timestampHeader) {
    res.status(401).json({ success: false, error: 'Missing SendGrid signature headers' })
    return
  }

  // --- 3. Replay window check ---
  const timestampSec = parseInt(timestampHeader, 10)
  if (isNaN(timestampSec)) {
    res.status(401).json({ success: false, error: 'Invalid timestamp header' })
    return
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - timestampSec) > REPLAY_WINDOW_SECONDS) {
    res.status(401).json({ success: false, error: 'Signature expired' })
    return
  }

  // --- 4. Build the payload that SendGrid signed: timestamp bytes + raw body bytes ---
  //    rawBody is attached by the express.raw() hook in server.ts (same pattern as
  //    GitHub webhook verification on /webhook/deploy). If it's absent, fall back to
  //    re-serialising the parsed JSON body (acceptable for JSON routes).
  let bodyBuffer: Buffer
  const extReq = req as Request & { rawBody?: Buffer }
  if (extReq.rawBody instanceof Buffer) {
    bodyBuffer = extReq.rawBody
  } else if (typeof req.body === 'object' && req.body !== null) {
    bodyBuffer = Buffer.from(JSON.stringify(req.body), 'utf8')
  } else if (typeof req.body === 'string') {
    bodyBuffer = Buffer.from(req.body, 'utf8')
  } else {
    bodyBuffer = Buffer.alloc(0)
  }

  const timestampBuffer = Buffer.from(timestampHeader, 'utf8')
  const payload = Buffer.concat([timestampBuffer, bodyBuffer])

  // --- 5. Verify ECDSA P-256 / SHA-256 signature ---
  try {
    const verifier = createVerify('SHA256')
    verifier.update(payload)
    const isValid = verifier.verify(publicKey, signature, 'base64')

    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid SendGrid signature' })
      return
    }
  } catch (_err) {
    // Catch malformed key / signature decode errors — treat as invalid
    res.status(401).json({ success: false, error: 'Signature verification failed' })
    return
  }

  next()
}
