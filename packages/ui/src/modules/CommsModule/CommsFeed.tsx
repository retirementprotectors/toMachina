'use client'

import { useState, useMemo } from 'react'

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

type ChannelFilter = 'all' | 'sms' | 'email' | 'voice'
type DirectionFilter = 'all' | 'inbound' | 'outbound'
type ScopeFilter = 'all' | 'mine' | 'assigned' | 'unassigned'

/* ─── Mock Data ─── */

const now = new Date()
function ago(minutes: number): Date {
  return new Date(now.getTime() - minutes * 60 * 1000)
}

/** Mock current user — replace with real auth context in Sprint 10 */
const CURRENT_USER = 'Josh Millang'

const MOCK_COMMS: CommEntry[] = [
  { id: '1', type: 'sms', direction: 'outbound', contactName: 'John Smith', contactDetail: '(515) 555-1234', agentName: 'Vinnie Vazquez', preview: 'Hi John, just following up on your annuity renewal. Let me know if you have any questions about the new rates.', timestamp: ago(2), book: 'RPI', accountType: 'Medicare', status: 'delivered' },
  { id: '2', type: 'voice', direction: 'inbound', contactName: 'Jane Doe', contactDetail: '(515) 555-5678', agentName: 'Nikki Gray', preview: 'Duration: 4:32', timestamp: ago(15), book: 'Sprenger', accountType: 'Annuity', status: 'answered' },
  { id: '3', type: 'email', direction: 'outbound', contactName: 'Robert Johnson', contactDetail: 'robert.j@email.com', agentName: 'Josh Millang', preview: 'Your RMD Summary for 2026', subject: 'Your RMD Summary for 2026', timestamp: ago(60), book: 'RPI', accountType: 'Life', status: 'read' },
  { id: '4', type: 'sms', direction: 'inbound', contactName: 'Mary Williams', contactDetail: '(515) 555-9012', agentName: 'Angelique', preview: 'Thank you for the information about the Medicare Advantage plans. I think Plan G looks best for my situation.', timestamp: ago(120), book: 'McCormick', accountType: 'Medicare', status: 'read' },
  { id: '5', type: 'voice', direction: 'outbound', contactName: 'David Chen', contactDetail: '(515) 555-3456', agentName: 'Vinnie Vazquez', preview: 'Duration: 12:45', timestamp: ago(180), book: 'RPI', accountType: 'Advisory', status: 'answered' },
  { id: '6', type: 'email', direction: 'inbound', contactName: 'Patricia Martinez', contactDetail: 'patricia.m@yahoo.com', agentName: 'Nikki Gray', preview: 'I wanted to ask about changing my beneficiary designation on my life policy. Can you walk me through the process?', subject: 'Re: Beneficiary Change Request', timestamp: ago(210), book: 'Gradient', accountType: 'Life', status: 'read' },
  { id: '7', type: 'sms', direction: 'outbound', contactName: 'Thomas Brown', contactDetail: '(515) 555-7890', agentName: 'Matt McCormick', preview: 'Tom, your 1035 exchange paperwork is ready for review.', timestamp: ago(290), book: 'McCormick', accountType: 'Annuity', status: 'delivered' },
  { id: '8', type: 'voice', direction: 'inbound', contactName: 'Linda Wilson', contactDetail: '(515) 555-2345', agentName: 'Angelique', preview: 'Duration: 2:18', timestamp: ago(350), book: 'Sprenger', accountType: 'Medicare', status: 'voicemail' },
  { id: '9', type: 'email', direction: 'outbound', contactName: 'James Taylor', contactDetail: 'jtaylor@gmail.com', agentName: 'Josh Millang', preview: 'Here is your updated financial plan reflecting the new MYGA rates we discussed.', subject: 'Updated Financial Plan — MYGA Rates', timestamp: ago(420), book: 'RPI', accountType: 'Annuity', status: 'delivered' },
  { id: '10', type: 'sms', direction: 'inbound', contactName: 'Barbara Anderson', contactDetail: '(515) 555-6789', agentName: 'Vinnie Vazquez', preview: 'Can we move our meeting to Thursday at 2pm instead? I have a doctor appointment Wednesday.', timestamp: ago(500), book: 'RPI', accountType: 'Medicare', status: 'read' },
  { id: '11', type: 'voice', direction: 'outbound', contactName: 'Michael Garcia', contactDetail: '(515) 555-0123', agentName: 'Matt McCormick', preview: 'Duration: 8:15', timestamp: ago(600), book: 'Gradient', accountType: 'Advisory', status: 'answered' },
  { id: '12', type: 'email', direction: 'inbound', contactName: 'Susan Harris', contactDetail: 'sharris@outlook.com', agentName: 'Nikki Gray', preview: 'I received the beneficiary form but I\'m confused about Section 3.', subject: 'Re: Beneficiary Designation Form', timestamp: ago(720), book: 'Sprenger', accountType: 'Life', status: 'read' },
  { id: '13', type: 'sms', direction: 'outbound', contactName: 'Richard Clark', contactDetail: '(515) 555-4567', agentName: 'Angelique', preview: 'Hi Richard, your Medicare Part D renewal window opens next week.', timestamp: ago(840), book: 'McCormick', accountType: 'Medicare', status: 'read' },
  { id: '14', type: 'voice', direction: 'inbound', contactName: 'Dorothy Lewis', contactDetail: '(515) 555-8901', agentName: 'Vinnie Vazquez', preview: 'Duration: 0:45', timestamp: ago(960), book: 'RPI', accountType: 'Annuity', status: 'missed' },
  { id: '15', type: 'email', direction: 'outbound', contactName: 'William Robinson', contactDetail: 'w.robinson@aol.com', agentName: 'Josh Millang', preview: 'Attached is the comparison of the three FIA products we discussed.', subject: 'FIA Product Comparison — Athene vs. Nationwide vs. Global Atlantic', timestamp: ago(1100), book: 'Gradient', accountType: 'Annuity', status: 'delivered' },
  { id: '16', type: 'sms', direction: 'inbound', contactName: 'Margaret Walker', contactDetail: '(515) 555-2468', agentName: 'Nikki Gray', preview: 'Got it, thanks! I\'ll sign the DocuSign tonight.', timestamp: ago(1260), book: 'RPI', accountType: 'Life', status: 'read' },
  { id: '17', type: 'voice', direction: 'outbound', contactName: 'Charles Hall', contactDetail: '(515) 555-1357', agentName: 'Matt McCormick', preview: 'Duration: 22:10', timestamp: ago(1440), book: 'McCormick', accountType: 'Advisory', status: 'answered' },
  { id: '18', type: 'email', direction: 'inbound', contactName: 'Elizabeth Young', contactDetail: 'eyoung@icloud.com', agentName: 'Angelique', preview: 'My husband and I would like to set up a joint meeting to discuss our retirement income strategy.', subject: 'Meeting Request — Retirement Income Planning', timestamp: ago(1600), book: 'Sprenger', accountType: 'Advisory', status: 'read' },
  { id: '19', type: 'sms', direction: 'outbound', contactName: 'Joseph King', contactDetail: '(515) 555-9753', agentName: 'Vinnie Vazquez', preview: 'Joe, great news — your MAPD application was approved! Your new plan starts April 1st.', timestamp: ago(1800), book: 'RPI', accountType: 'Medicare', status: 'delivered' },
  { id: '20', type: 'voice', direction: 'inbound', contactName: 'Karen Wright', contactDetail: '(515) 555-8642', agentName: 'Nikki Gray', preview: 'Duration: 6:55', timestamp: ago(2000), book: 'Gradient', accountType: 'Life', status: 'answered' },
]

/* ─── Helpers ─── */

function formatRelativeTime(date: Date): string {
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

  const filteredComms = useMemo(() => {
    return MOCK_COMMS.filter((c) => {
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
  }, [search, channelFilter, directionFilter, scopeFilter])

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

      {/* Filters — TRK-068: rounded h-[34px] pills */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        <div className="flex items-center gap-1.5">
          {channelPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setChannelFilter(pill.key)}
              className={`rounded h-[34px] px-3 text-xs font-medium transition-colors ${
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
              className={`flex items-center gap-1 rounded h-[34px] px-2.5 text-xs font-medium transition-colors ${
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
          className="rounded h-[34px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-secondary)] outline-none"
        >
          <option value="all">All Team</option>
          <option value="mine">My Communications</option>
          <option value="assigned">My Assigned Clients</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {filteredComms.length > 0 ? (
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
            <p className="mt-1 text-xs text-[var(--text-muted)]">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
        <span className="text-xs text-[var(--text-muted)]">{filteredComms.length} of {MOCK_COMMS.length} entries</span>
        <button className="flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]">
          Load More
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>expand_more</span>
        </button>
      </div>
    </div>
  )
}
