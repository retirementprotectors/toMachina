'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { query, where, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections, getDb } from '@tomachina/db/src/firestore'
import { useAuth } from '@tomachina/auth'
import { fetchValidated } from './fetchValidated'
import { useToast } from '../components/Toast'
import { collection as firestoreCollection } from 'firebase/firestore'

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
  _id?: string
  id?: string
  name: string
  slug?: string
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

/* ─── Firestore User Doc Shape (partial) ─── */

interface UserDoc {
  _id: string
  email?: string
  display_name?: string
  first_name?: string
  last_name?: string
  role?: string
  role_template?: string
  division?: string
  unit?: string
  status?: string
  last_active?: { seconds: number; nanoseconds: number } | string | null
  photo_url?: string
}

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

/** Compute presence from last_active timestamp */
function computePresence(lastActive: UserDoc['last_active']): PresenceStatus {
  if (!lastActive) return 'offline'
  let ts: number
  if (typeof lastActive === 'string') {
    ts = new Date(lastActive).getTime()
  } else if (lastActive && typeof lastActive === 'object' && 'seconds' in lastActive) {
    ts = lastActive.seconds * 1000
  } else {
    return 'offline'
  }
  const diffMin = (Date.now() - ts) / 60000
  if (diffMin < 5) return 'online'
  if (diffMin < 30) return 'away'
  return 'offline'
}

/* ─── Name Normalization (TRK-409) ─── */

/** Normalize "Last, First" format to "First Last" */
function normalizeDisplayName(name: string): string {
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim())
    if (first && last) return first + ' ' + last
  }
  return name
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

/** Inline initials avatar — renders photo_url when available, falls back to initials */
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
          {channel.lastMessage && <>{' \u2014 \u201C'}{channel.lastMessage}{'\u201D'}</>}
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
          <span className="text-xs text-[var(--text-muted)]">Message #{channelName}</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Firestore Channel Doc Shape ─── */
interface ChannelDoc {
  _id: string
  name?: string
  slug?: string
  pinned?: boolean
  created_at?: string
  updated_at?: string
}

