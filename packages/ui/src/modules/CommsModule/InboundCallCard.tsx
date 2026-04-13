'use client'

import { useState, useEffect } from 'react'

/* ─── Types ─── */

export interface InboundCall {
  id: string
  callerName: string
  callerPhone: string
  book: string
  assignedAgent: string
  startedAt: Date
}

interface InboundCallCardProps {
  call: InboundCall | null
  onAnswer?: () => void
  onDecline?: () => void
  onRoute?: () => void
}

/* ─── CP05: Concentric Ring Animation ─── */

function RingPulse() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="absolute h-10 w-10 animate-[ring-pulse_1.5s_ease-out_infinite] rounded-full border-2 border-[var(--success,#10b981)]" />
      <span className="absolute h-10 w-10 animate-[ring-pulse_1.5s_ease-out_0.3s_infinite] rounded-full border-2 border-[var(--success,#10b981)]" />
      <span className="absolute h-10 w-10 animate-[ring-pulse_1.5s_ease-out_0.6s_infinite] rounded-full border-2 border-[var(--success,#10b981)]" />
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

export function InboundCallCard({ call, onAnswer, onDecline, onRoute }: InboundCallCardProps) {
  const [showCard, setShowCard] = useState(true)

  // TRK-13690: Track by call.id so a new call always forces the card open,
  // even if the object reference is stable (e.g. same Twilio Call object re-emitted).
  const callId = call?.id ?? null
  useEffect(() => {
    if (!callId) return
    setShowCard(true)
  }, [callId])

  if (!call) return null

  return (
    <div className="relative">
      <button
        onClick={() => setShowCard((v) => !v)}
        className="relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors"
        style={{ background: 'rgba(16,185,129,0.1)' }}
      >
        {/* CP05: Concentric ring animation behind icon */}
        <div className="relative h-[18px] w-[18px]">
          <RingPulse />
          <span
            className="material-icons-outlined relative z-10"
            style={{ fontSize: '18px', color: 'var(--success, #10b981)' }}
          >
            phone_in_talk
          </span>
        </div>
        <span className="hidden text-xs font-medium text-[var(--success, #10b981)] lg:inline">
          {call.callerName} &middot; {call.callerPhone}
        </span>
        <span className="text-xs font-medium text-[var(--success, #10b981)] lg:hidden">
          Incoming
        </span>
      </button>

      {showCard && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-xl">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <RingPulse />
              <span className="material-icons-outlined relative z-10" style={{ fontSize: '20px', color: 'var(--success, #10b981)' }}>phone_in_talk</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Incoming Call</p>
              <p className="text-xs text-[var(--text-muted)]">Ringing...</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-[var(--bg-surface)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-primary)]">{call.callerName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>phone</span>
              {call.callerPhone}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>book</span>
                Book: {call.book}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person</span>
                {call.assignedAgent}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => { onAnswer?.(); setShowCard(false) }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg h-[40px] text-sm font-semibold text-white transition-colors hover:brightness-110"
              style={{ background: 'var(--success, #10b981)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call</span>
              Answer
            </button>
            <button
              onClick={() => { onDecline?.(); setShowCard(false) }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg h-[40px] text-sm font-semibold text-white transition-colors hover:brightness-110"
              style={{ background: 'var(--error, #ef4444)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>call_end</span>
              Decline
            </button>
            <button
              onClick={() => { onRoute?.(); setShowCard(false) }}
              className="flex h-[40px] w-[40px] items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Route to another agent"
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
