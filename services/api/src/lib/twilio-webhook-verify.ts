/**
 * Twilio webhook signature verification middleware.
 * TKO-COMMS-005b
 *
 * Validates the X-Twilio-Signature header using HMAC-SHA1 per:
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Cloud Run sits behind a proxy, so we reconstruct the public URL from
 * X-Forwarded-Proto and X-Forwarded-Host headers — not from req.protocol/req.hostname,
 * which reflect the internal Cloud Run URL that Twilio never signed.
 */

import { validateRequest } from 'twilio/lib/webhooks/webhooks.js'
import type { Request, Response, NextFunction } from 'express'

/**
 * Reconstruct the public-facing URL that Twilio signed.
 * Uses X-Forwarded-* headers injected by the Cloud Run / load-balancer proxy.
 */
function reconstructPublicUrl(req: Request): string {
  const proto = req.get('x-forwarded-proto') || req.protocol
  const host = req.get('x-forwarded-host') || req.get('host') || ''
  return `${proto}://${host}${req.originalUrl}`
}

/**
 * Express middleware that verifies Twilio's HMAC-SHA1 webhook signature.
 *
 * Requires:
 *   - TWILIO_AUTH_TOKEN env var
 *   - express.urlencoded() body-parser already applied (body must be parsed)
 *
 * Responds 401 for missing or invalid signatures.
 * Calls next() for valid signatures.
 */
export function verifyTwilioSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authToken = process.env.TWILIO_AUTH_TOKEN || ''

  // If auth token is not configured, fail closed — never allow unverified requests
  if (!authToken) {
    res.status(401).json({ success: false, error: 'Twilio auth token not configured' })
    return
  }

  const signature = req.get('x-twilio-signature') || ''

  if (!signature) {
    res.status(401).json({ success: false, error: 'Missing Twilio signature' })
    return
  }

  const url = reconstructPublicUrl(req)

  // req.body is the parsed urlencoded form params (flat string→string object)
  const params = (req.body as Record<string, string>) || {}

  const isValid = validateRequest(authToken, signature, url, params)

  if (!isValid) {
    res.status(401).json({ success: false, error: 'Invalid Twilio signature' })
    return
  }

  next()
}
