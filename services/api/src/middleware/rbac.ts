import { type Request, type Response, type NextFunction } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { errorResponse } from '../lib/helpers.js'
import type { UserLevelName, ModuleAction } from '@tomachina/core'

// 60-second profile cache to avoid hammering Firestore
const profileCache = new Map<string, { data: UserProfileData; expires: number }>()
const CACHE_TTL_MS = 60_000

const LEVEL_NAMES: Record<number, string> = { 0: 'OWNER', 1: 'EXECUTIVE', 2: 'LEADER', 3: 'USER' }

interface UserProfileData {
  email: string
  /** Single source of truth: 0=OWNER, 1=EXECUTIVE, 2=LEADER, 3=USER */
  level: number
  /** Derived from level — kept on the cached object for convenience */
  user_level: string
  module_permissions?: Record<string, string[]>
  status?: string
}

async function getUserProfile(email: string): Promise<UserProfileData | null> {
  const now = Date.now()
  const cached = profileCache.get(email)
  if (cached && cached.expires > now) return cached.data

  const db = getFirestore()
  const doc = await db.collection('users').doc(email).get()
  if (!doc.exists) return null

  const data = doc.data() as UserProfileData
  const numLevel = typeof data.level === 'number' ? data.level : 3
  const profile: UserProfileData = {
    email: data.email || email,
    level: numLevel,
    user_level: LEVEL_NAMES[numLevel] || 'USER',
    module_permissions: data.module_permissions,
    status: data.status,
  }

  profileCache.set(email, { data: profile, expires: now + CACHE_TTL_MS })
  return profile
}

export function invalidateProfileCache(email: string): void {
  profileCache.delete(email)
}

const LEVEL_MAP: Record<string, number> = { OWNER: 0, EXECUTIVE: 1, LEADER: 2, USER: 3 }

export function requireLevel(minLevel: UserLevelName) {
  const minNumeric = LEVEL_MAP[minLevel] ?? 3
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = (req as unknown as { user?: { email?: string } }).user?.email
    if (!email) { res.status(401).json(errorResponse('Authentication required')); return }

    const profile = await getUserProfile(email)
    if (!profile) {
      if (minNumeric < 3) { res.status(403).json(errorResponse(`Insufficient permissions -- ${minLevel} or higher required`)); return }
      ;(req as unknown as Record<string, unknown>).userProfile = { email, level: 3, user_level: 'USER' } as UserProfileData
      next(); return
    }

    if (profile.status && profile.status.toLowerCase() !== 'active') { res.status(403).json(errorResponse('Account is not active')); return }

    const userLevel = typeof profile.level === 'number' ? profile.level : 3
    if (userLevel > minNumeric) { res.status(403).json(errorResponse(`Insufficient permissions -- ${minLevel} or higher required`)); return }

    ;(req as unknown as Record<string, unknown>).userProfile = profile
    next()
  }
}

export function requireModuleAccess(moduleKey: string, action?: ModuleAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = (req as unknown as { user?: { email?: string } }).user?.email
    if (!email) { res.status(401).json(errorResponse('Authentication required')); return }

    const profile = await getUserProfile(email)
    if (profile?.status && profile.status.toLowerCase() !== 'active') { res.status(403).json(errorResponse('Account is not active')); return }

    const userLevel = profile?.level ?? 3
    if (userLevel === 0) { ;(req as unknown as Record<string, unknown>).userProfile = profile; next(); return }

    const perms = profile?.module_permissions?.[moduleKey]
    if (!perms || perms.length === 0) { res.status(403).json(errorResponse(`Access denied -- no permission for module ${moduleKey}`)); return }
    if (action && !perms.includes(action)) { res.status(403).json(errorResponse(`Access denied -- ${action} permission required for ${moduleKey}`)); return }

    ;(req as unknown as Record<string, unknown>).userProfile = profile
    next()
  }
}
