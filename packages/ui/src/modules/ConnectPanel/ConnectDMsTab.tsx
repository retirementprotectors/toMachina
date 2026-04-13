'use client'

/* ─── ConnectDMsTab — TKO-UX-003 ────────────────────────────────────────────
 *
 * 2-pane DM UI:
 *   Left  — scrollable DM thread list (fetched from GET /api/connect/dms)
 *   Right — active thread view with message history + compose footer
 *
 * DM threads are Google Chat Spaces with spaceType === DIRECT_MESSAGE.
 * Messages + send re-use the same /api/connect/spaces/:id/messages endpoints
 * (DMs are spaces under the hood — TKO-CONN-004 shipped the /dms list route
 * and the write path already works via the shared spaces endpoint).
 *
 * V1 scope (JDM-locked): no typing indicators, no read receipts, no
 * edit/delete, no attachments, no threading.
 * ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'
import { useToast } from '../../components/Toast'

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface DMSpace {
  name: string
  spaceId: string
  displayName: string
  spaceType: string
  memberCount?: number
}

interface ChatMessage {
  name: string
  messageId: string
  text: string
  sender: {
    name: string
    displayName: string
    email?: string
  }
  createTime: string
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Deterministic avatar color from a name string */
const AVATAR_COLORS = [
  '#4a7ab5', '#a78bfa', '#40bc58', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
]

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const bg = nameToColor(name)
  const fontSize = Math.round(size * 0.4)
  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  )
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return iso
  }
}

/* ─── DMRow ───────────────────────────────────────────────────────────────── */

function DMRow({
  dm,
  active,
  onSelect,
}: {
  dm: DMSpace
  active: boolean
  onSelect: (dm: DMSpace) => void
}) {
  const label = dm.displayName || dm.spaceId

  return (
    <button
      className={[
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        active
          ? 'bg-[var(--portal-glow)] text-[var(--portal)]'
          : 'hover:bg-[var(--bg-hover)]',
      ].join(' ')}
      onClick={() => onSelect(dm)}
      aria-current={active ? 'true' : undefined}
    >
      <InitialsAvatar name={label} size={32} />
      <span
        className={[
          'min-w-0 flex-1 truncate text-sm font-medium',
          active ? 'text-[var(--portal)]' : 'text-[var(--text-primary)]',
        ].join(' ')}
      >
        {label}
      </span>
      <span className="material-icons-outlined flex-shrink-0 text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
        chevron_right
      </span>
    </button>
  )
}

/* ─── DMThreadView ────────────────────────────────────────────────────────── */

