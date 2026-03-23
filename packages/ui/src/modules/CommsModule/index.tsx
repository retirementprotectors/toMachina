'use client'

import { useState, useEffect, useCallback } from 'react'
import { CommsFeed } from './CommsFeed'
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
  /** When set, opens directly on this tab instead of Log */
  initialTab?: 'sms' | 'email' | 'call' | null
}

type CommsTab = 'log' | 'text' | 'email' | 'call'

const TABS: Array<{ key: CommsTab; label: string; icon: string }> = [
  { key: 'log', label: 'Log', icon: 'list_alt' },
  { key: 'text', label: 'Text', icon: 'sms' },
  { key: 'email', label: 'Email', icon: 'email' },
  { key: 'call', label: 'Call', icon: 'phone' },
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
  const [activeTab, setActiveTab] = useState<CommsTab>('log')
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null)

  /* TRK-13667: Inbound call handling */
  const { incomingCall, answerCall, declineCall } = useIncomingCall()

  /* Jump to requested tab when opened via client detail buttons */
  useEffect(() => {
    if (open && initialTab) {
      // Map channel names to tab keys (sms → text)
      const tabMap: Record<string, CommsTab> = { sms: 'text', email: 'email', call: 'call' }
      setActiveTab(tabMap[initialTab] || 'log')
    }
  }, [open, initialTab])

  const handleClose = useCallback(() => {
    setActiveTab('log')
    onClose()
  }, [onClose])

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

  return (
    <>
      {/* Inbound call overlay — floats above the panel */}
      {inboundOverlay}

      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
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

          {/* Tab Bar */}
          <div className="flex items-center gap-0 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition-colors ${
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
          {activeTab === 'log' && <CommsFeed />}
          {activeTab === 'text' && <CommsCompose presetChannel="sms" presetContact={activeContact} onBack={() => setActiveTab('log')} />}
          {activeTab === 'email' && <CommsCompose presetChannel="email" presetContact={activeContact} onBack={() => setActiveTab('log')} />}
          {activeTab === 'call' && <CommsCompose presetChannel="call" presetContact={activeContact} onBack={() => setActiveTab('log')} />}
        </div>
      </div>
    </>
  )
}
