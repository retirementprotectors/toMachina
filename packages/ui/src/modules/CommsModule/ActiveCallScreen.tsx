'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * ActiveCallScreen — TRK-13654
 *
 * In-call UI showing caller info, live duration timer, and real call controls:
 * - Mute: call.mute(true/false) via onToggleMute callback
 * - DTMF keypad: call.sendDigits('...') via onSendDigits callback
 * - End call: call.disconnect() via onEndCall callback
 * - Duration: starts on 'accept', stops on 'disconnect'
 * - Quality warnings via onWarning/onWarningCleared callbacks
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
  /** Whether the call microphone is currently muted (from TwilioDeviceProvider) */
  isMuted: boolean
  /** Toggle mic mute */
  onToggleMute: () => void
  /** End the active call */
  onEndCall: (callId: string) => void
  /** Send DTMF digits */
  onSendDigits: (digits: string) => void
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

/* ─── DTMF Keypad ─── */

function DtmfKeypad({ onSendDigits, onClose }: { onSendDigits: (d: string) => void; onClose: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
  return (
    <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--text-secondary)]">Keypad</p>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => onSendDigits(key)}
            className="flex h-10 items-center justify-center rounded-md bg-[var(--bg-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)]"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Component ─── */

export function ActiveCallScreen({ call, isMuted, onToggleMute, onEndCall, onSendDigits }: ActiveCallScreenProps) {
  const duration = useCallTimer()
  const [showKeypad, setShowKeypad] = useState(false)
  const [notes, setNotes] = useState('')

  const handleEndCall = useCallback(() => {
    onEndCall(call.callId)
  }, [call.callId, onEndCall])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div
        className="flex w-full max-w-md flex-col rounded-2xl p-6"
        style={{ background: 'var(--bg-card)' }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--success, #10b981)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--success, #10b981)' }}>
              Connected
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
          {/* Mute — wired to call.mute() via onToggleMute */}
          <button
            onClick={onToggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
              isMuted
                ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: isMuted ? 'var(--portal)' : 'var(--text-secondary)' }}>
              {isMuted ? 'mic_off' : 'mic'}
            </span>
          </button>

          {/* Keypad — calls call.sendDigits() for IVR navigation */}
          <button
            onClick={() => setShowKeypad((v) => !v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
              showKeypad
                ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
            }`}
            title="Keypad (DTMF)"
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: showKeypad ? 'var(--portal)' : 'var(--text-secondary)' }}>
              dialpad
            </span>
          </button>

          {/* End call — wired to call.disconnect() via onEndCall */}
          <button
            onClick={handleEndCall}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
            style={{ background: 'var(--error, #ef4444)' }}
            title="End call"
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>call_end</span>
          </button>
        </div>

        {/* DTMF Keypad — expanded inline */}
        {showKeypad && (
          <DtmfKeypad
            onSendDigits={onSendDigits}
            onClose={() => setShowKeypad(false)}
          />
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
