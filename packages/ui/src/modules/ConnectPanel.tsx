'use client'

import { useState, useMemo } from 'react'

/* ─── Types ─── */

interface ConnectPanelProps {
  portal: string
  open: boolean
  onClose: () => void
}

type ConnectTab = 'channels' | 'people' | 'meet'

type PresenceStatus = 'online' | 'away' | 'offline'

interface TeamMember {
  name: string
  email: string
  role: string
  division: string
  presence: PresenceStatus
}

interface ChannelData {
  name: string
  pinned: boolean
  unreadCount: number
  lastSender: string
  lastMessage: string
  timestamp: string
}

interface MeetingData {
  title: string
  participants: string[]
  timeLabel: string
  joinable: boolean
}

interface RecordingData {
  title: string
  date: string
}

/* ─── Mock Data ─── */

const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Josh Millang', email: 'josh@retireprotected.com', role: 'CEO', division: 'Leadership', presence: 'online' },
  { name: 'John Behn', email: 'john@retireprotected.com', role: 'COO', division: 'Leadership', presence: 'online' },
  { name: 'Vinnie Vazquez', email: 'vince@retireprotected.com', role: 'Sales Division', division: 'Sales', presence: 'online' },
  { name: 'Nikki Gray', email: 'nikki@retireprotected.com', role: 'Service Division', division: 'Service', presence: 'online' },
  { name: 'Matt McCormick', email: 'matt@retireprotected.com', role: 'DAVID/B2B', division: 'DAVID', presence: 'away' },
  { name: 'Dr. Aprille Trupiano', email: 'aprille@retireprotected.com', role: 'Legacy Services', division: 'Legacy', presence: 'away' },
  { name: 'Shane Parmenter', email: 'shane@retireprotected.com', role: 'CFO', division: 'Finance', presence: 'offline' },
]

const CHANNELS: ChannelData[] = [
  { name: 'rpi-leadership', pinned: true, unreadCount: 3, lastSender: 'John B', lastMessage: 'Updated the pipeline metrics for Q1...', timestamp: '10m ago' },
  { name: 'sales-team', pinned: true, unreadCount: 1, lastSender: 'Vinnie', lastMessage: 'T65 list is ready for review...', timestamp: '25m ago' },
  { name: 'service-team', pinned: false, unreadCount: 0, lastSender: 'Nikki', lastMessage: 'Sprenger RMDs are done for March', timestamp: '2h ago' },
  { name: 'legacy-services', pinned: false, unreadCount: 0, lastSender: 'Aprille', lastMessage: 'Estate docs uploaded to DEX', timestamp: '1d ago' },
  { name: 'david-deals', pinned: false, unreadCount: 0, lastSender: 'Matt', lastMessage: 'Gradient onboarding Q2 timeline set...', timestamp: '2d ago' },
]

const UPCOMING_MEETINGS: MeetingData[] = [
  { title: 'Team Standup', participants: ['Josh', 'John', 'Vinnie', 'Nikki'], timeLabel: 'in 45 min', joinable: true },
  { title: 'Client Review: Smith Family', participants: ['Nikki', 'Josh'], timeLabel: '2:00 PM', joinable: true },
  { title: 'DAVID Pipeline Review', participants: ['Matt', 'Josh', 'John'], timeLabel: 'Tomorrow', joinable: false },
]

const RECENT_RECORDINGS: RecordingData[] = [
  { title: 'Weekly Leadership Sync', date: 'Mar 12, 2026' },
  { title: 'Service Team Huddle', date: 'Mar 11, 2026' },
  { title: 'Gradient Onboarding Call', date: 'Mar 10, 2026' },
]

/* ─── Presence Helpers ─── */

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-gray-600',
}

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
}

function avatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=72`
}

/* ═══════════════════════════════════════════════
   Tab 1: Channels
   ═══════════════════════════════════════════════ */

function ChannelRow({ channel }: { channel: ChannelData }) {
  const hasUnread = channel.unreadCount > 0
  return (
    <button
      className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
      onClick={() => window.open('https://chat.google.com', '_blank')}
    >
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>tag</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`text-sm ${hasUnread ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
            {channel.name}
          </span>
          <div className="flex items-center gap-1.5">
            {hasUnread ? (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--portal)' }} />
                <span className="text-[10px] font-bold" style={{ color: 'var(--portal)' }}>
                  {channel.unreadCount} new
                </span>
              </span>
            ) : (
              <span className="text-[10px] text-[var(--text-muted)]">{channel.timestamp}</span>
            )}
          </div>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
          <span className="text-[var(--text-secondary)]">{channel.lastSender}</span>
          {' \u2014 \u201C'}{channel.lastMessage}{'\u201D'}
        </p>
      </div>
    </button>
  )
}