function ChannelsTab() {
  const [search, setSearch] = useState('')
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [creating, setCreating] = useState(false)
  const { showToast } = useToast()

  // Query connect_channels from Firestore via useCollection
  const channelsQuery = useMemo(() => {
    const db = getDb()
    return query(firestoreCollection(db, 'connect_channels'))
  }, [])

  const { data: channelDocs, loading: channelsLoading } = useCollection<ChannelDoc>(channelsQuery, 'connect-channels')

  // Seed channels on first load if empty (via API)
  const seeded = useRef(false)
  useEffect(() => {
    if (!channelsLoading && channelDocs.length === 0 && !seeded.current) {
      seeded.current = true
      // Trigger seed by calling GET /api/connect/channels
      fetchValidated('/api/connect/channels').catch(() => {/* seed fire-and-forget */})
    }
  }, [channelsLoading, channelDocs.length])

  // Map Firestore docs to ChannelData
  const localChannels: ChannelData[] = useMemo(() => {
    return channelDocs.map((doc) => ({
      _id: doc._id,
      id: doc._id,
      name: doc.name || doc.slug || 'unnamed',
      slug: doc.slug,
      pinned: doc.pinned ?? false,
      unreadCount: 0,
      lastSender: '',
      lastMessage: '',
      timestamp: doc.updated_at || '',
    }))
  }, [channelDocs])

  /* TRK-073/074: If a channel is selected, show in-panel chat view */
  if (activeChannel) {
    return <ChannelChatView channelName={activeChannel} onBack={() => setActiveChannel(null)} />
  }

  const filterFn = (c: ChannelData) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())

  const filteredPinned = localChannels.filter((c) => c.pinned).filter(filterFn)
  const filteredAll = localChannels.filter((c) => !c.pinned).filter(filterFn)

  /* TRK-075/13566: Handle new channel creation via API */
  const handleCreateChannel = async () => {
    const trimmed = newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!trimmed || creating) return
    if (localChannels.some((c) => c.name === trimmed)) return
    setCreating(true)
    try {
      await fetchValidated('/api/connect/channels', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
      })
      // useCollection will pick up the new doc via onSnapshot
      setNewChannelName('')
      setShowNewForm(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create channel'
      showToast(msg, 'error')
    } finally {
      setCreating(false)
    }
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
        {channelsLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[var(--text-muted)]">Loading channels...</span>
          </div>
        )}

        {!channelsLoading && filteredPinned.length > 0 && (
          <div className="mb-3">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Pinned</span>
            <div className="mt-1.5 space-y-0.5">
              {filteredPinned.map((ch) => <ChannelRow key={ch._id || ch.name} channel={ch} onSelect={setActiveChannel} />)}
            </div>
          </div>
        )}

        {!channelsLoading && filteredAll.length > 0 && (
          <div className="mb-3">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">All Channels</span>
            <div className="mt-1.5 space-y-0.5">
              {filteredAll.map((ch) => <ChannelRow key={ch._id || ch.name} channel={ch} onSelect={setActiveChannel} />)}
            </div>
          </div>
        )}

        {!channelsLoading && localChannels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>tag</span>
            <p className="mt-2 text-xs text-[var(--text-muted)]">No channels yet</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        {showNewForm ? (
          /* TRK-075: Inline new channel form */
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-[var(--text-muted)]">
              Google Chat integration coming soon
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
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--portal)' }}
              >
                {creating ? 'Creating...' : 'Create'}
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
          {member.photo_url ? (
            <img src={member.photo_url} className="w-9 h-9 rounded-full object-cover" alt="" />
          ) : (
            <InitialsAvatar name={member.name} size={36} />
          )}
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

function PeopleTab({ open }: { open: boolean }) {
  const [search, setSearch] = useState('')
  const { user } = useAuth()

  // Query active users from Firestore
  const usersQuery = useMemo(() => {
    return query(collections.users(), where('status', '==', 'active'))
  }, [])

  const { data: userDocs, loading } = useCollection<UserDoc>(usersQuery, 'connect-people')

  // Map Firestore docs to TeamMember with computed presence
  const teamMembers: TeamMember[] = useMemo(() => {
    return userDocs.map((u) => {
      const rawName = u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown'
      const displayName = normalizeDisplayName(rawName)
      return {
        name: displayName,
        email: u.email || u._id,
        role: u.role_template || u.role || '',
        division: u.division || u.unit || '',
        presence: computePresence(u.last_active),
        photo_url: u.photo_url,
      }
    })
  }, [userDocs])

  // Post presence heartbeat every 60s while panel is open
  useEffect(() => {
    if (!open || !user?.email) return
    // Fire immediately
    fetchValidated('/api/connect/presence', { method: 'POST' }).catch(() => {})
    const interval = setInterval(() => {
      fetchValidated('/api/connect/presence', { method: 'POST' }).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [open, user?.email])

  const filtered = useMemo(() => {
    if (!search) return teamMembers
    const q = search.toLowerCase()
    return teamMembers.filter((m) => m.name.toLowerCase().includes(q) || m.division.toLowerCase().includes(q) || m.role.toLowerCase().includes(q))
  }, [search, teamMembers])

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
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[var(--text-muted)]">Loading team...</span>
          </div>
        )}

        {!loading && (['online', 'away', 'offline'] as PresenceStatus[]).map((status) => {
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

        {!loading && teamMembers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>people</span>
            <p className="mt-2 text-xs text-[var(--text-muted)]">No active team members</p>
          </div>
        )}
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
  const [meetings, setMeetings] = useState<MeetingData[]>([])
  const [recordings, setRecordings] = useState<RecordingData[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch calendar data from API
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchValidated<{ meetings: MeetingData[]; recordings: RecordingData[] }>('/api/connect/calendar')
        if (!cancelled && result.success && result.data) {
          setMeetings(result.data.meetings || [])
          setRecordings(result.data.recordings || [])
        }
      } catch {
        // Silent fail — empty state is fine
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        <div className="mb-4">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Quick Actions</span>
          <div className="mt-1.5 space-y-1">
            <MeetActionRow icon="videocam" title="Start Instant Meeting" subtitle="Create a new Google Meet right now" onClick={() => window.open('https://meet.google.com/new', '_blank')} />
            <MeetActionRow icon="calendar_month" title="Schedule Meeting" subtitle="Open Google Calendar to schedule" onClick={() => window.open('https://calendar.google.com/calendar/r/eventedit', '_blank')} />
            <MeetActionRow icon="link" title="Share My Meeting Link" subtitle="Copy your personal Meet room link" onClick={() => { /* TODO: wire personal Meet link */ }} />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <span className="text-xs text-[var(--text-muted)]">Loading calendar...</span>
          </div>
        )}

        {!loading && meetings.length > 0 && (
          <div className="mb-4">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Upcoming Meetings</span>
            <div className="mt-1.5 space-y-1">
              {meetings.map((mtg) => (
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
        )}

        {!loading && recordings.length > 0 && (
          <div className="mb-4">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Recent Recordings</span>
            <div className="mt-1.5 space-y-0.5">
              {recordings.map((rec) => (
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
        )}

        {!loading && meetings.length === 0 && recordings.length === 0 && (
          <div className="mb-4">
            <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Upcoming Meetings</span>
            <div className="mt-3 flex flex-col items-center justify-center py-4">
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>calendar_today</span>
              <p className="mt-2 text-xs text-[var(--text-muted)]">No upcoming meetings</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Google Calendar integration coming soon</p>
            </div>
          </div>
        )}
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
          {activeTab === 'people' && <PeopleTab open={open} />}
          {activeTab === 'meet' && <MeetTab />}
        </div>
      </div>
    </>
  )
}
