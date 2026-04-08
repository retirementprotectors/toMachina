import { type Request, type Response, type NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// ─── User Profile Enrichment (60s cache) ──────────────────────────────────────
const enrichCache = new Map<string, { data: EnrichedUser; expires: number }>()
const ENRICH_TTL_MS = 60_000

interface EnrichedUser {
  level: number
  user_level: string
  role_template?: string
  module_permissions?: Record<string, string[]>
}

const LEVEL_NAMES: Record<number, string> = { 0: 'OWNER', 1: 'EXECUTIVE', 2: 'LEADER', 3: 'USER' }

async function enrichUser(email: string): Promise<EnrichedUser> {
  const now = Date.now()
  const cached = enrichCache.get(email)
  if (cached && cached.expires > now) return cached.data

  const db = getFirestore()
  const doc = await db.collection('users').doc(email).get()
  if (!doc.exists) return { level: 3, user_level: 'USER' }

  const data = doc.data()!
  const numLevel = typeof data.level === 'number' ? data.level : 3
  const enriched: EnrichedUser = {
    level: numLevel,
    user_level: LEVEL_NAMES[numLevel] || 'USER',
    role_template: data.role_template,
    module_permissions: data.module_permissions,
  }

  enrichCache.set(email, { data: enriched, expires: now + ENRICH_TTL_MS })
  return enriched
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // External webhook routes
  if (req.path.startsWith('/webhooks/') || req.path.startsWith('/comms/webhook/')) {
    return next()
  }

  // Public booking routes
  if (req.path.startsWith('/booking/config/') || req.path === '/booking/busy' || (req.path === '/booking' && req.method === 'POST')) {
    return next()
  }

  // Cloud Scheduler routes
  if (req.path.startsWith('/document-index/scan')) {
    ;(req as any).user = { email: 'cron@retireprotected.com', name: 'Cloud Scheduler', uid: 'cron-service', level: 0, user_level: 'OWNER' }
    return next()
  }

  // VOLTRON Agent service auth
  const mdjAuth = req.headers['x-mdj-auth'] as string | undefined
  const mdjSecret = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'
  if (mdjAuth && mdjAuth === mdjSecret) {
    ;(req as any).user = {
      email: 'voltron@retireprotected.com',
      name: 'VOLTRON Agent',
      uid: 'voltron-agent-service',
      level: 0,
      user_level: 'OWNER',
    }
    return next()
  }

  // CI deploy registry regeneration
  const ciToken = req.headers['x-voltron-ci-token'] as string | undefined
  const ciSecret = process.env.VOLTRON_CI_TOKEN
  if (ciToken && ciSecret && ciToken === ciSecret) {
    ;(req as any).user = {
      email: 'ci-deploy@retireprotected.com',
      name: 'CI Registry Regenerator',
      uid: 'ci-deploy-service',
      level: 0,
      user_level: 'OWNER',
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

    // APR-01: Enrich with Firestore user profile (level, permissions, role_template)
    const profile = await enrichUser(decoded.email)
    ;(req as any).user = {
      ...decoded,
      level: profile.level,
      user_level: profile.user_level,
      role_template: profile.role_template,
      module_permissions: profile.module_permissions,
    }

    next()
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid auth token' })
  }
}
