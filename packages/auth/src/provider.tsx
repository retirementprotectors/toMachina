'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { getDb } from '@tomachina/db/src/firestore'
import { buildEntitlementContext } from './entitlements'
import type { UserEntitlementContext } from './entitlements'
import { firebaseConfig } from './config'

// Lazy initialization — prevents crash during SSR/build
function getFirebaseAuth() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  return getAuth(app)
}

function getGoogleProvider() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ hd: 'retireprotected.com' })
  return provider
}

export interface AuthUser {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  /**
   * Partner slug from the Firebase ID token's `partner_id` custom claim
   * (set by the `onPartnerUserCreate` Cloud Function — ZRD-PLAT-MT-007).
   * `null` for RPI users and super-admins. Drives tenant-aware UI gating
   * such as the MDJ Panel belt flag (hidden from partner users until
   * VOLTRON's partner-context awareness ships in MT-014).
   */
  partnerId: string | null
  /** Role custom claim: 'rpi', 'partner_agent', 'partner_admin', 'superadmin'. */
  role: string | null
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (!fbUser) {
        setUser(null)
        setLoading(false)
        return
      }

      // Read partner_id + role custom claims from the ID token (ZRD-PLAT-MT-002/007).
      // Partner users may not be on @retireprotected.com — we trust the claim.
      let partnerId: string | null = null
      let role: string | null = null
      try {
        const tokenResult = await fbUser.getIdTokenResult()
        const raw = tokenResult.claims as { partner_id?: unknown; role?: unknown }
        if (typeof raw.partner_id === 'string' && raw.partner_id.length > 0) {
          partnerId = raw.partner_id
        }
        if (typeof raw.role === 'string' && raw.role.length > 0) {
          role = raw.role
        }
      } catch {
        // non-fatal: absent claims just mean the user is treated as an RPI user
      }

      const isRpiDomain = fbUser.email?.endsWith('@retireprotected.com') ?? false
      const isPartnerClaim = partnerId !== null
      const isSuperAdmin = role === 'superadmin'

      if (isRpiDomain || isPartnerClaim || isSuperAdmin) {
        setUser({
          uid: fbUser.uid,
          email: fbUser.email!,
          displayName: fbUser.displayName || '',
          photoURL: fbUser.photoURL,
          partnerId,
          role,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signIn = async () => {
    await signInWithPopup(getFirebaseAuth(), getGoogleProvider())
  }

  const signOut = async () => {
    await fbSignOut(getFirebaseAuth())
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================================================
// USER PROFILE + ENTITLEMENTS (Firestore-backed)
// ============================================================================

export interface UserProfile {
  email: string
  first_name?: string
  last_name?: string
  display_name?: string
  photo_url?: string
  /** Numeric level is the single source of truth: 0=OWNER, 1=EXECUTIVE, 2=LEADER, 3=USER */
  level?: number
  /** @deprecated Use `level` instead. Kept for backward compat reads only. */
  user_level?: string
  status?: string
  division?: string
  unit?: string
  role_template?: string
  module_permissions?: Record<string, string[]>
  assigned_pipelines?: string[]
  assigned_apps?: string[]
}

export interface EntitlementState {
  ctx: UserEntitlementContext
  loading: boolean
  profile: UserProfile | null
}

const DEFAULT_ENTITLEMENT_STATE: EntitlementState = {
  ctx: { email: '', userLevel: 'USER' },
  loading: true,
  profile: null,
}

const EntitlementContext = createContext<EntitlementState>(DEFAULT_ENTITLEMENT_STATE)

export function useEntitlements(): EntitlementState {
  return useContext(EntitlementContext)
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const docRef = doc(getDb(), 'users', user.email)
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile)
        } else {
          // No Firestore doc — fall back to minimal profile
          setProfile(null)
        }
        setLoading(false)
      },
      () => {
        // Firestore error — degrade gracefully, default to USER level
        setProfile(null)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Single source of truth: numeric level → string name
  const LEVEL_TO_NAME: Record<number, UserEntitlementContext['userLevel']> = {
    0: 'OWNER',
    1: 'EXECUTIVE',
    2: 'LEADER',
    3: 'USER',
  }

  // Build entitlement context from Firestore profile (or defaults)
  const ctx = useMemo(() => buildEntitlementContext(
    user,
    profile
      ? {
          userLevel: LEVEL_TO_NAME[profile.level ?? 3] || 'USER',
          modulePermissions: profile.module_permissions as UserEntitlementContext['modulePermissions'],
          assignedModules: [
            // Legacy arrays (backward compat)
            ...(profile.assigned_pipelines || []),
            ...(profile.assigned_apps || []),
            // Modern: extract PIPELINE_* and app moduleKeys from module_permissions
            ...Object.entries(profile.module_permissions || {})
              .filter(([, perms]) => Array.isArray(perms) && perms.length > 0)
              .map(([key]) => key),
          ],
        }
      : undefined
  ), [user, profile])

  return (
    <EntitlementContext.Provider value={{ ctx, loading, profile }}>
      {children}
    </EntitlementContext.Provider>
  )
}
