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
  photo_url?: string
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
  { name: 'Vince Vazquez', email: 'vince@retireprotected.com', role: 'Sales Division', division: 'Sales', presence: 'online' },
  { name: 'Nikki Gray', email: 'nikki@retireprotected.com', role: 'Service Division', division: 'Service', presence: 'online' },
  { name: 'Matt McCormick', email: 'matt@retireprotected.com', role: 'DAVID/B2B', division: 'DAVID', presence: 'away' },
  { name: 'Dr. Aprille Trupiano', email: 'aprille@retireprotected.com', role: 'Legacy Services', division: 'Legacy', presence: 'away' },
  { name: 'Shane Parmenter', email: 'shane@retireprotected.com', role: 'CFO', division: 'Finance', presence: 'offline' },
]

const CHANNELS: ChannelData[] = [
  { name: 'rpi-leadership', pinned: true, unreadCount: 3, lastSender: 'John B', lastMessage: 'Updated the pipeline metrics for Q1...', timestamp: '10m ago' },
  { name: 'sales-team', pinned: true, unreadCount: 1, lastSender: 'Vince', lastMessage: 'T65 list is ready for review...', timestamp: '25m ago' },
  { name: 'service-team', pinned: false, unreadCount: 0, lastSender: 'Nikki', lastMessage: 'Sprenger RMDs are done for March', timestamp: '2h ago' },
  { name: 'legacy-services', pinned: false, unreadCount: 0, lastSender: 'Aprille', lastMessage: 'Estate docs uploaded to DEX', timestamp: '1d ago' },
  { name: 'david-deals', pinned: false, unreadCount: 0, lastSender: 'Matt', lastMessage: 'Gradient onboarding Q2 timeline set...', timestamp: '2d ago' },
]

