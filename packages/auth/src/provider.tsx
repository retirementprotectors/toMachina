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