function DMThreadView({
  dm,
  onBack,
}: {
  dm: DMSpace
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sendText, setSendText] = useState('')
  const [sending, setSending] = useState(false)
  const { showToast } = useToast()
  const msgEndRef = useRef<HTMLDivElement>(null)

  const spaceId = dm.spaceId
  const label = dm.displayName || spaceId

  /* Load initial message history */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchValidated<{ messages: ChatMessage[] }>(
          `/api/connect/spaces/${spaceId}/messages?pageSize=50`
        )
        if (!cancelled && result.success && result.data) {
          setMessages(result.data.messages || [])
        }
      } catch {
        // silent — empty state shown
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [spaceId])

  /* 5-second polling for new messages while thread is open (mirrors Spaces pattern) */
  useEffect(() => {
    const poll = setInterval(() => {
      fetchValidated<{ messages: ChatMessage[] }>(
        `/api/connect/spaces/${spaceId}/messages?pageSize=50`
      ).then((result) => {
        if (result.success && result.data) {
          const incoming = result.data.messages || []
          setMessages((prev) => incoming.length !== prev.length ? incoming : prev)
        }
      }).catch(() => { /* silent poll failure */ })
    }, 5000)
    return () => clearInterval(poll)
  }, [spaceId])

  /* Auto-scroll to newest message */
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = sendText.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const result = await fetchValidated<ChatMessage>(
        `/api/connect/spaces/${spaceId}/messages`,
        { method: 'POST', body: JSON.stringify({ text }) }
      )
      if (result.success && result.data) {
        setMessages((prev) => [...prev, result.data!])
        setSendText('')
      } else {
        showToast('Failed to send message', 'error')
      }
    } catch {
      showToast('Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }, [sendText, sending, spaceId, showToast])

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label="Back to DMs list"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <InitialsAvatar name={label} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="ml-auto flex items-center gap-1 rounded bg-[var(--bg-surface)] px-2 py-0.5">
          <span className="text-[9px] text-[var(--text-muted)]">Powered by</span>
          <span className="text-[9px] font-semibold text-[#1a73e8]">Google Chat</span>
        </span>
      </div>

      {/* Message list */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs text-[var(--text-muted)]">Loading messages...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>chat_bubble_outline</span>
            <p className="mt-2 text-xs font-medium text-[var(--text-primary)]">No messages yet</p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Send the first message below</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.messageId || msg.name} className="flex items-start gap-2.5">
            <InitialsAvatar name={msg.sender.displayName || msg.sender.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {msg.sender.displayName || msg.sender.name}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">{formatTime(msg.createTime)}</span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{msg.text}</p>
            </div>
          </div>
        ))}

        <div ref={msgEndRef} />
      </div>

      {/* Compose footer */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sendText}
            onChange={(e) => setSendText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={`Message ${label}`}
            disabled={sending}
            aria-label={`Message ${label}`}
            className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !sendText.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-md text-white transition-colors hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>send</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── ConnectDMsTab ───────────────────────────────────────────────────────── */

/**
 * TKO-UX-003 — DMs tab for the CONNECT slide-out.
 *
 * Two states:
 *   1. List view  — scrollable list of DM threads fetched from GET /api/connect/dms
 *   2. Thread view — 2-pane chat when a DM is selected
 *
 * API calls:
 *   GET  /api/connect/dms                              — list DM spaces
 *   GET  /api/connect/spaces/:spaceId/messages         — load thread history
 *   POST /api/connect/spaces/:spaceId/messages         — send a message
 */
export function ConnectDMsTab() {
  const [dms, setDms] = useState<DMSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDM, setActiveDM] = useState<DMSpace | null>(null)
  const activeDMId = activeDM?.spaceId ?? null

  /* Fetch DM list on mount */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchValidated<DMSpace[]>('/api/connect/dms')
        if (cancelled) return
        if (result.success && result.data) {
          setDms(result.data)
        } else {
          setError(result.error || 'Failed to load DMs')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load DMs')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  /* ── Thread view ─────────────────────────────────────────────────────────── */
  if (activeDM) {
    return (
      <DMThreadView
        dm={activeDM}
        onBack={() => setActiveDM(null)}
      />
    )
  }

  /* ── List view ───────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col">
      {/* Loading */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-xs text-[var(--text-muted)]">Loading conversations...</span>
        </div>
      )}

      {/* Error — Google Chat not yet authorized */}
      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>chat</span>
          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Google Chat not connected</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Sign out and sign back in to grant Chat access</p>
        </div>
      )}

      {/* Empty — authorized but no DMs */}
      {!loading && !error && dms.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>mark_chat_unread</span>
          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">No direct messages</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Start a DM from People tab or open Google Chat
          </p>
          <button
            type="button"
            onClick={() => window.open('https://chat.google.com', '_blank')}
            className="mt-4 flex items-center gap-1.5 rounded-md px-3 h-[34px] text-xs font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
            Open Google Chat
          </button>
        </div>
      )}

      {/* DM list */}
      {!loading && !error && dms.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 pt-3">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Direct Messages
          </span>
          <div className="mt-1.5 space-y-0.5">
            {dms.map((dm) => (
              <DMRow
                key={dm.spaceId || dm.name}
                dm={dm}
                active={activeDMId !== null && activeDMId === dm.spaceId}
                onSelect={setActiveDM}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
