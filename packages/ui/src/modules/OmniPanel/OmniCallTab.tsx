'use client'

import { useState, useEffect, useCallback } from 'react'
import { ActiveCallScreenV2 } from './ActiveCallScreenV2'
import { InboundCallCardV2 } from './InboundCallCardV2'
import { useIncomingCall } from '../CommsModule/useIncomingCall'
import type { ClientResult } from '../CommsModule/CommsCompose'

/* ─── Types ─── */

interface RecentCall {
  id: string
  contactName: string
  contactPhone: string
  clientId?: string
  direction: 'inbound' | 'outbound'
  duration?: number    // seconds; undefined = missed/no-answer
  createdAt: string    // ISO string
}

interface OmniCallTabProps {
  /** Active client from the contact detail page — pre-fills the dialer */
  activeContact?: ClientResult | null
}

/* ─── Helpers ─── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatCallTs(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/* ─── Dialer ─── */

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

interface DialerProps {
  value: string
  onChange: (v: string) => void
  onCall: () => void
  disabled?: boolean
}

function Dialer({ value, onChange, onCall, disabled }: DialerProps) {
  const handleKey = (k: string) => onChange(value + k)
  const handleBackspace = () => onChange(value.slice(0, -1))

  return (
    <div className="px-3 pb-3">
      {/* Display */}
      <div className="mb-3 rounded-lg bg-[var(--bg-surface)] p-3 text-center">
        <div className="font-mono text-xl font-bold text-[var(--text-primary)] tracking-wider min-h-[28px]">
          {value || <span className="text-[var(--text-muted)] text-base font-normal">Enter number</span>}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          Caller ID: RPI Toll-Free · +18886208587
        </div>
      </div>

      {/* Keypad */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {KEYPAD_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleKey(k)}
            className="flex h-10 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] active:scale-95"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Backspace + Call row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBackspace}
          disabled={!value}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30"
          title="Backspace"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>backspace</span>
        </button>
        <button
          type="button"
          onClick={onCall}
          disabled={disabled || !value}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full h-10 text-sm font-bold text-white transition-colors disabled:opacity-40"
          style={{ background: 'var(--success, #10b981)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>phone</span>
          Call
        </button>
      </div>
    </div>
  )
}

/* ─── OmniCallTab ─── */

export function OmniCallTab({ activeContact }: OmniCallTabProps) {
  const [dialNumber, setDialNumber] = useState(activeContact?.phone ?? '')
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [calling, setCalling] = useState(false)

  /* Active call state — mirrors CommsModule's approach */
  const [activeCall, setActiveCall] = useState<{
    callId: string
    callerName: string
    callerPhone: string
    callerLabel?: string
  } | null>(null)
  const [liveCallNotes, setLiveCallNotes] = useState('')
  const [isMuted, setIsMuted] = useState(false)

  const { incomingCall, answerCall, declineCall } = useIncomingCall()

  /* Sync dialer when activeContact changes */
  useEffect(() => {
    if (activeContact?.phone) setDialNumber(activeContact.phone)
  }, [activeContact?.phone])

  /* Load recent calls from Firestore via API */
  useEffect(() => {
    // E1 fix (TRK-EPIC-08): /api/comms/log does not exist — the log list route
    // is /api/communications (mounted at services/api/src/server.ts:206).
    fetch('/api/communications?channel=voice&limit=5')
      .then((r) => r.ok ? r.json() : { success: false, data: [] })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setRecentCalls(res.data as RecentCall[])
        }
      })
      .catch(() => {})
  }, [])

  /* ── Outbound call ── */
  const handleCall = useCallback(() => {
    if (!dialNumber) return
    setCalling(true)

    // E2 fix (TRK-EPIC-08): /api/comms/make-call does not exist — the outbound
    // voice route is /api/comms/send-voice (services/api/src/routes/comms.ts:335).
    fetch('/api/comms/send-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: dialNumber,
        client_id: activeContact?.id,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setActiveCall({
            // send-voice returns data.callSid (Twilio SID) — keep as callId prop
            // for compatibility with ActiveCallScreen; handleEndCall logs it as call_sid.
            callId: res.data?.callSid ?? res.data?.callId ?? dialNumber,
            callerName: activeContact?.name ?? dialNumber,
            callerPhone: dialNumber,
            callerLabel: activeContact?.book ? `Book: ${activeContact.book}` : undefined,
          })
        }
      })
      .catch(() => {})
      .finally(() => setCalling(false))
  }, [dialNumber, activeContact])

  /* ── Answer inbound ── */
  const handleAnswer = useCallback(() => {
    if (!incomingCall) return
    answerCall()
    setActiveCall({
      callId: incomingCall.id,
      callerName: incomingCall.callerName,
      callerPhone: incomingCall.callerPhone,
      callerLabel: incomingCall.book ? `Book: ${incomingCall.book}` : undefined,
    })
  }, [incomingCall, answerCall])

  /* ── End active call ── */
  const handleEndCall = useCallback((callId: string) => {
    const call = window.__activeTwilioCall as { disconnect?: () => void } | undefined
    if (call?.disconnect) call.disconnect()

    if (callId && liveCallNotes.trim()) {
      // E3 fix (TRK-EPIC-08): callId from setActiveCall is the Twilio Call SID
      // (CA...), not a Firestore client_id. Send it as call_sid + resolve the
      // real client_id from activeContact when available so the log entry lands
      // on the right contact's Activity tab.
      fetch('/api/comms/log-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_sid: callId,
          client_id: activeContact?.id ?? null,
          direction: 'inbound',
          outcome: 'connected',
          notes: liveCallNotes.trim(),
        }),
      }).catch(() => {})
    }

    setActiveCall(null)
    setLiveCallNotes('')
    setIsMuted(false)
    window.__activeTwilioCall = undefined
  }, [liveCallNotes, activeContact?.id])

  /* ── Toggle mute ── */
  const handleToggleMute = useCallback(() => {
    const call = window.__activeTwilioCall as { mute?: (m: boolean) => void; isMuted?: () => boolean } | undefined
    const next = !isMuted
    if (call?.mute) call.mute(next)
    setIsMuted(next)
  }, [isMuted])

  /* ── Send DTMF ── */
  const handleSendDigits = useCallback((digits: string) => {
    const call = window.__activeTwilioCall as { sendDigits?: (d: string) => void } | undefined
    if (call?.sendDigits) call.sendDigits(digits)
  }, [])

  /* Active call — full-screen overlay */
  if (activeCall) {
    return (
      <ActiveCallScreenV2
        call={activeCall}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onEndCall={handleEndCall}
        onSendDigits={handleSendDigits}
        onNotesChange={setLiveCallNotes}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Inbound ringing card — floats above everything */}
      {incomingCall && (
        <div className="fixed right-4 top-4 z-[60]">
          <InboundCallCardV2
            call={incomingCall}
            onAnswer={handleAnswer}
            onDecline={() => declineCall()}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Recent Calls */}
        {recentCalls.length > 0 && (
          <div className="px-3 pt-3 pb-2">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
              Recent Calls
            </p>
            <div className="flex flex-col gap-0">
              {recentCalls.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 border-b border-[var(--border-subtle)] py-2 last:border-0"
                >
                  {/* Icon */}
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--success, #10b981)' }}>phone</span>
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{c.contactName}</span>
                      <span className="shrink-0 text-[10px] font-semibold" style={{ color: c.direction === 'inbound' ? 'var(--success, #10b981)' : 'var(--text-muted)' }}>
                        {c.direction === 'inbound' ? '↙ In' : '↗ Out'}{c.duration ? ` · ${formatDuration(c.duration)}` : ' · Missed'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {formatCallTs(c.createdAt)} · {c.contactPhone}
                    </div>
                  </div>
                  {/* Redial */}
                  <button
                    type="button"
                    onClick={() => setDialNumber(c.contactPhone)}
                    className="shrink-0 text-[11px] font-semibold text-[var(--portal)] hover:underline"
                  >
                    Redial
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mx-3 border-t border-[var(--border-subtle)]" />

        {/* Dialer */}
        <div className="pt-2">
          <Dialer
            value={dialNumber}
            onChange={setDialNumber}
            onCall={handleCall}
            disabled={calling}
          />
        </div>
      </div>
    </div>
  )
}
