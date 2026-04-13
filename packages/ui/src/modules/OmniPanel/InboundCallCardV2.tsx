'use client'

import { useState, useEffect } from 'react'
import type { InboundCall } from '../CommsModule/InboundCallCard'

/* Re-export so callers can share the type */
export type { InboundCall }

interface InboundCallCardV2Props {
  call: InboundCall | null
  onAnswer?: () => void
  onDecline?: () => void
  onRoute?: () => void
}

/* ─── Pulse animation ─── */

function RingPulse() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="absolute h-10 w-10 animate-[ring-pulse_1.5s_ease-out_infinite] rounded-full border-2" style={{ borderColor: '#10b981' }} />
      <span className="absolute h-10 w-10 animate-[ring-pulse_1.5s_ease-out_0.3s_infinite] rounded-full border-2" style={{ borderColor: '#10b981' }} />
      <span className="absolute h-10 w-10 animate-[ring-pulse_1.5s_ease-out_0.6s_infinite] rounded-full border-2" style={{ borderColor: '#10b981' }} />
      <style>{`
        @keyframes ring-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/* ─── Component ─── */

export function InboundCallCardV2({ call, onAnswer, onDecline, onRoute }: InboundCallCardV2Props) {
  const [showCard, setShowCard] = useState(true)

  const callId = call?.id ?? null
  useEffect(() => {
    if (!callId) return
    setShowCard(true)
  }, [callId])

  if (!call) return null

  return (
    <div className="relative">
      {/* Compact indicator button — always visible when ringing */}
      <button
        type="button"
        onClick={() => setShowCard((v) => !v)}
        className="relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors"
        style={{ background: 'rgba(16,185,129,0.12)' }}
      >
        <div className="relative h-[18px] w-[18px]">
          <RingPulse />
          <span
            className="material-icons-outlined relative z-10"
            style={{ fontSize: '18px', color: '#10b981' }}
          >
            phone_in_talk
          </span>
        </div>
        <span className="hidden text-xs font-semibold lg:inline" style={{ color: '#10b981' }}>
          {call.callerName} · {call.callerPhone}
        </span>
        <span className="text-xs font-semibold lg:hidden" style={{ color: '#10b981' }}>
          Incoming
        </span>
      </button>

      {/* Expanded card */}
      {showCard && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[280px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden">
          {/* Card header — green accent band */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
            <div
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(16,185,129,0.15)' }}
            >
              <RingPulse />
              <span className="material-icons-outlined relative z-10" style={{ fontSize: '20px', color: '#10b981' }}>
                phone_in_talk
              </span>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#10b981' }}>
                Incoming Call
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">Ringing…</p>
            </div>
          </div>

          {/* Caller details */}
          <div className="px-4 py-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">{call.callerName}</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '13px' }}>phone</span>
              {call.callerPhone}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
              {call.book && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '13px' }}>book</span>
                  {call.book}
                </span>
              )}
              {call.assignedAgent && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '13px' }}>person</span>
                  {call.assignedAgent}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
            <button
              type="button"
              onClick={() => { onAnswer?.(); setShowCard(false) }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl h-10 text-sm font-bold text-white transition-colors hover:brightness-110"
              style={{ background: '#10b981' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call</span>
              Answer
            </button>
            <button
              type="button"
              onClick={() => { onDecline?.(); setShowCard(false) }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl h-10 text-sm font-bold text-white transition-colors hover:brightness-110"
              style={{ background: '#ef4444' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call_end</span>
              Decline
            </button>
            {onRoute && (
              <button
                type="button"
                onClick={() => { onRoute(); setShowCard(false) }}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                title="Route to another agent"
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>forward</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
