'use client'

import { useState, useEffect, useCallback } from 'react'
import { CommsFeed } from './CommsFeed'
import type { CommEntry } from './CommsFeed'
import { CommsCompose } from './CommsCompose'
import { InboundCallCard } from './InboundCallCard'
import { ActiveCallScreen } from './ActiveCallScreen'
import type { ActiveCallData } from './ActiveCallScreen'
import { useIncomingCall } from './useIncomingCall'
import type { ClientResult } from './CommsCompose'

/* ─── Types ─── */

export type { ClientResult }

interface CommsModuleProps {
  open: boolean
  onClose: () => void
  /** Active client from contact detail page — auto-fills To field */
  activeContact?: ClientResult | null
  /** When set, opens directly on this tab instead of Call */
  initialTab?: 'sms' | 'email' | 'call' | null
}

type CommsTab = 'log' | 'text' | 'email' | 'call'

/* CP01: Tab order — Call first (primary sales action), Log last (read-only history) */
const TABS: Array<{ key: CommsTab; label: string; icon: string }> = [
  { key: 'call', label: 'Call', icon: 'phone' },
  { key: 'text', label: 'Text', icon: 'sms' },
  { key: 'email', label: 'Email', icon: 'email' },
  { key: 'log', label: 'Log', icon: 'list_alt' },
]

/* ─── TRK-101: Responsive panel width classes ─── */

const PANEL_RESPONSIVE_CLASSES = [
  'fixed right-0 top-0 z-50 flex h-full flex-col bg-[var(--bg-card)] shadow-2xl',
  'w-screen',                    /* < 1024px: full-width overlay */
  'lg:w-[360px]',                /* 1024-1399px: compact */
  'min-[1400px]:w-[460px]',      /* >= 1400px: full width (original) */
].join(' ')

/* ─── Main Component ─── */

export function CommsModule({ open, onClose, activeContact, initialTab }: CommsModuleProps) {
  const [activeTab, setActiveTab] = useState<CommsTab>('call')
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null)

  /* CP06: Reply pre-fill state */
  const [replyContact, setReplyContact] = useState<ClientResult | null>(null)
  const [replySubject, setReplySubject] = useState<string | undefined>(undefined)

  /* TRK-13667: Inbound call handling */
  const { incomingCall, answerCall, declineCall } = useIncomingCall()

  /* Jump to requested tab when opened via client detail buttons */
  useEffect(() => {
    if (open && initialTab) {
      const tabMap: Record<string, CommsTab> = { sms: 'text', email: 'email', call: 'call' }
      setActiveTab(tabMap[initialTab] || 'call')
    }
  }, [open, initialTab])

  const handleClose = useCallback(() => {
    setActiveTab('call')
    setReplyContact(null)
    setReplySubject(undefined)
    onClose()
  }, [onClose])

  /* CP06: Reply — switch to correct compose tab with contact pre-filled */
  const handleReply = useCallback((entry: CommEntry) => {
    const tabMap: Record<string, CommsTab> = { sms: 'text', email: 'email', voice: 'call' }
    setActiveTab(tabMap[entry.type] || 'text')
    setReplyContact({
      id: entry.clientId || '',
      name: entry.contactName,
      phone: entry.type !== 'email' ? entry.contactDetail : '',
      email: entry.type === 'email' ? entry.contactDetail : '',
      book: entry.book,
    })
    if (entry.type === 'email' && entry.subject) {
      setReplySubject(`Re: ${entry.subject}`)
    } else {
      setReplySubject(undefined)
    }
  }, [])

  /* CP06: View Client — navigate to contact detail */
  const handleViewClient = useCallback((entry: CommEntry) => {
    if (entry.clientId) {
      window.location.href = `/contacts/${entry.clientId}`
    }
  }, [])

  const clearReply = useCallback(() => {
    setActiveTab('call')
    setReplyContact(null)
    setReplySubject(undefined)
  }, [])

  /* Answer: accept Twilio call → transition to ActiveCallScreen */
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

  /* Decline: reject + log to Firestore */
  const handleDecline = useCallback(() => {
    declineCall()
  }, [declineCall])

  /* End active call */
  const handleEndCall = useCallback(() => {
    const call = window.__activeTwilioCall as { disconnect?: () => void } | undefined
    if (call?.disconnect) call.disconnect()
    setActiveCall(null)
    window.__activeTwilioCall = undefined
  }, [])

  /* Active call overlay — rendered outside the panel so it covers the full screen */
  if (activeCall) {
    return (
      <ActiveCallScreen
        call={activeCall}
        onEndCall={handleEndCall}
        isMuted={false}
        onToggleMute={() => {
          const call = window.__activeTwilioCall as { mute?: (m: boolean) => void; isMuted?: () => boolean } | undefined
          if (call?.mute) call.mute(!call.isMuted?.())
        }}
        onSendDigits={(digits: string) => {
          const call = window.__activeTwilioCall as { sendDigits?: (d: string) => void } | undefined
          if (call?.sendDigits) call.sendDigits(digits)
        }}
      />
    )
  }

  /* Inbound ringing — always rendered (even when panel is closed) so agent sees the ring */
  const inboundOverlay = incomingCall ? (
    <div className="fixed right-4 top-4 z-[60]">
      <InboundCallCard
        call={incomingCall}
        onAnswer={handleAnswer}
        onDecline={handleDecline}
      />
    </div>
  ) : null

  if (!open) {
    return <>{inboundOverlay}</>
  }

  /* Determine which contact to pass to compose tabs */
  const composeContact = replyContact || activeContact || null

  return (
    <>
      {/* Inbound call overlay — floats above the panel */}
      {inboundOverlay}

      {/* CP03: Backdrop — mobile only (push-not-overlay removes backdrop on desktop) */}
      <div
        className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        onClick={handleClose}
      />

      {/* Panel — TRK-101: responsive widths */}
      <div className={PANEL_RESPONSIVE_CLASSES}>
        {/* Header */}
        <div className="border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>forum</span>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Communications</h2>
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Close panel"
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>

          {/* CP13: Tab Bar — left-aligned, 44px height, consistent indicator */}
          <div className="flex items-center gap-0 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 h-[44px] text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-[var(--portal)] text-[var(--portal)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'log' && <CommsFeed clientId={activeContact?.id} onReply={handleReply} onViewClient={handleViewClient} />}
          {activeTab === 'text' && <CommsCompose presetChannel="sms" presetContact={composeContact} onBack={clearReply} />}
          {activeTab === 'email' && <CommsCompose presetChannel="email" presetContact={composeContact} replySubject={replySubject} onBack={clearReply} />}
          {activeTab === 'call' && <CommsCompose presetChannel="call" presetContact={composeContact} onBack={clearReply} />}
        </div>
      </div>
    </>
  )
}
