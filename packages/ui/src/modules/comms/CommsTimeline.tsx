'use client'

import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommRecord {
  comm_id: string
  channel: 'sms' | 'email' | 'voice'
  direction: 'inbound' | 'outbound'
  recipient?: string | null
  body?: string | null
  subject?: string | null
  status: string
  sent_by?: string | null
  created_at: string
  duration?: number | null
  call_type?: string | null
}

interface CommsTimelineProps {
  comms: CommRecord[]
  loading?: boolean
  filter?: 'all' | 'sms' | 'email' | 'voice'
  onFilterChange?: (filter: 'all' | 'sms' | 'email' | 'voice') => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (itemDate.getTime() === today.getTime()) return 'Today'
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

function getStatusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'sent' || s === 'delivered' || s === 'connected' || s === 'completed') return 'text-emerald-400'
  if (s === 'dry_run') return 'text-amber-400'
  if (s === 'failed' || s === 'error' || s === 'bounced') return 'text-red-400'
  return 'text-[var(--text-muted)]'
}

function getChannelLabel(channel: string): string {
  switch (channel) {
    case 'sms': return 'SMS'
    case 'email': return 'Email'
    case 'voice': return 'Call'
    default: return channel
  }
}

function getChannelBg(channel: string): string {
  switch (channel) {
    case 'sms': return 'bg-emerald-500/15 text-emerald-400'
    case 'email': return 'bg-blue-500/15 text-blue-400'
    case 'voice': return 'bg-amber-500/15 text-amber-400'
    default: return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
  }
}

function getChannelIcon(channel: string): string {
  switch (channel) {
    case 'sms': return 'sms'
    case 'email': return 'email'
    case 'voice': return 'phone'
    default: return 'forum'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommsTimeline({ comms, loading, filter = 'all', onFilterChange }: CommsTimelineProps) {
  const counts = useMemo(() => {
    const result = { sms: 0, email: 0, voice: 0, total: 0 }
    for (const comm of comms) {
      const ch = comm.channel as keyof typeof result
      if (ch in result) result[ch]++
      result.total++
    }
    return result
  }, [comms])

  const filtered = useMemo(() => {
    if (filter === 'all') return comms
    return comms.filter((c) => c.channel === filter)
  }, [comms, filter])

  const grouped = useMemo(() => {
    const groups: { label: string; items: CommRecord[] }[] = []
    let currentLabel = ''
    for (const comm of filtered) {
      const label = getDateLabel(comm.created_at)
      if (label !== currentLabel) {
        currentLabel = label
        groups.push({ label, items: [comm] })
      } else {
        groups[groups.length - 1].items.push(comm)
      }
    }
    return groups
  }, [filtered])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[34px] w-20 rounded-md bg-[var(--bg-surface)]" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-[var(--bg-card)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill label={`All (${counts.total})`} active={filter === 'all'} onClick={() => onFilterChange?.('all')} />
        <FilterPill label={`SMS (${counts.sms})`} active={filter === 'sms'} onClick={() => onFilterChange?.('sms')} />
        <FilterPill label={`Email (${counts.email})`} active={filter === 'email'} onClick={() => onFilterChange?.('email')} />
        <FilterPill label={`Voice (${counts.voice})`} active={filter === 'voice'} onClick={() => onFilterChange?.('voice')} />
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">forum</span>
          <p className="mt-3 text-sm text-[var(--text-muted)]">No communications yet</p>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {group.label}
          </h4>
          {group.items.map((comm, index) => (
            <CommRow key={comm.comm_id || index} comm={comm} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md h-[34px] px-3 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--portal)] text-white'
          : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
    </button>
  )
}

function CommRow({ comm }: { comm: CommRecord }) {
  const isInbound = comm.direction === 'inbound'

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 transition-colors hover:border-[var(--portal)]/30">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getChannelBg(comm.channel)}`}>
          <span className="material-icons-outlined text-[16px]">{getChannelIcon(comm.channel)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getChannelBg(comm.channel)}`}>
                  {getChannelLabel(comm.channel)}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs text-[var(--text-muted)]">
                  <span className="material-icons-outlined text-[12px]">
                    {isInbound ? 'call_received' : 'call_made'}
                  </span>
                  {isInbound ? 'Received' : 'Sent'}
                </span>
                <span className={`text-[10px] font-medium ${getStatusClass(comm.status)}`}>
                  {comm.status}
                </span>
              </div>
              {(comm.subject || comm.body) && (
                <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-1">
                  {truncate(comm.subject || comm.body || '', 100)}
                </p>
              )}
              {comm.channel === 'voice' && comm.duration != null && (
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Duration: {comm.duration} min</p>
              )}
            </div>
            <p className="shrink-0 text-[10px] text-[var(--text-muted)] whitespace-nowrap">{formatTime(comm.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
