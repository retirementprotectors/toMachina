'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ============================================================================
// CallPanel — Slide-over panel for prospect calling + disposition
// ============================================================================

export interface CallDisposition {
  client_id: string
  outcome: 'booked' | 'callback' | 'no_answer' | 'not_interested'
  notes: string
  duration: number
}

interface CallPanelProps {
  prospect: {
    client_id: string
    first_name: string
    last_name: string
    phone: string
    county: string
    city: string
  } | null
  onClose: () => void
  onDispositioned: (disposition: CallDisposition) => void
}

type CallState = 'pre_call' | 'calling' | 'disposition'

const OUTCOME_OPTIONS: Array<{
  value: CallDisposition['outcome']
  label: string
  bg: string
  text: string
  ring: string
}> = [
  { value: 'booked',         label: 'Booked',         bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  { value: 'callback',       label: 'Callback',       bg: 'bg-sky-500/10',     text: 'text-sky-400',     ring: 'ring-sky-500/30' },
  { value: 'no_answer',      label: 'No Answer',      bg: 'bg-amber-500/10',   text: 'text-amber-400',   ring: 'ring-amber-500/30' },
  { value: 'not_interested', label: 'Not Interested', bg: 'bg-neutral-500/10', text: 'text-neutral-400', ring: 'ring-neutral-500/30' },
]

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CallPanel({ prospect, onClose, onDispositioned }: CallPanelProps) {
  const [callState, setCallState] = useState<CallState>('pre_call')
  const [elapsed, setElapsed] = useState(0)
  const [outcome, setOutcome] = useState<CallDisposition['outcome'] | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset state when prospect changes
  useEffect(() => {
    setCallState('pre_call')
    setElapsed(0)
    setOutcome(null)
    setNotes('')
    setSaving(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [prospect?.client_id])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCall = useCallback(async () => {
    if (!prospect) return
    setCallState('calling')
    setElapsed(0)

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    // Fire and forget — initiate the call via Twilio
    try {
      await fetchValidated('/api/comms/send-voice', {
        method: 'POST',
        body: JSON.stringify({
          to: prospect.phone,
          from: '+18886208587',
          twiml: `<Response><Dial>${prospect.phone}</Dial></Response>`,
          client_id: prospect.client_id,
        }),
      })
    } catch {
      // Call initiation failure is non-blocking — agent can still log disposition
    }
  }, [prospect])

  const endCall = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setCallState('disposition')
  }, [])

  const handleSave = useCallback(async () => {
    if (!prospect || !outcome) return
    setSaving(true)

    try {
      await fetchValidated('/api/comms/log-call', {
        method: 'POST',
        body: JSON.stringify({
          client_id: prospect.client_id,
          direction: 'outbound',
          outcome,
          notes,
          duration: elapsed,
        }),
      })
    } catch {
      // Log failure is non-blocking
    }

    // TRK-13539: Disposition → pipeline stage advancement + activity logging
    try {
      // Look up active flow_instance for this client
      const fiResult = await fetchValidated<Array<{ id: string; stage_status: string; pipeline_key: string }>>(
        `/api/flow/instances?entity_id=${prospect.client_id}&entity_type=CLIENT`
      )
      if (fiResult.success && fiResult.data) {
        const activeInstance = fiResult.data.find(
          (i) => i.stage_status === 'pending' || i.stage_status === 'in_progress'
        )
        if (activeInstance) {
          // Log flow activity for ALL outcomes
          try {
            await fetchValidated('/api/flow/activity', {
              method: 'POST',
              body: JSON.stringify({
                instance_id: activeInstance.id,
                action_type: 'call_disposition',
                description: `Call outcome: ${outcome}${notes ? ` — ${notes}` : ''}`,
                performed_by: 'prozone-callpanel',
                metadata: { outcome, duration: elapsed },
              }),
            })
          } catch {
            // Activity logging failure is non-blocking
          }

          // Stage advancement for booked / not_interested
          if (outcome === 'booked' || outcome === 'not_interested') {
            const targetStage = outcome === 'booked' ? 'booked' : 'closed'
            await fetchValidated(`/api/flow/instances/${activeInstance.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                action: 'move',
                target_stage: targetStage,
                performed_by: 'prozone-callpanel',
              }),
            })
          }
        }
      }
    } catch {
      // Pipeline operations are non-blocking
    }

    onDispositioned({
      client_id: prospect.client_id,
      outcome,
      notes,
      duration: elapsed,
    })

    setSaving(false)
  }, [prospect, outcome, notes, elapsed, onDispositioned])

  if (!prospect) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-96 z-50 flex flex-col bg-[var(--bg-card)] border-l border-[var(--border-subtle)] shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-surface)]">
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>
                call
              </span>
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {prospect.first_name} {prospect.last_name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {prospect.county}, {prospect.city}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-surface)]"
          >
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Pre-call state ── */}
          {callState === 'pre_call' && (
            <div className="flex flex-col items-center gap-6 pt-8">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '32px' }}>
                  call
                </span>
              </span>
              <div className="text-center">
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {prospect.first_name} {prospect.last_name}
                </p>
                <p className="mt-1 text-sm tabular-nums text-[var(--text-secondary)]">
                  {prospect.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={startCall}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>call</span>
                Start Call
              </button>
            </div>
          )}

          {/* ── Calling state ── */}
          {callState === 'calling' && (
            <div className="flex flex-col items-center gap-6 pt-8">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 animate-pulse">
                <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '32px' }}>
                  phone_in_talk
                </span>
              </span>
              <div className="text-center">
                <p className="text-sm text-[var(--text-muted)]">In Call</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                  {formatTimer(elapsed)}
                </p>
              </div>
              <button
                type="button"
                onClick={endCall}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>call_end</span>
                End Call
              </button>
            </div>
          )}

          {/* ── Disposition state ── */}
          {callState === 'disposition' && (
            <div className="flex flex-col gap-5">
              {/* Duration summary */}
              <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-4 py-3">
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>
                  timer
                </span>
                <span className="text-sm text-[var(--text-secondary)]">
                  Call duration: <span className="font-semibold tabular-nums text-[var(--text-primary)]">{formatTimer(elapsed)}</span>
                </span>
              </div>

              {/* Outcome buttons */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Outcome
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOutcome(opt.value)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-all ring-1 ${
                        outcome === opt.value
                          ? `${opt.bg} ${opt.text} ${opt.ring}`
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-transparent hover:ring-[var(--border-subtle)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Call notes..."
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--portal)] resize-none"
                />
              </div>

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!outcome || saving}
                className="mt-2 w-full rounded-xl bg-[var(--portal)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
