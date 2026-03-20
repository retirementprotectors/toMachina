'use client'

import { useState, useMemo } from 'react'
import { useCollection, getDb } from '@tomachina/db'
import { collection, query, orderBy, limit } from 'firebase/firestore'

/* ─── Types ─── */

export interface CommEntry {
  id: string
  type: 'sms' | 'email' | 'voice'
  direction: 'inbound' | 'outbound'
  contactName: string
  contactDetail: string
  agentName: string
  preview: string
  subject?: string
  timestamp: Date
  book: string
  accountType: string
  status: 'delivered' | 'read' | 'failed' | 'missed' | 'answered' | 'voicemail'
}

/** Raw Firestore communication document */
interface CommDoc {
  _id: string
  comm_id?: string
  channel?: string
  direction?: string
  recipient?: string
  body?: string
  subject?: string
  status?: string
  sent_by?: string
  client_id?: string
  created_at?: string
  call_type?: string
  duration?: number
}

type ChannelFilter = 'all' | 'sms' | 'email' | 'voice'
type DirectionFilter = 'all' | 'inbound' | 'outbound'
type ScopeFilter = 'all' | 'mine' | 'assigned' | 'unassigned'

/* ─── Map Firestore docs to CommEntry ─── */

function mapChannelToType(channel: string | undefined): CommEntry['type'] {
  if (channel === 'sms') return 'sms'
  if (channel === 'email') return 'email'
  return 'voice'
}

function mapStatus(status: string | undefined): CommEntry['status'] {
  const valid: CommEntry['status'][] = ['delivered', 'read', 'failed', 'missed', 'answered', 'voicemail']
  if (status && valid.includes(status as CommEntry['status'])) return status as CommEntry['status']
  if (status === 'sent' || status === 'queued') return 'delivered'
  if (status === 'connected') return 'answered'
  if (status === 'no_answer') return 'missed'
  if (status === 'dry_run') return 'delivered'
  return 'delivered'
}

function docToEntry(doc: CommDoc): CommEntry {
  return {
    id: doc._id || doc.comm_id || '',
    type: mapChannelToType(doc.channel),
    direction: (doc.direction === 'inbound' ? 'inbound' : 'outbound'),
    contactName: doc.recipient || 'Unknown',
    contactDetail: doc.recipient || '',
    agentName: doc.sent_by || '',
    preview: doc.body || (doc.channel === 'voice' && doc.duration ? `Duration: ${Math.floor(doc.duration / 60)}:${String(doc.duration % 60).padStart(2, '0')}` : ''),
    subject: doc.subject,
    timestamp: doc.created_at ? new Date(doc.created_at) : new Date(),
    book: '',
    accountType: '',
    status: mapStatus(doc.status),
  }
}

/* ─── Helpers ─── */

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_ICONS: Record<string, string> = {
  sms: 'sms',
  email: 'email',
  voice: 'phone',
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  delivered: { icon: 'check', color: 'var(--success, #10b981)', label: 'Delivered' },
  read: { icon: 'done_all', color: 'var(--portal)', label: 'Read' },
  failed: { icon: 'close', color: 'var(--error, #ef4444)', label: 'Failed' },
  missed: { icon: 'phone_missed', color: '#f59e0b', label: 'Missed' },
  answered: { icon: 'call_received', color: 'var(--success, #10b981)', label: 'Answered' },
  voicemail: { icon: 'voicemail', color: '#f59e0b', label: 'Voicemail' },
}

/* ─── Component ─── */

