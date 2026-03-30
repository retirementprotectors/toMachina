import { Timestamp } from 'firebase-admin/firestore'

export interface SlackItem {
  message_ts: string
  user: string
  text: string
  channel: string
  thread_ts?: string
}

export interface ForgeItem {
  trk_id: string
  title: string
  description: string
  type: string
  priority: string
}

export type TriageOutcome = 'TRAIN' | 'FIX' | 'ROUTE' | 'QUEUE'

export interface TriageResult {
  outcome: TriageOutcome
  reasoning: string
  p0: boolean
}

export interface FixRecord { issue: string; pr: number; branch: string }
export interface RouteRecord { issue: string; trk: string; reason: string }

export interface RaidenRunDoc {
  run_id: string
  started_at: Timestamp
  completed_at: Timestamp
  items_checked: number
  triage_outcomes: { train: number; fix: number; route: number; queue: number }
  fixes_applied: FixRecord[]
  routes_created: RouteRecord[]
  jdm_notified: boolean
  channel_posted: boolean
}

export interface DuplicateMatch {
  trk_id: string
  title: string
  status: string
  score: number
}

export const RAIDEN_RUNS_COLLECTION = 'mdj_raiden_runs'

// Channel notifier event type (used by channel-notifier.ts)
export interface DojoFixesEvent {
  type: string
  trk_id: string
  title: string
  reporter?: string
  status?: string
  posted_at: string
}
