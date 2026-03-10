import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, collection, type Firestore } from 'firebase/firestore'
import { firebaseConfig } from '@tomachina/auth/src/config'

// Lazy initialization — prevents crash during SSR/build when env vars aren't available
let _app: FirebaseApp | null = null
let _db: Firestore | null = null

function getApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return _app
}

function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getApp())
  }
  return _db
}

// Proxy that lazily initializes on first property access
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (getDb() as any)[prop]
  },
})

export const collections = {
  clients: () => collection(getDb(), 'clients'),
  agents: () => collection(getDb(), 'agents'),
  producers: () => collection(getDb(), 'producers'),
  opportunities: () => collection(getDb(), 'opportunities'),
  revenue: () => collection(getDb(), 'revenue'),
  carriers: () => collection(getDb(), 'carriers'),
  products: () => collection(getDb(), 'products'),
  users: () => collection(getDb(), 'users'),
  org: () => collection(getDb(), 'org'),
  campaigns: () => collection(getDb(), 'campaigns'),
  templates: () => collection(getDb(), 'templates'),
  caseTasks: () => collection(getDb(), 'case_tasks'),
  communications: () => collection(getDb(), 'communications'),
} as const

export type Collections = typeof collections
