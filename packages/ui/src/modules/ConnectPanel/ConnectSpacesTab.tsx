'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'
import { useToast } from '../../components/Toast'
import type { ConnectChatSpace, ConnectChatMessage } from '@tomachina/core'

/* ─── Constants ────────────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 5000

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Format an ISO timestamp to a short readable time */
function formatChatTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

/** Deterministic avatar color from name string */
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
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

/* ─── Avatar ───────────────────────────────────────────────────────────────── */

function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const bg = nameToColor(name)
  const initials = getInitials(name)
  const fontSize = Math.round(size * 0.4)
  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize }}
    >
      {initials}
    </span>
  )
}

/* ─── SpaceRow ─────────────────────────────────────────────────────────────── */

interface SpaceRowProps {
  space: ConnectChatSpace
  isSelected: boolean
  hasUnread: boolean
  onSelect: (space: ConnectChatSpace) => void
}

function SpaceRow({ space, isSelected, hasUnread, onSelect }: SpaceRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(space)}
      className={[
        'm-row flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors',
        isSelected ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]',
      ].join(' ')}
    >
      {/* Space icon */}
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>tag</span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span
            className={[
              'truncate text-sm',
              hasUnread || isSelected
                ? 'font-semibold text-[var(--text-primary)]'
                : 'font-medium text-[var(--text-secondary)]',
            ].join(' ')}
          >
            {space.displayName || space.spaceId}
          </span>
          {hasUnread && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: 'var(--portal)' }}
              aria-label="Unread messages"
            />
          )}
        </div>
        {space.memberCount != null && (
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            {space.memberCount} {space.memberCount === 1 ? 'member' : 'members'}
          </p>
        )}
      </div>
    </button>
  )
}

/* ─── SpaceThreadPane ──────────────────────────────────────────────────────── */

interface SpaceThreadPaneProps {
  space: ConnectChatSpace
  onBack: () => void
}

