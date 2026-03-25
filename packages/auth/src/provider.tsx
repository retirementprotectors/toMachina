'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
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

// Ensure LOCAL persistence is explicitly set (survives page refresh + browser close)
// Called once at module level so it runs before onAuthStateChanged is attached
let persistenceSet = false
function ensurePersistence() {
  if (persistenceSet || typeof window === 'undefined') return
  persistenceSet = true
  const auth = getFirebaseAuth()
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Non-fatal — fallback to default (which is also LOCAL in browser environments)
  })
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
    // Explicitly set LOCAL persistence before attaching the auth listener.
    // This ensures the session survives page refreshes.
    ensurePersistence()

    const auth = getFirebaseAuth()
    const unsubscribe = onAuthStateChanged(auth, (fbUser: User | null) => {
      if (fbUser && fbUser.email?.endsWith('@retireprotected.com')) {
        setUser({
          uid: fbUser.uid,
          email: fbUser.email!,
          displayName: fbUser.displayName || '',
          photoURL: fbUser.photoURL,
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
