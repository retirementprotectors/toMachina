// src/shinobi/shinobi-state.ts — Firestore read/write for mdj_shinobi_state/current singleton
// Foundation: TRK-13778. Used by TRK-13786 (GET /shinobi/status).

import { getFirestore } from 'firebase-admin/firestore'

const COLLECTION = 'mdj_shinobi_state'
const DOC_ID = 'current'

export interface ShinobiState {
  state: 'idle' | 'checking' | 'processing' | 'escalating'
  active_task: string | null
  last_check: string | null
  ronin_sprint: { name: string; phase: string; status: string } | null
  context: Record<string, unknown>
  updated_at: string
}

const DEFAULT_STATE: ShinobiState = {
  state: 'idle',
  active_task: null,
  last_check: null,
  ronin_sprint: null,
  context: {},
  updated_at: new Date().toISOString(),
}

export async function getShinobiState(): Promise<ShinobiState> {
  const db = getFirestore()
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get()
  if (!doc.exists) return { ...DEFAULT_STATE }
  return doc.data() as ShinobiState
}

export async function updateShinobiState(updates: Partial<ShinobiState>): Promise<void> {
  const db = getFirestore()
  await db.collection(COLLECTION).doc(DOC_ID).set(
    { ...updates, updated_at: new Date().toISOString() },
    { merge: true },
  )
}

/** Convenience wrapper: set state + optional active_task in one call. */
export async function transitionState(
  state: ShinobiState['state'],
  active_task?: string,
): Promise<void> {
  await updateShinobiState({ state, active_task: active_task ?? null })
}