function SpaceThreadPane({ space, onBack }: SpaceThreadPaneProps) {
  const [messages, setMessages] = useState<ConnectChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sendText, setSendText] = useState('')
  const [sending, setSending] = useState(false)
  const { showToast } = useToast()
  const msgEndRef = useRef<HTMLDivElement>(null)

  const spaceId = space.spaceId

  /* ── Initial message load ─────────────────────────────────────────────── */

  useEffect(() => {
    setLoading(true)
    setMessages([])
    let cancelled = false

    async function load() {
      try {
        const res = await fetchValidated<{ messages: ConnectChatMessage[] }>(
          `/api/connect/spaces/${spaceId}/messages?pageSize=50`,
        )
        if (!cancelled && res.success && res.data) {
          setMessages(res.data.messages ?? [])
        }
      } catch {
        /* silent — empty state shown */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [spaceId])

  /* ── 5-second polling (TKO-CONN-007 pattern) ─────────────────────────── */

  useEffect(() => {
    const timer = setInterval(() => {
      fetchValidated<{ messages: ConnectChatMessage[] }>(
        `/api/connect/spaces/${spaceId}/messages?pageSize=50`,
      )
        .then((res) => {
          if (res.success && res.data) {
            const incoming = res.data.messages ?? []
            setMessages((prev) =>
              incoming.length !== prev.length ? incoming : prev,
            )
          }
        })
        .catch(() => { /* silent poll failure */ })
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [spaceId])

  /* ── Auto-scroll on new messages ─────────────────────────────────────── */

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── Send ─────────────────────────────────────────────────────────────── */

  const handleSend = useCallback(async () => {
    const text = sendText.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await fetchValidated<ConnectChatMessage>(
        `/api/connect/spaces/${spaceId}/messages`,
        { method: 'POST', body: JSON.stringify({ text }) },
      )
      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data!])
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to spaces"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>tag</span>
        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {space.displayName || space.spaceId}
        </span>
        <span className="ml-auto flex flex-shrink-0 items-center gap-1 rounded bg-[var(--bg-surface)] px-2 py-0.5">
          <span className="text-[9px] text-[var(--text-muted)]">Powered by</span>
          <span className="text-[9px] font-semibold text-[#1a73e8]">Google Chat</span>
        </span>
      </div>

      {/* Message list */}
      <div className="flex flex-1 flex-col overflow-y-auto space-y-3 px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs text-[var(--text-muted)]">Loading messages…</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>chat_bubble_outline</span>
            <p className="mt-2 text-xs font-medium text-[var(--text-primary)]">No messages yet</p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Send the first message!</p>
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
                <span className="text-[10px] text-[var(--text-muted)]">
                  {formatChatTime(msg.createTime)}
                </span>
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
            onKeyDown={handleKeyDown}
            placeholder={`Message ${space.displayName || space.spaceId}`}
            disabled={sending}
            className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !sendText.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-white transition-colors hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>send</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── SpacesListPane ───────────────────────────────────────────────────────── */

interface SpacesListPaneProps {
  spaces: ConnectChatSpace[]
  loading: boolean
  error: string | null
  selectedSpaceId: string | null
  unreadIds: Set<string>
  search: string
  onSearchChange: (v: string) => void
  onSelect: (space: ConnectChatSpace) => void
}

function SpacesListPane({
  spaces,
  loading,
  error,
  selectedSpaceId,
  unreadIds,
  search,
  onSearchChange,
  onSelect,
}: SpacesListPaneProps) {
  const filtered = search
    ? spaces.filter((s) =>
        (s.displayName || s.spaceId).toLowerCase().includes(search.toLowerCase()),
      )
    : spaces

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="flex-shrink-0 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search spaces…"
            className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Space list body */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[var(--text-muted)]">Loading spaces…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>chat</span>
            <p className="mt-2 text-xs font-medium text-[var(--text-primary)]">Google Chat not connected</p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Sign out and sign back in to grant Chat access
            </p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>forum</span>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {search ? 'No spaces match your search' : 'No spaces found'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.map((space) => (
          <SpaceRow
            key={space.spaceId}
            space={space}
            isSelected={space.spaceId === selectedSpaceId}
            hasUnread={unreadIds.has(space.spaceId)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── ConnectSpacesTab ─────────────────────────────────────────────────────── */

/**
 * TKO-UX-002 — 2-pane Google Chat Spaces tab.
 *
 * Left pane: list of Spaces from GET /api/connect/spaces with search + unread badges.
 * Right pane (selected): thread polled every 5 s + compose footer.
 *
 * Unread detection: GET /api/connect/spaces/:id/read-state; when the most recent
 * message createTime is after lastReadTime the space is marked unread.
 *
 * V1 scope: no typing indicators, no read receipts, no edit/delete, no file
 * attachments, no threading. Deferred to V2 per Discovery Doc constraints.
 */
export function ConnectSpacesTab() {
  const [spaces, setSpaces] = useState<ConnectChatSpace[]>([])
  const [loadingSpaces, setLoadingSpaces] = useState(true)
  const [spacesError, setSpacesError] = useState<string | null>(null)
  const [selectedSpace, setSelectedSpace] = useState<ConnectChatSpace | null>(null)
  const [search, setSearch] = useState('')
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())

  /* ── Load spaces list ───────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadingSpaces(true)
      setSpacesError(null)
      try {
        const res = await fetchValidated<ConnectChatSpace[]>('/api/connect/spaces')
        if (cancelled) return
        if (res.success && res.data) {
          setSpaces(res.data)
        } else {
          setSpacesError(res.error ?? 'Failed to load spaces')
        }
      } catch {
        if (!cancelled) setSpacesError('Failed to load spaces')
      } finally {
        if (!cancelled) setLoadingSpaces(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  /* ── Check read-state for each space to surface unread badges ───────────── */

  useEffect(() => {
    if (spaces.length === 0) return
    let cancelled = false

    async function checkUnread() {
      const unread = new Set<string>()

      await Promise.allSettled(
        spaces.map(async (space) => {
          try {
            const rsRes = await fetchValidated<{ name: string; lastReadTime: string | null } | null>(
              `/api/connect/spaces/${space.spaceId}/read-state`,
            )
            if (!rsRes.success || !rsRes.data) return

            const lastReadTime = rsRes.data.lastReadTime

            const msgsRes = await fetchValidated<{ messages: ConnectChatMessage[] }>(
              `/api/connect/spaces/${space.spaceId}/messages?pageSize=1`,
            )
            if (!msgsRes.success || !msgsRes.data?.messages?.length) return

            const latestMsg = msgsRes.data.messages[0]
            if (latestMsg) {
              const msgTime = new Date(latestMsg.createTime).getTime()
              const readTime = lastReadTime ? new Date(lastReadTime).getTime() : 0
              if (msgTime > readTime) unread.add(space.spaceId)
            }
          } catch {
            /* Per-space failure should not block the rest */
          }
        }),
      )

      if (!cancelled) setUnreadIds(unread)
    }

    void checkUnread()
    return () => { cancelled = true }
  }, [spaces])

  /* ── Handlers ───────────────────────────────────────────────────────────── */

  const handleSelect = useCallback((space: ConnectChatSpace) => {
    setSelectedSpace(space)
    /* Clear unread badge on open */
    setUnreadIds((prev) => {
      const next = new Set(prev)
      next.delete(space.spaceId)
      return next
    })
  }, [])

  const handleBack = useCallback(() => {
    setSelectedSpace(null)
  }, [])

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {selectedSpace ? (
        <SpaceThreadPane space={selectedSpace} onBack={handleBack} />
      ) : (
        <SpacesListPane
          spaces={spaces}
          loading={loadingSpaces}
          error={spacesError}
          selectedSpaceId={null}
          unreadIds={unreadIds}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}
