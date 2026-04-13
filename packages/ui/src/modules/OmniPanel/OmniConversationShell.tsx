'use client'

/* ─── OmniConversationShell — TKO-UX-006 ───────────────────────────────────
 * Shared 2-pane (list + thread + compose) layout used by OmniTextTab and
 * OmniEmailTab. Reads from /api/communications, groups by handle, polls
 * every 5s while a thread is open. V1 — no edit/delete/threading/attach.
 * ────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

interface CommunicationRow {
  id: string
  channel: string
  direction: string
  subject?: string
  body?: string
  status?: string
  client_id?: string
  sent_at?: string
  created_at: string
  // Polymorphic identifier fields — present depending on channel
  to?: string
  from?: string
  phone?: string
  email?: string
  email_address?: string
  contact_name?: string
  [key: string]: unknown
}

interface Conversation {
  handle: string            // phone E.164 or email address — the grouping key
  contactName?: string
  rows: CommunicationRow[]
  lastTs: string
  unreadCount: number
}

export interface OmniConversationShellProps {
  channel: 'sms' | 'email'
  iconName: string             // material icon name for empty state
  emptyTitle: string
  emptyHint: string
  composePlaceholder: string
  composeSubjectVisible?: boolean   // email needs subject; sms doesn't
  sendEndpoint: string         // POST endpoint, e.g. /api/comms/send-sms
  buildSendBody: (handle: string, body: string, subject?: string) => Record<string, unknown>
  formatHandle: (h: string) => string  // pretty-print phone vs email
  /** Optional pre-selected handle (e.g. from active client context) */
  initialHandle?: string | null
}

const POLL_MS = 5000

