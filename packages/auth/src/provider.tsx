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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ hd: 'retireprotected.com' })

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
    await signInWithPopup(auth, googleProvider)
  }

  const signOut = async () => {
    await fbSignOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