const UPCOMING_MEETINGS: MeetingData[] = [
  { title: 'Team Standup', participants: ['Josh', 'John', 'Vince', 'Nikki'], timeLabel: 'in 45 min', joinable: true },
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

/* ─── Avatar Helpers ─── */

/** Deterministic color from name string for initials avatars */
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
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Inline initials avatar — Sprint 10 will wire Google People API photos */
function InitialsAvatar({ name, size = 36 }: { name: string; size?: number }) {
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

/* ═══════════════════════════════════════════════
   Tab 1: Channels
   ═══════════════════════════════════════════════ */

function ChannelRow({ channel, onSelect }: { channel: ChannelData; onSelect: (name: string) => void }) {
  const hasUnread = channel.unreadCount > 0
  return (
    <button
      className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
      onClick={() => onSelect(channel.name)}
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

/* ─── Mock Chat Messages (TRK-098) ─── */

interface MockChatMessage {
  sender: string
  text: string
  time: string
}

const MOCK_CHANNEL_MESSAGES: Record<string, MockChatMessage[]> = {
  'rpi-leadership': [
    { sender: 'John B', text: 'Pipeline metrics for Q1 are updated. Revenue tracking ahead of forecast.', time: '10:42 AM' },
    { sender: 'Vince', text: 'T65 list pull is ready, 847 names for March. Starting outreach tomorrow.', time: '10:55 AM' },
    { sender: 'Josh', text: 'Great work team. Lets review in standup.', time: '11:03 AM' },
  ],
  'sales-team': [
    { sender: 'Vince', text: 'AEP numbers coming in strong. 12 enrollments this week.', time: '9:15 AM' },
    { sender: 'Nikki', text: 'Reminder to get RMD paperwork in by Friday.', time: '9:32 AM' },
  ],
  'service-team': [
    { sender: 'Nikki', text: 'Sprenger RMDs are done for March. All 23 processed.', time: '2:00 PM' },
    { sender: 'John B', text: 'Nice. Any Gradient stragglers?', time: '2:15 PM' },
    { sender: 'Nikki', text: 'Two left, waiting on carrier paperwork. Should clear by EOD.', time: '2:18 PM' },
  ],
}

const DEFAULT_MOCK_MESSAGES: MockChatMessage[] = [
  { sender: 'System', text: 'Channel created. Start chatting!', time: 'now' },
]

/** In-panel chat placeholder shown when a channel is selected (TRK-073/074, TRK-098) */
function ChannelChatView({ channelName, onBack }: { channelName: string; onBack: () => void }) {
  const messages = MOCK_CHANNEL_MESSAGES[channelName] ?? DEFAULT_MOCK_MESSAGES

  return (
    <div className="flex h-full flex-col">
      {/* Channel chat header */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Back to channels"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>tag</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{channelName}</span>
        {/* TRK-098: Powered by Google Chat badge */}
        <span className="ml-auto flex items-center gap-1 rounded bg-[var(--bg-surface)] px-2 py-0.5">
          <span className="text-[9px] text-[var(--text-muted)]">Powered by</span>
          <span className="text-[9px] font-semibold text-[#1a73e8]">Google Chat</span>
        </span>
      </div>

      {/* TRK-098: Mock messages */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <InitialsAvatar name={msg.sender} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">{msg.sender}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{msg.time}</span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Compose bar (stub) */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
          <span className="text-xs text-[var(--text-muted)]">Message #{channelName} — Sprint 10</span>
        </div>
      </div>
    </div>
  )
}

function ChannelsTab() {
  const [search, setSearch] = useState('')
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [localChannels, setLocalChannels] = useState<ChannelData[]>(CHANNELS)

  /* TRK-073/074: If a channel is selected, show in-panel chat view */
  if (activeChannel) {
    return <ChannelChatView channelName={activeChannel} onBack={() => setActiveChannel(null)} />
  }

  const filterFn = (c: ChannelData) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())

  const filteredPinned = localChannels.filter((c) => c.pinned).filter(filterFn)
  const filteredAll = localChannels.filter((c) => !c.pinned).filter(filterFn)

  /* TRK-075: Handle new channel creation */
  const handleCreateChannel = () => {
    const trimmed = newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!trimmed) return
    if (localChannels.some((c) => c.name === trimmed)) return
    setLocalChannels((prev) => [
      ...prev,
      {
        name: trimmed,
        pinned: false,
        unreadCount: 0,
        lastSender: 'You',
        lastMessage: 'Channel created',
        timestamp: 'now',
      },
    ])
    setNewChannelName('')
    setShowNewForm(false)
  }

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
              {filteredPinned.map((ch) => <ChannelRow key={ch.name} channel={ch} onSelect={setActiveChannel} />)}
            </div>
          </div>
        )}

        {filteredAll.length > 0 && (
          <div className="mb-3">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">All Channels</span>
            <div className="mt-1.5 space-y-0.5">
              {filteredAll.map((ch) => <ChannelRow key={ch.name} channel={ch} onSelect={setActiveChannel} />)}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        {showNewForm ? (
          /* TRK-075: Inline new channel form */
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-[var(--text-muted)]">
              Real Google Chat integration in Sprint 10
            </p>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel() }}
              placeholder="channel-name"
              autoFocus
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateChannel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--portal)' }}
              >
                Create
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewChannelName('') }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
            New Channel
          </button>
        )}
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
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <InitialsAvatar name={member.name} size={36} />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-card)] ${PRESENCE_DOT[member.presence]}`} />
        </div>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{member.name}</span>
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

/* ─── TRK-101: Responsive panel width classes ─── */

const CONNECT_PANEL_CLASSES = [
  'fixed right-0 top-0 z-50 flex h-full flex-col bg-[var(--bg-card)]',
  'w-screen',                    /* < 1024px: full-width overlay */
  'lg:w-[360px]',                /* 1024-1399px: compact */
  'min-[1400px]:w-[460px]',      /* >= 1400px: full width */
].join(' ')

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

      {/* TRK-101: Responsive panel widths */}
      <div
        className={CONNECT_PANEL_CLASSES}
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
