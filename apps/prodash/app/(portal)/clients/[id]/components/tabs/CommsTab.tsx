'use client'

import { useMemo } from 'react'
import { collection, where, orderBy, query, limit } from 'firebase/firestore'
import { useCollection, getDb } from '@tomachina/db'
import type { Communication } from '@tomachina/core'
import { formatDate, str } from '../../lib/formatters'
import { EmptyState } from '../../lib/ui-helpers'

interface CommsTabProps {
  clientId: string
}

export function CommsTab({ clientId }: CommsTabProps) {
  const commsQuery = useMemo(() => {
    if (!clientId) return null
    return query(
      collection(getDb(), 'communications'),
      where('client_id', '==', clientId),
      orderBy('created_at', 'desc'),
      limit(50)
    )
  }, [clientId])

  const { data: comms, loading } = useCollection<Communication>(commsQuery, `comms-${clientId}`)

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--bg-card)]" />
        ))}
      </div>
    )
  }

  if (comms.length === 0) {
    return <EmptyState icon="forum" message="No communication history yet." />
  }

  // Group by channel for summary
  const channelCounts: Record<string, number> = {}
  for (const comm of comms) {
    const ch = str(comm.channel) || 'Unknown'
    channelCounts[ch] = (channelCounts[ch] || 0) + 1
  }

  return (
    <div className="space-y-4">
      {/* Channel summary pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {comms.length} {comms.length === 1 ? 'Communication' : 'Communications'}
        </span>
        <span className="text-[var(--text-muted)]">&middot;</span>
        {Object.entries(channelCounts).map(([channel, count]) => (
          <span
            key={channel}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
          >
            <span className="material-icons-outlined text-[14px]">
              {getChannelIcon(channel)}
            </span>
            {channel}
            <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--bg-card)] px-1 text-[10px]">
              {count}
            </span>
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {comms.map((comm, index) => (
          <CommRow key={comm.comm_id || comm.communication_id || index} comm={comm} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommRow({ comm }: { comm: Communication }) {
  const channel = str(comm.channel) || 'Unknown'
  const direction = str(comm.direction)
  const isInbound = direction.toLowerCase() === 'inbound'
  const statusColor = getCommStatusColor(str(comm.status))

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-colors hover:border-[var(--portal)]/30">
      <div className="flex items-start gap-3">
        {/* Channel icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getChannelBgColor(channel)}`}>
          <span className={`material-icons-outlined text-[18px] ${getChannelIconColor(channel)}`}>
            {getChannelIcon(channel)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Subject line */}
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {str(comm.subject) || `${channel} ${direction || 'communication'}`}
              </p>
              {/* Meta line: channel + direction + status */}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <span className="material-icons-outlined text-[12px]">
                    {isInbound ? 'call_received' : 'call_made'}
                  </span>
                  {direction || 'Unknown'}
                </span>
                <span className="text-[var(--text-muted)]">&middot;</span>
                <span className="text-xs text-[var(--text-muted)]">{channel}</span>
                {str(comm.status) && (
                  <>
                    <span className="text-[var(--text-muted)]">&middot;</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                      {str(comm.status)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Timestamp */}
            <p className="shrink-0 text-xs text-[var(--text-muted)] whitespace-nowrap">
              {formatDate(comm.sent_at || comm.created_at)}
            </p>
          </div>

          {/* Body preview if available */}
          {str(comm.body) && (
            <p className="mt-2 text-xs text-[var(--text-muted)] line-clamp-2">
              {str(comm.body)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function getChannelIcon(channel: string): string {
  const c = channel.toLowerCase()
  if (c.includes('email') || c.includes('mail')) return 'email'
  if (c.includes('sms') || c.includes('text')) return 'sms'
  if (c.includes('call') || c.includes('phone')) return 'phone'
  if (c.includes('meeting') || c.includes('meet')) return 'videocam'
  if (c.includes('chat')) return 'chat'
  if (c.includes('letter') || c.includes('mail')) return 'mail'
  return 'forum'
}

function getChannelBgColor(channel: string): string {
  const c = channel.toLowerCase()
  if (c.includes('email')) return 'bg-blue-500/15'
  if (c.includes('sms') || c.includes('text')) return 'bg-emerald-500/15'
  if (c.includes('call') || c.includes('phone')) return 'bg-amber-500/15'
  if (c.includes('meeting')) return 'bg-purple-500/15'
  return 'bg-[var(--bg-surface)]'
}

function getChannelIconColor(channel: string): string {
  const c = channel.toLowerCase()
  if (c.includes('email')) return 'text-blue-400'
  if (c.includes('sms') || c.includes('text')) return 'text-emerald-400'
  if (c.includes('call') || c.includes('phone')) return 'text-amber-400'
  if (c.includes('meeting')) return 'text-purple-400'
  return 'text-[var(--text-muted)]'
}

function getCommStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'delivered' || s === 'sent' || s === 'completed') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'opened' || s === 'read') return 'bg-blue-500/15 text-blue-400'
  if (s === 'pending' || s === 'queued' || s === 'scheduled') return 'bg-amber-500/15 text-amber-400'
  if (s === 'failed' || s === 'bounced' || s === 'error') return 'bg-red-500/15 text-red-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
