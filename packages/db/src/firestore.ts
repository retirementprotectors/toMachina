import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, collection, type Firestore } from 'firebase/firestore'
import { firebaseConfig } from '@tomachina/auth/src/config'

// Lazy singleton — initialized on first call, not at module load time.
// This prevents auth/invalid-api-key crashes during SSR/build.
let _db: Firestore | null = null

export function getDb(): Firestore {
  if (!_db) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    _db = getFirestore(app)
  }
  return _db
}

// Keep `db` export for backward compat — but callers should prefer getDb()
// in module-level code. Inside components/hooks (after mount), db works fine.
export const db = {} as Firestore // placeholder — use getDb() instead

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
  contentBlocks: () => collection(getDb(), 'content_blocks'),
  caseTasks: () => collection(getDb(), 'case_tasks'),
  communications: () => collection(getDb(), 'communications'),
  pipelines: () => collection(getDb(), 'pipelines'),
  sourceRegistry: () => collection(getDb(), 'source_registry'),
} as const

export type Collections = typeof collections
