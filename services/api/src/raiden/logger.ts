import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { RaidenRunDoc, FixRecord, RouteRecord } from './types.js'
import { RAIDEN_RUNS_COLLECTION } from './types.js'

const db = getFirestore()

function pad(n: number): string { return n.toString().padStart(2, '0') }

export async function logRaidenRun(data: {
  started_at: Date; items_checked: number
  triage_outcomes: { train: number; fix: number; route: number; queue: number }
  fixes_applied: FixRecord[]; routes_created: RouteRecord[]
  jdm_notified: boolean; channel_posted: boolean
}): Promise<string> {
  const now = new Date()
  const runId = `raiden_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  await db.collection(RAIDEN_RUNS_COLLECTION).doc(runId).set({
    run_id: runId, started_at: Timestamp.fromDate(data.started_at),
    completed_at: Timestamp.now(), items_checked: data.items_checked,
    triage_outcomes: data.triage_outcomes, fixes_applied: data.fixes_applied,
    routes_created: data.routes_created, jdm_notified: data.jdm_notified,
    channel_posted: data.channel_posted
  })
  console.log(`[RAIDEN] Run logged: ${runId}`)
  return runId
}

export async function getRunHistory(limit: number = 10): Promise<RaidenRunDoc[]> {
  const snap = await db.collection(RAIDEN_RUNS_COLLECTION)
    .orderBy('started_at', 'desc').limit(Math.min(Math.max(limit, 1), 100)).get()
  return snap.docs.map(d => d.data() as RaidenRunDoc)
}
