import { type Request, type Response, type NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // External webhook routes — called by third-party services (Twilio, SendGrid,
  // DocuSign) without Firebase tokens. All routes under /webhooks/ and
  // /comms/webhook/ are public webhook endpoints.
  if (req.path.startsWith('/webhooks/') || req.path.startsWith('/comms/webhook/')) {
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
