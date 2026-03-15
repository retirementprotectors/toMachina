'use client'

import { useEffect, useState } from 'react'

/**
 * IncomingCallRing — TRK-082
 *
 * Fullscreen overlay for incoming calls with pulsing phone icon,
 * caller info, and Accept / Decline buttons.
 *
 * STUB: Concept UI only. Sprint 10 will wire Twilio WebRTC + browser Audio API
 * for real incoming call events and ringtone playback.
 *
 * Export only — not mounted anywhere yet.
 */

/* ─── Types ─── */

export interface IncomingCallData {
  callId: string
  callerName: string
  callerPhone: string
  /** Optional label like "RPI Client" or "Unknown" */
  callerLabel?: string
}

interface IncomingCallRingProps {
  call: IncomingCallData
  onAccept: (callId: string) => void
  onDecline: (callId: string) => void
}

/* ─── Component ─── */

export function IncomingCallRing({ call, onAccept, onDecline }: IncomingCallRingProps) {
  const [pulse, setPulse] = useState(true)

  /* Pulse animation toggle — Sprint 10 replaces with browser Audio API ringtone */
  useEffect(() => {
    const interval = setInterval(() => setPulse((v) => !v), 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div
        className="flex w-full max-w-sm flex-col items-center rounded-2xl p-8"
        style={{ background: 'var(--bg-card)' }}
      >
        {/* Pulsing phone icon */}
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full transition-transform"
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            transform: pulse ? 'scale(1.1)' : 'scale(0.95)',
            transition: 'transform 0.8s ease-in-out',
          }}
        >
          <span
            className="material-icons-outlined"
            style={{ fontSize: '48px', color: 'var(--success, #10b981)' }}
          >
            ring_volume
          </span>
        </div>

        {/* Caller info */}
        <p className="mt-6 text-lg font-semibold text-[var(--text-primary)]">{call.callerName}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{call.callerPhone}</p>
        {call.callerLabel && (
          <span className="mt-2 inline-block rounded-full bg-[var(--bg-surface)] px-3 py-0.5 text-xs text-[var(--text-secondary)]">
            {call.callerLabel}
          </span>
        )}

        <p className="mt-4 text-xs text-[var(--text-muted)]">Incoming Call...</p>

        {/* Accept / Decline buttons */}
        <div className="mt-8 flex items-center gap-6">
          <button
            onClick={() => onDecline(call.callId)}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
            style={{ background: 'var(--error, #ef4444)' }}
            title="Decline call"
          >
            <span className="material-icons-outlined" style={{ fontSize: '28px' }}>call_end</span>
          </button>
          <button
            onClick={() => onAccept(call.callId)}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
            style={{ background: 'var(--success, #10b981)' }}
            title="Accept call"
          >
            <span className="material-icons-outlined" style={{ fontSize: '28px' }}>call</span>
          </button>
        </div>
      </div>
    </div>
  )
}
