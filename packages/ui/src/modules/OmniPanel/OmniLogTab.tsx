'use client'

/* ─── OmniLogTab — TKO-UX-006 ─────────────────────────────────────────────
 * Unified activity log: voice + SMS + email rolled into one chronological
 * stream with filter chips. Reads from /api/communications.
 * ────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useMemo, useCallback } from 'react'

interface LogRow {
  id: string
  channel: string
  direction: string
  subject?: string
  body?: string
  status?: string
  client_id?: string
  contact_name?: string
  to?: string
  from?: string
  phone?: string
  email?: string
  email_address?: string
  duration?: number
  sent_at?: string
  created_at: string
  [key: string]: unknown
}

type ChannelFilter = 'all' | 'voice' | 'sms' | 'email'
type DirectionFilter = 'all' | 'inbound' | 'outbound'

const CHANNEL_ICONS: Record<string, string> = {
  voice: 'phone',
  sms: 'sms',
  email: 'email',
  call: 'phone',
}

function pickHandle(r: LogRow): string {
  return (
    (typeof r.phone === 'string' && r.phone) ||
    (typeof r.email === 'string' && r.email) ||
    (typeof r.email_address === 'string' && r.email_address) ||
    (typeof r.to === 'string' && r.to) ||
    (typeof r.from === 'string' && r.from) ||
    '—'
  )
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function summarize(r: LogRow): string {
  if (r.channel === 'voice' || r.channel === 'call') {
    if (typeof r.duration === 'number') {
      const m = Math.floor(r.duration / 60)
      const s = r.duration % 60
      return `${r.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · ${m}m ${s}s`
    }
    return r.direction === 'inbound' ? 'Missed call' : 'Outbound call'
  }
  if (r.subject) return r.subject
  return r.body?.slice(0, 100) || '(no content)'
}

export function OmniLogTab() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100', orderBy: 'created_at', orderDir: 'desc' })
      if (channelFilter !== 'all') params.set('channel', channelFilter)
      if (directionFilter !== 'all') params.set('direction', directionFilter)
      const resp = await fetch(`/api/communications?${params.toString()}`)
      if (!resp.ok) {
        setError(`Load failed (${resp.status})`)
        return
      }
      const json = await resp.json()
      if (json.success === false) {
        setError(json.error || 'Load failed')
        return
      }
      const data: LogRow[] = Array.isArray(json.data) ? json.data : []
      setRows(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [channelFilter, directionFilter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const at = a.sent_at || a.created_at
      const bt = b.sent_at || b.created_at
      return at < bt ? 1 : -1
    })
  }, [rows])

  return (
    <div className="flex flex-1 flex-col">
      {/* Filter chips */}
      <div className="flex flex-col gap-1.5 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'voice', 'sms', 'email'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannelFilter(c)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                channelFilter === c
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {c === 'all' ? 'All' : c === 'voice' ? 'Calls' : c === 'sms' ? 'SMS' : 'Email'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'inbound', 'outbound'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirectionFilter(d)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                directionFilter === d
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {d === 'all' ? 'All Directions' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-6 py-12 text-center text-xs text-[var(--text-muted)]">Loading…</div>
        )}
        {error && !loading && (
          <div className="px-6 py-8 text-center text-xs text-[var(--danger)]">{error}</div>
        )}
        {!loading && !error && sortedRows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)]">
              <span
                className="material-icons-outlined"
                style={{ fontSize: '24px', color: 'var(--text-muted)' }}
              >
                list_alt
              </span>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">No activity yet</p>
            <p className="max-w-[220px] text-xs text-[var(--text-muted)] leading-relaxed">
              Calls, texts, and emails will appear here as they happen.
            </p>
          </div>
        )}
        {!loading && !error && sortedRows.length > 0 && (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {sortedRows.map((r) => {
              const icon = CHANNEL_ICONS[r.channel] || 'circle'
              const handle = pickHandle(r)
              const isInbound = r.direction === 'inbound'
              return (
                <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isInbound ? 'bg-blue-500/10' : 'bg-emerald-500/10'
                    }`}
                  >
                    <span
                      className="material-icons-outlined"
                      style={{
                        fontSize: '18px',
                        color: isInbound ? 'var(--accent)' : 'var(--success, #10b981)',
                      }}
                    >
                      {icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {r.contact_name || handle}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                        {formatTs(r.sent_at || r.created_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {summarize(r)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
