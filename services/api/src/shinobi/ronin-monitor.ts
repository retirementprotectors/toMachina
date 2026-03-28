// src/shinobi/ronin-monitor.ts — Live RONIN sprint status from Firestore
// Foundation: TRK-13780. Used by TRK-13781 (check), TRK-13786 (status).

import { getFirestore } from 'firebase-admin/firestore'

const FORGE_RUNS_COLLECTION = 'mdj_forge_runs'

export interface RoninStatus {
  run_id: string
  sprint_name: string
  phase: string
  status: 'running' | 'blocked' | 'failed' | 'complete'
  blockers: string[]
  started_at: string
  updated_at: string
}

/**
 * Query mdj_forge_runs for the 10 most recent runs.
 * Maps each document's phase field to a normalized status:
 *   - 'complete'    → complete
 *   - 'blocked'     → failed
 *   - 'awaiting_*'  → blocked
 *   - everything else → running
 */
export async function getActiveRuns(): Promise<RoninStatus[]> {
  const db = getFirestore()
  const snap = await db
    .collection(FORGE_RUNS_COLLECTION)
    .orderBy('started_at', 'desc')
    .limit(10)
    .get()

  return snap.docs.map((doc) => {
    const d = doc.data()
    const phase = d.phase ?? 'unknown'
    let status: RoninStatus['status'] = 'running'
    if (phase === 'complete') status = 'complete'
    else if (phase === 'blocked') status = 'failed'
    else if (phase.startsWith('awaiting_')) status = 'blocked'

    return {
      run_id: doc.id,
      sprint_name: d.sprint_name ?? d.name ?? 'unknown',
      phase,
      status,
      blockers: d.gatesPending ?? [],
      started_at: d.started_at ?? '',
      updated_at: d.updated_at ?? '',
    }
  })
}

/**
 * Get the single most recent forge run, or null if none exist.
 */
export async function getLatestRun(): Promise<RoninStatus | null> {
  const runs = await getActiveRuns()
  return runs[0] ?? null
}

/**
 * Get only runs that are currently running or blocked (awaiting gates).
 */
export async function getRunningRuns(): Promise<RoninStatus[]> {
  const runs = await getActiveRuns()
  return runs.filter((r) => r.status === 'running' || r.status === 'blocked')
}
