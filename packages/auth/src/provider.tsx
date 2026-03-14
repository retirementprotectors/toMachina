'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
  level?: number
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

  // Build entitlement context from Firestore profile (or defaults)
  const ctx = buildEntitlementContext(
    user,
    profile
      ? {
          userLevel: (profile.user_level as UserEntitlementContext['userLevel']) || undefined,
          modulePermissions: profile.module_permissions as UserEntitlementContext['modulePermissions'],
          assignedModules: [
            ...(profile.assigned_pipelines || []),
            ...(profile.assigned_apps || []),
          ],
        }
      : undefined
  )

  return (
    <EntitlementContext.Provider value={{ ctx, loading, profile }}>
      {children}
    </EntitlementContext.Provider>
  )
}