export function CommsFeed() {
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /** TODO: Replace with real auth context user name */
  const CURRENT_USER = 'Josh Millang'

  // Live Firestore query — communications ordered by created_at desc, limit 50
  const commsQuery = useMemo(() => {
    try {
      const db = getDb()
      return query(collection(db, 'communications'), orderBy('created_at', 'desc'), limit(50))
    } catch {
      return null
    }
  }, [])

  const { data: rawDocs, loading: commsLoading } = useCollection<CommDoc>(commsQuery, 'comms-feed')

  // Map Firestore docs to CommEntry
  const allComms = useMemo(() => rawDocs.map(docToEntry), [rawDocs])

  const filteredComms = useMemo(() => {
    return allComms.filter((c) => {
      // Channel filter
      if (channelFilter !== 'all' && c.type !== channelFilter) return false
      // Direction filter
      if (directionFilter !== 'all' && c.direction !== directionFilter) return false
      // Scope filter (TRK-067)
      if (scopeFilter === 'mine' && c.agentName !== CURRENT_USER) return false
      if (scopeFilter === 'assigned' && c.agentName !== CURRENT_USER) return false
      if (scopeFilter === 'unassigned' && c.agentName !== '') return false
      // Search — includes subject field (TRK-070)
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.contactName.toLowerCase().includes(q) &&
          !c.agentName.toLowerCase().includes(q) &&
          !c.preview.toLowerCase().includes(q) &&
          !c.contactDetail.toLowerCase().includes(q) &&
          !(c.subject && c.subject.toLowerCase().includes(q))
        ) return false
      }
      return true
    })
  }, [search, channelFilter, directionFilter, scopeFilter, allComms, CURRENT_USER])

  const channelPills: Array<{ key: ChannelFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'sms', label: 'SMS' },
    { key: 'email', label: 'Email' },
    { key: 'voice', label: 'Voice' },
  ]

  const directionPills: Array<{ key: DirectionFilter; label: string; icon: string }> = [
    { key: 'all', label: 'All', icon: 'swap_vert' },
    { key: 'inbound', label: 'In', icon: 'call_received' },
    { key: 'outbound', label: 'Out', icon: 'call_made' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search communications..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>

      {/* Filters — TRK-412: rounded-md h-[36px] pills (rectangular with slight rounding) */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        <div className="flex items-center gap-1.5">
          {channelPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setChannelFilter(pill.key)}
              className={`rounded-md h-[36px] px-3 text-xs font-medium transition-colors ${
                channelFilter === pill.key
                  ? 'text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={channelFilter === pill.key ? { background: 'var(--portal)' } : undefined}
            >
              {pill.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
          {directionPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setDirectionFilter(pill.key)}
              className={`flex items-center gap-1 rounded-md h-[36px] px-2.5 text-xs font-medium transition-colors ${
                directionFilter === pill.key
                  ? 'text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={directionFilter === pill.key ? { background: 'var(--portal)' } : undefined}
            >
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>{pill.icon}</span>
              {pill.label}
            </button>
          ))}
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          className="rounded-md h-[36px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-secondary)] outline-none"
        >
          <option value="all">All Team</option>
          <option value="mine">My Communications</option>
          <option value="assigned">My Assigned Clients</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {commsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons-outlined animate-spin text-3xl text-[var(--text-muted)]">sync</span>
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading communications...</p>
          </div>
        ) : filteredComms.length > 0 ? (
          <div className="space-y-0">
            {filteredComms.map((entry) => {
              const isExpanded = expandedId === entry.id
              const statusCfg = STATUS_CONFIG[entry.status]
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex w-full items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface)]"
                  >
                    {/* Direction + Type icon */}
                    <div className="mt-0.5 flex flex-col items-center gap-0.5">
                      <span
                        className="material-icons-outlined"
                        style={{ fontSize: '14px', color: entry.direction === 'inbound' ? 'var(--success, #10b981)' : 'var(--portal)' }}
                      >
                        {entry.direction === 'inbound' ? 'south_west' : 'north_east'}
                      </span>
                      <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                        {TYPE_ICONS[entry.type]}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {entry.direction === 'outbound' ? `${entry.type === 'email' ? 'Email' : entry.type === 'sms' ? 'SMS' : 'Call'} to ` : ''}
                          {entry.direction === 'inbound' && entry.type === 'voice' ? 'Inbound Call from ' : ''}
                          {entry.direction === 'inbound' && entry.type !== 'voice' ? `${entry.type === 'email' ? 'Email' : 'SMS'} from ` : ''}
                          <span className="text-[var(--portal)]">{entry.contactName}</span>
                        </span>
                        <span className="ml-2 shrink-0 text-xs text-[var(--text-muted)]">
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {entry.direction === 'outbound'
                          ? `${entry.agentName} \u2192 ${entry.contactDetail}`
                          : `${entry.contactDetail} \u2192 ${entry.agentName}`}
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                        {entry.subject ? `Subject: "${entry.subject}"` : entry.type === 'voice' ? entry.preview : `"${entry.preview}"`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{entry.book}</span>
                        <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{entry.accountType}</span>
                        {statusCfg && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: statusCfg.color }}>
                            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>{statusCfg.icon}</span>
                            {statusCfg.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded view — TRK-063: standardized pill buttons */}
                  {isExpanded && (
                    <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                      <div className="rounded-lg bg-[var(--bg-card)] p-4">
                        {entry.type === 'voice' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>schedule</span>
                              {entry.preview}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person</span>
                              {entry.status === 'answered' ? `Handled by ${entry.agentName}` : entry.status === 'missed' ? 'Missed call' : 'Went to voicemail'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {entry.subject && <p className="text-sm font-medium text-[var(--text-primary)]">{entry.subject}</p>}
                            <p className="text-sm text-[var(--text-secondary)]">{entry.preview}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation() }}
                          className="flex items-center gap-1 rounded-md h-[34px] px-4 text-xs font-medium text-white transition-colors hover:brightness-110"
                          style={{ background: 'var(--portal)' }}
                        >
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                            {entry.type === 'voice' ? 'phone_callback' : 'reply'}
                          </span>
                          {entry.type === 'voice' ? 'Call Back' : 'Reply'}
                        </button>
                        <button className="flex items-center gap-1 rounded-md h-[34px] px-4 text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                          View Client
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">forum</span>
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No communications found</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{allComms.length === 0 ? 'No communications logged yet' : 'Try adjusting your filters'}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
        <span className="text-xs text-[var(--text-muted)]">{filteredComms.length} of {allComms.length} entries</span>
        <button className="flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]">
          Load More
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>expand_more</span>
        </button>
      </div>
    </div>
  )
}
