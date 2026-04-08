import { type Request, type Response, type NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // External webhook routes — called by third-party services (Twilio, SendGrid,
  // DocuSign) without Firebase tokens. All routes under /webhooks/ and
  // /comms/webhook/ are public webhook endpoints.
  if (req.path.startsWith('/webhooks/') || req.path.startsWith('/comms/webhook/')) {
    return next()
  }

  // Public booking routes — called by unauthenticated clients via WordPress iframe.
  // search-clients STAYS auth-gated (client PII). Config, busy, and POST booking are public.
  if (req.path.startsWith('/booking/config/') || req.path === '/booking/busy' || (req.path === '/booking' && req.method === 'POST')) {
    return next()
  }

  // Cloud Scheduler routes — protected by Cloud Run IAM (OIDC), no Firebase token.
  if (req.path.startsWith('/document-index/scan')) {
    ;(req as any).user = { email: 'cron@retireprotected.com', name: 'Cloud Scheduler', uid: 'cron-service' }
    return next()
  }

  // VOLTRON Agent service auth — shared secret for server-to-server calls from VOLTRON
  const mdjAuth = req.headers['x-mdj-auth'] as string | undefined
  const mdjSecret = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'
  if (mdjAuth && mdjAuth === mdjSecret) {
    // Set a synthetic user context for VOLTRON agent calls
    ;(req as any).user = {
      email: 'voltron@retireprotected.com',
      name: 'VOLTRON Agent',
      uid: 'voltron-agent-service',
    }
    return next()
  }

  // TRK-13802: CI deploy registry regeneration — VOLTRON_CI_TOKEN from GitHub Actions
  const ciToken = req.headers['x-voltron-ci-token'] as string | undefined
  const ciSecret = process.env.VOLTRON_CI_TOKEN
  if (ciToken && ciSecret && ciToken === ciSecret) {
    ;(req as any).user = {
      email: 'ci-deploy@retireprotected.com',
      name: 'CI Registry Regenerator',
      uid: 'ci-deploy-service',
      role: 'ADMIN',
    }
    return next()
  }

  const authHeader = (req.headers['x-forwarded-authorization'] as string | undefined) || req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing auth token' })
    return
  }

  try {
    const token = authHeader.split('Bearer ')[1]
    const decoded = await getAuth().verifyIdToken(token)
    if (!decoded.email?.endsWith('@retireprotected.com')) {
      res.status(403).json({ success: false, error: 'Unauthorized domain' })
      return
    }
    ;(req as any).user = decoded
    next()
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid auth token' })
  }
}