function ChannelsTab() {
  const [search, setSearch] = useState('')

  const filterFn = (c: ChannelData) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())

  const filteredPinned = CHANNELS.filter((c) => c.pinned).filter(filterFn)
  const filteredAll = CHANNELS.filter((c) => !c.pinned).filter(filterFn)

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-3">
        <div className="relative">
          <span className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '16px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {filteredPinned.length > 0 && (
          <div className="mb-3">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Pinned</span>
            <div className="mt-1.5 space-y-0.5">
              {filteredPinned.map((ch) => <ChannelRow key={ch.name} channel={ch} />)}
            </div>
          </div>
        )}

        {filteredAll.length > 0 && (
          <div className="mb-3">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">All Channels</span>
            <div className="mt-1.5 space-y-0.5">
              {filteredAll.map((ch) => <ChannelRow key={ch.name} channel={ch} />)}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
          New Channel
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Tab 2: People (Team Directory with Presence)
   ═══════════════════════════════════════════════ */

function PersonCard({ member }: { member: TeamMember }) {
  return (
    <div className="group rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 transition-colors hover:bg-[var(--bg-hover)]">
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl(member.name)} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-card)] ${PRESENCE_DOT[member.presence]}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{member.name}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{member.role}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{member.email}</p>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => window.open('https://chat.google.com/dm/', '_blank')}
          className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] h-[28px] px-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>chat</span>
          Chat
        </button>
        <button
          onClick={() => window.open('https://meet.google.com/new', '_blank')}
          className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] h-[28px] px-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>videocam</span>
          Meet
        </button>
        {member.presence !== 'offline' && (
          <button className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] h-[28px] px-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]">
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>phone</span>
            Call
          </button>
        )}
      </div>
    </div>
  )
}

function PeopleTab() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return TEAM_MEMBERS
    const q = search.toLowerCase()
    return TEAM_MEMBERS.filter((m) => m.name.toLowerCase().includes(q) || m.division.toLowerCase().includes(q) || m.role.toLowerCase().includes(q))
  }, [search])

  const grouped = useMemo(() => {
    const groups: Record<PresenceStatus, TeamMember[]> = { online: [], away: [], offline: [] }
    filtered.forEach((m) => groups[m.presence].push(m))
    return groups
  }, [filtered])

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-3">
        <div className="relative">
          <span className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '16px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team..."
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {(['online', 'away', 'offline'] as PresenceStatus[]).map((status) => {
          const members = grouped[status]
          if (members.length === 0) return null
          return (
            <div key={status} className="mb-4">
              <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {PRESENCE_LABEL[status]} ({members.length})
              </span>
              <div className="mt-1.5 space-y-1">
                {members.map((member) => <PersonCard key={member.email} member={member} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Tab 3: Meet (Quick Meeting Actions)
   ═══════════════════════════════════════════════ */

function MeetActionRow({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--portal-glow)' }}>
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
    </button>
  )
}

function MeetTab() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        <div className="mb-4">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Quick Actions</span>
          <div className="mt-1.5 space-y-1">
            <MeetActionRow icon="videocam" title="Start Instant Meeting" subtitle="Create a new Google Meet right now" onClick={() => window.open('https://meet.google.com/new', '_blank')} />
            <MeetActionRow icon="calendar_month" title="Schedule Meeting" subtitle="Open Google Calendar to schedule" onClick={() => window.open('https://calendar.google.com/calendar/r/eventedit', '_blank')} />
            <MeetActionRow icon="link" title="Share My Meeting Link" subtitle="Copy your personal Meet room link" onClick={() => { /* mock */ }} />
          </div>
        </div>

        <div className="mb-4">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Upcoming Meetings</span>
          <div className="mt-1.5 space-y-1">
            {UPCOMING_MEETINGS.map((mtg) => (
              <div key={mtg.title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{mtg.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{mtg.participants.join(', ')}</p>
                  </div>
                  <span className="ml-2 flex-shrink-0 text-xs font-medium text-[var(--text-secondary)]">{mtg.timeLabel}</span>
                </div>
                {mtg.joinable && (
                  <button
                    className="mt-2 flex items-center gap-1 rounded-md h-[34px] px-3 text-xs font-medium text-white transition-colors hover:opacity-90"
                    style={{ background: 'var(--portal)' }}
                    onClick={() => window.open('https://meet.google.com/new', '_blank')}
                  >
                    {mtg.timeLabel.startsWith('in') ? 'Join Now' : 'Join'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Recent Recordings</span>
          <div className="mt-1.5 space-y-0.5">
            {RECENT_RECORDINGS.map((rec) => (
              <button key={rec.title} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]">
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>play_circle</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-primary)]">{rec.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{rec.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Main Component — Slide-out Panel
   ═══════════════════════════════════════════════ */

export function ConnectPanel({ open, onClose }: ConnectPanelProps) {
  const [activeTab, setActiveTab] = useState<ConnectTab>('channels')

  const tabs: Array<{ key: ConnectTab; label: string; icon: string }> = [
    { key: 'channels', label: 'Channels', icon: 'tag' },
    { key: 'people', label: 'People', icon: 'people' },
    { key: 'meet', label: 'Meet', icon: 'videocam' },
  ]

  if (!open) return null

  return (
    <>
      {/* Backdrop — click to close */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col bg-[var(--bg-card)]"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}
      >
        <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-3 py-2">
          <div className="flex flex-1 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md h-[34px] text-xs font-medium transition-colors ${
                  activeTab === tab.key ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
                }`}
                style={activeTab === tab.key ? { background: 'var(--portal)' } : undefined}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Close panel"
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'channels' && <ChannelsTab />}
          {activeTab === 'people' && <PeopleTab />}
          {activeTab === 'meet' && <MeetTab />}
        </div>
      </div>
    </>
  )
}
