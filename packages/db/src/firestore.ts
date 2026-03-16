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
  /** @deprecated Use `producers` for external producers and resolve internal agents from `users` (is_agent: true). Retained during transition. */
  agents: () => collection(getDb(), 'agents'),
  /** External producers (recruited via DAVID/SENTINEL). Replaces internal team entries formerly in agents. */
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
  activities: () => collection(getDb(), 'activities'),
  campaignSendLog: () => collection(getDb(), 'campaign_send_log'),
  campaignDeliveryEvents: () => collection(getDb(), 'campaign_delivery_events'),
  dripSequences: () => collection(getDb(), 'drip_sequences'),
  campaignEnrollments: () => collection(getDb(), 'campaign_enrollments'),
  trackerItems: () => collection(getDb(), 'tracker_items'),
  sprints: () => collection(getDb(), 'sprints'),
} as const

export type Collections = typeof collections
