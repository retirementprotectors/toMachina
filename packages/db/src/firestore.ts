import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, type Firestore } from 'firebase/firestore'
import { firebaseConfig } from '@tomachina/auth/src/config'

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const db: Firestore = getFirestore(app)

export const collections = {
  clients: collection(db, 'clients'),
  agents: collection(db, 'agents'),
  producers: collection(db, 'producers'),
  opportunities: collection(db, 'opportunities'),
  revenue: collection(db, 'revenue'),
  carriers: collection(db, 'carriers'),
  products: collection(db, 'products'),
  users: collection(db, 'users'),
  org: collection(db, 'org'),
  campaigns: collection(db, 'campaigns'),
  templates: collection(db, 'templates'),
  caseTasks: collection(db, 'case_tasks'),
  communications: collection(db, 'communications'),
} as const

export type Collections = typeof collections
