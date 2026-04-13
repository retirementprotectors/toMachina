'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ActiveCallData } from '../CommsModule/ActiveCallScreen'

/* ─── Re-export so callers can use the same type ─── */
export type { ActiveCallData }

interface ActiveCallScreenV2Props {
  call: ActiveCallData
  isMuted: boolean
  onToggleMute: () => void
  onEndCall: (callId: string) => void
  onSendDigits: (digits: string) => void
  onNotesChange?: (notes: string) => void
}

/* ─── Duration timer ─── */

function useCallTimer() {
  const [seconds, setSeconds] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [])

  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/* ─── DTMF Keypad ─── */

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

function DtmfKeypad({ onSendDigits, onClose }: { onSendDigits: (d: string) => void; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/70">Keypad</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:text-white"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {DTMF_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onSendDigits(k)}
            className="flex h-10 items-center justify-center rounded-lg bg-white/15 text-sm font-semibold text-white transition-colors hover:bg-white/25 active:scale-95"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Component ─── */

export function ActiveCallScreenV2({
  call,
  isMuted,
  onToggleMute,
  onEndCall,
  onSendDigits,
  onNotesChange,
}: ActiveCallScreenV2Props) {
  const duration = useCallTimer()
  const [showKeypad, setShowKeypad] = useState(false)
  const [notes, setNotes] = useState('')

  const handleEnd = useCallback(() => onEndCall(call.callId), [call.callId, onEndCall])

  return (
    /* Full-screen dark overlay — same z-index as V1 */
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(10,34,64,0.92)' }}>
      <div className="flex w-full max-w-[340px] flex-col rounded-2xl overflow-hidden">

        {/* ── Top: caller info ── */}
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-5 text-center">
          {/* Avatar */}
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(16,185,129,0.2)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '32px', color: '#10b981' }}>phone_in_talk</span>
          </div>

          {/* Status + timer */}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#10b981' }} />
            <span className="text-xs font-semibold" style={{ color: '#10b981' }}>Connected</span>
            <span className="text-xs text-white/40">·</span>
            <span className="font-mono text-xs font-bold text-white/70">{duration}</span>
          </div>

          {/* Name + phone */}
          <div>
            <p className="text-lg font-bold text-white leading-tight">{call.callerName}</p>
            <p className="text-sm text-white/60 mt-0.5">{call.callerPhone}</p>
            {call.callerLabel && (
              <p className="mt-1 text-xs text-white/40">{call.callerLabel}</p>
            )}
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center justify-center gap-4 px-6 pb-5">
          {/* Mute */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full border transition-colors ${
              isMuted
                ? 'border-[var(--portal)] bg-[var(--portal-glow,rgba(74,122,181,0.2))]'
                : 'border-white/20 bg-white/10 hover:bg-white/20'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: isMuted ? 'var(--portal)' : 'rgba(255,255,255,0.8)' }}>
              {isMuted ? 'mic_off' : 'mic'}
            </span>
          </button>

          {/* End call — prominent center */}
          <button
            type="button"
            onClick={handleEnd}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#ef4444' }}
            title="End call"
          >
            <span className="material-icons-outlined" style={{ fontSize: '24px' }}>call_end</span>
          </button>

          {/* Keypad */}
          <button
            type="button"
            onClick={() => setShowKeypad((v) => !v)}
            className={`flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full border transition-colors ${
              showKeypad
                ? 'border-[var(--portal)] bg-[var(--portal-glow,rgba(74,122,181,0.2))]'
                : 'border-white/20 bg-white/10 hover:bg-white/20'
            }`}
            title="Keypad"
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: showKeypad ? 'var(--portal)' : 'rgba(255,255,255,0.8)' }}>dialpad</span>
          </button>
        </div>

        {/* ── DTMF keypad ── */}
        {showKeypad && (
          <div className="px-6 pb-4">
            <DtmfKeypad onSendDigits={onSendDigits} onClose={() => setShowKeypad(false)} />
          </div>
        )}

        {/* ── Notes ── */}
        <div className="border-t border-white/10 px-6 pb-6 pt-4">
          <label className="mb-1.5 block text-xs font-semibold text-white/60">Call Notes</label>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              onNotesChange?.(e.target.value)
            }}
            placeholder="Notes during the call..."
            rows={3}
            className="w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
          />
        </div>
      </div>
    </div>
  )
}
