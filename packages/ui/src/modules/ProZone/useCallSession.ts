'use client'

import { useState, useCallback, useRef } from 'react'
import { fetchValidated } from '../fetchValidated'
import type { CallOutcome } from './CallPanel'

// ============================================================================
// useCallSession — Power dialer queue state machine
// TRK-PC-008: Manages prospect queue, auto-advance, session stats
// ============================================================================

export interface SessionProspect {
  client_id: string
  first_name: string
  last_name: string
  phone: string
  county: string
  city: string
}

export interface SessionStats {
  total: number
  completed: number
  booked: number
  callback: number
  no_answer: number
  left_voicemail: number
  follow_up_needed: number
  not_interested: number
  skipped: number
  total_duration: number
}

export type SessionStatus = 'idle' | 'active' | 'paused' | 'ended'

interface CallSessionResult {
  client_id: string
  outcome: CallOutcome
  notes: string
  duration: number
}

export interface CallSessionState {
  status: SessionStatus
  queue: SessionProspect[]
  currentIndex: number
  stats: SessionStats
  results: CallSessionResult[]
  sessionStartTime: number | null
}

const INITIAL_STATS: SessionStats = {
  total: 0,
  completed: 0,
  booked: 0,
  callback: 0,
  no_answer: 0,
  left_voicemail: 0,
  follow_up_needed: 0,
  not_interested: 0,
  skipped: 0,
  total_duration: 0,
}

export function useCallSession() {
  const [state, setState] = useState<CallSessionState>({
    status: 'idle',
    queue: [],
    currentIndex: 0,
    stats: { ...INITIAL_STATS },
    results: [],
    sessionStartTime: null,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  const currentProspect = state.status !== 'idle' && state.status !== 'ended'
    ? state.queue[state.currentIndex] ?? null
    : null

  const hasNext = state.currentIndex < state.queue.length - 1
  const remaining = Math.max(0, state.queue.length - state.currentIndex - 1)

  // ── Start a new session ──
  const startSession = useCallback((prospects: SessionProspect[]) => {
    if (prospects.length === 0) return
    setState({
      status: 'active',
      queue: prospects,
      currentIndex: 0,
      stats: { ...INITIAL_STATS, total: prospects.length },
      results: [],
      sessionStartTime: Date.now(),
    })
  }, [])

  // ── Log disposition and advance ──
  const logDisposition = useCallback((outcome: CallOutcome, notes: string, duration: number) => {
    setState((prev) => {
      const result: CallSessionResult = {
        client_id: prev.queue[prev.currentIndex]?.client_id ?? '',
        outcome,
        notes,
        duration,
      }

      const newStats = { ...prev.stats }
      newStats.completed += 1
      newStats.total_duration += duration
      newStats[outcome] += 1

      const newResults = [...prev.results, result]
      const nextIndex = prev.currentIndex + 1
      const isQueueDone = nextIndex >= prev.queue.length

      return {
        ...prev,
        stats: newStats,
        results: newResults,
        currentIndex: isQueueDone ? prev.currentIndex : nextIndex,
        status: isQueueDone ? 'ended' : prev.status === 'paused' ? 'paused' : 'active',
      }
    })
  }, [])

  // ── Skip current prospect ──
  const skipProspect = useCallback(() => {
    setState((prev) => {
      const newStats = { ...prev.stats, skipped: prev.stats.skipped + 1 }
      const nextIndex = prev.currentIndex + 1
      const isQueueDone = nextIndex >= prev.queue.length

      return {
        ...prev,
        stats: newStats,
        currentIndex: isQueueDone ? prev.currentIndex : nextIndex,
        status: isQueueDone ? 'ended' : prev.status,
      }
    })
  }, [])

  // ── Pause / Resume ──
  const pauseSession = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'paused' }))
  }, [])

  const resumeSession = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'active' }))
  }, [])

  // ── End session (manual) ──
  const endSession = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'ended' }))
  }, [])

  // ── Reset (after viewing summary) ──
  const resetSession = useCallback(() => {
    setState({
      status: 'idle',
      queue: [],
      currentIndex: 0,
      stats: { ...INITIAL_STATS },
      results: [],
      sessionStartTime: null,
    })
  }, [])

  // ── Write batch log to Firestore on session end ──
  const writeBatchLog = useCallback(async () => {
    const s = stateRef.current
    if (s.results.length === 0) return

    try {
      await fetchValidated('/api/comms/log-session', {
        method: 'POST',
        body: JSON.stringify({
          results: s.results,
          stats: s.stats,
          started_at: s.sessionStartTime ? new Date(s.sessionStartTime).toISOString() : null,
          ended_at: new Date().toISOString(),
        }),
      })
    } catch {
      // Batch log failure is non-blocking — individual calls already logged
    }
  }, [])

  return {
    ...state,
    currentProspect,
    hasNext,
    remaining,
    startSession,
    logDisposition,
    skipProspect,
    pauseSession,
    resumeSession,
    endSession,
    resetSession,
    writeBatchLog,
  }
}