function pickHandle(row: CommunicationRow): string | null {
  // SMS prefers phone fields; email prefers email fields. We try a stable order.
  const candidates = [
    row.phone,
    row.to,
    row.from,
    row.email,
    row.email_address,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return null
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function OmniConversationShell({
  channel,
  iconName,
  emptyTitle,
  emptyHint,
  composePlaceholder,
  composeSubjectVisible = false,
  sendEndpoint,
  buildSendBody,
  formatHandle,
  initialHandle = null,
}: OmniConversationShellProps) {
  const [rows, setRows] = useState<CommunicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeHandle, setActiveHandle] = useState<string | null>(initialHandle)
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [composeBody, setComposeBody] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [sending, setSending] = useState(false)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  const loadRows = useCallback(async () => {
    try {
      const resp = await fetch(`/api/communications?channel=${channel}&limit=100`)
      if (!resp.ok) {
        setError(`Load failed (${resp.status})`)
        return
      }
      const json = await resp.json()
      if (json.success === false) {
        setError(json.error || 'Load failed')
        return
      }
      const data: CommunicationRow[] = Array.isArray(json.data) ? json.data : []
      setRows(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [channel])

  // Initial load
  useEffect(() => {
    loadRows()
  }, [loadRows])

  // Poll every 5s when a thread is open
  useEffect(() => {
    if (!activeHandle) return
    const t = setInterval(loadRows, POLL_MS)
    return () => clearInterval(t)
  }, [activeHandle, loadRows])

  // Group rows into conversations
  const conversations: Conversation[] = useMemo(() => {
    const byHandle = new Map<string, Conversation>()
    for (const r of rows) {
      if (filter !== 'all' && r.direction !== filter) continue
      const h = pickHandle(r)
      if (!h) continue
      const existing = byHandle.get(h)
      const ts = r.sent_at || r.created_at
      const isUnread = r.direction === 'inbound' && r.status !== 'read'
      if (existing) {
        existing.rows.push(r)
        if (ts > existing.lastTs) existing.lastTs = ts
        if (isUnread) existing.unreadCount += 1
      } else {
        byHandle.set(h, {
          handle: h,
          contactName: typeof r.contact_name === 'string' ? r.contact_name : undefined,
          rows: [r],
          lastTs: ts,
          unreadCount: isUnread ? 1 : 0,
        })
      }
    }
    return Array.from(byHandle.values()).sort((a, b) => (a.lastTs > b.lastTs ? -1 : 1))
  }, [rows, filter])

  const activeConvo = activeHandle
    ? conversations.find((c) => c.handle === activeHandle) ?? null
    : null

  const sortedThreadRows = useMemo(() => {
    if (!activeConvo) return []
    return [...activeConvo.rows].sort((a, b) => {
      const at = a.sent_at || a.created_at
      const bt = b.sent_at || b.created_at
      return at < bt ? -1 : 1
    })
  }, [activeConvo])

  // Auto-scroll to bottom when thread updates
  useEffect(() => {
    if (threadEndRef.current) threadEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [sortedThreadRows.length])

  const handleSend = async () => {
    if (!activeHandle || !composeBody.trim()) return
    setSending(true)
    try {
      const body = buildSendBody(activeHandle, composeBody, composeSubject || undefined)
      const resp = await fetch(sendEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        setError((j as { error?: string }).error || `Send failed (${resp.status})`)
        return
      }
      setComposeBody('')
      setComposeSubject('')
      // Optimistic refresh
      loadRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  // ─── List view (no active thread) ───
  if (!activeHandle) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Filter chips */}
        <div className="flex gap-1.5 border-b border-[var(--border-subtle)] px-3 py-2">
          {(['all', 'inbound', 'outbound'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                filter === f
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-6 py-12 text-center text-xs text-[var(--text-muted)]">Loading…</div>
          )}
          {error && !loading && (
            <div className="px-6 py-8 text-center text-xs text-[var(--danger)]">{error}</div>
          )}
          {!loading && !error && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                <span
                  className="material-icons-outlined"
                  style={{ fontSize: '24px', color: 'var(--text-muted)' }}
                >
                  {iconName}
                </span>
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{emptyTitle}</p>
              <p className="max-w-[220px] text-xs text-[var(--text-muted)] leading-relaxed">
                {emptyHint}
              </p>
            </div>
          )}
          {!loading && !error && conversations.length > 0 && (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {conversations.map((c) => {
                const last = c.rows[c.rows.length - 1]
                const preview =
                  last?.body?.slice(0, 80) ||
                  last?.subject?.slice(0, 80) ||
                  '(no content)'
                return (
                  <li key={c.handle}>
                    <button
                      type="button"
                      onClick={() => setActiveHandle(c.handle)}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {c.contactName || formatHandle(c.handle)}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                            {formatTs(c.lastTs)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {preview}
                        </div>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // ─── Thread view ───
  return (
    <div className="flex flex-1 flex-col">
      {/* Header — back + handle */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <button
          type="button"
          onClick={() => setActiveHandle(null)}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--bg-hover)]"
          aria-label="Back to list"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {activeConvo?.contactName || formatHandle(activeHandle)}
          </div>
          {activeConvo?.contactName && (
            <div className="truncate text-[11px] text-[var(--text-muted)]">
              {formatHandle(activeHandle)}
            </div>
          )}
        </div>
      </div>

      {/* Thread body */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] px-3 py-3">
        {sortedThreadRows.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">No messages yet.</div>
        )}
        {sortedThreadRows.map((r) => {
          const isOutbound = r.direction === 'outbound'
          return (
            <div
              key={r.id}
              className={`mb-2 flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  isOutbound
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                {composeSubjectVisible && r.subject && (
                  <div className="mb-1 text-[11px] font-semibold opacity-80">{r.subject}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{r.body || '(empty)'}</div>
                <div
                  className={`mt-1 text-[10px] ${
                    isOutbound ? 'text-white/70' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {formatTs(r.sent_at || r.created_at)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={threadEndRef} />
      </div>

      {/* Compose footer */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
        {composeSubjectVisible && (
          <input
            type="text"
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            placeholder="Subject"
            className="mb-2 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        )}
        <div className="flex gap-2">
          <textarea
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !composeSubjectVisible) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={composePlaceholder}
            rows={composeSubjectVisible ? 3 : 1}
            className="flex-1 resize-none rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !composeBody.trim()}
            className="rounded bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
