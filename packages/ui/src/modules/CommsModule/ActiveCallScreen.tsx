'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * ActiveCallScreen — TRK-085
 *
 * In-call concept UI showing caller info, live duration timer,
 * Mute / Hold / Transfer / End Call buttons, and a notes textarea.
 *
 * STUB: Concept UI only. Sprint 10 will wire Twilio Client JS SDK
 * for real call control (mute, hold, transfer, hangup).
 *
 * Export only — not mounted anywhere yet.
 */

/* ─── Types ─── */

export interface ActiveCallData {
  callId: string
  callerName: string
  callerPhone: string
  callerLabel?: string
}

interface ActiveCallScreenProps {
  call: ActiveCallData
  onEndCall: (callId: string) => void
}

/* ─── Duration Timer Hook ─── */

function useCallTimer() {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return formatted
}

/* ─── Component ─── */

export function ActiveCallScreen({ call, onEndCall }: ActiveCallScreenProps) {
  const duration = useCallTimer()
  const [muted, setMuted] = useState(false)
  const [held, setHeld] = useState(false)
  const [notes, setNotes] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)

  const handleEndCall = useCallback(() => {
    onEndCall(call.callId)
  }, [call.callId, onEndCall])

  /* Sprint 10: Real Twilio mute/hold/transfer via Client JS SDK */

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div
        className="flex w-full max-w-md flex-col rounded-2xl p-6"
        style={{ background: 'var(--bg-card)' }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: held ? 'var(--warning, #f59e0b)' : 'var(--success, #10b981)' }} />
            <span className="text-xs font-medium" style={{ color: held ? 'var(--warning, #f59e0b)' : 'var(--success, #10b981)' }}>
              {held ? 'On Hold' : 'Connected'}
            </span>
          </div>
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{duration}</span>
        </div>

        {/* Caller info */}
        <div className="mt-5 flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(16, 185, 129, 0.15)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--success, #10b981)' }}>phone_in_talk</span>
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">{call.callerName}</p>
            <p className="text-sm text-[var(--text-muted)]">{call.callerPhone}</p>
            {call.callerLabel && (
              <span className="mt-0.5 inline-block text-xs text-[var(--text-secondary)]">{call.callerLabel}</span>
            )}
          </div>
        </div>

        {/* Control buttons */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setMuted((v) => !v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
              muted
                ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: muted ? 'var(--portal)' : 'var(--text-secondary)' }}>
              {muted ? 'mic_off' : 'mic'}
            </span>
          </button>

          <button
            onClick={() => setHeld((v) => !v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
              held
                ? 'border-[var(--warning,#f59e0b)] bg-amber-500/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
            }`}
            title={held ? 'Resume' : 'Hold'}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: held ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)' }}>
              {held ? 'play_arrow' : 'pause'}
            </span>
          </button>

          <button
            onClick={() => setShowTransfer((v) => !v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
              showTransfer
                ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
            }`}
            title="Transfer call"
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: showTransfer ? 'var(--portal)' : 'var(--text-secondary)' }}>
              phone_forwarded
            </span>
          </button>

          <button
            onClick={handleEndCall}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
            style={{ background: 'var(--error, #ef4444)' }}
            title="End call"
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>call_end</span>
          </button>
        </div>

        {/* Transfer panel (stub) */}
        {showTransfer && (
          <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Transfer to:</p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Agent selection coming in Sprint 10 with Twilio warm/cold transfer support.
            </p>
          </div>
        )}

        {/* In-call notes */}
        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Call Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Type notes during the call..."
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>
    </div>
  )
}
