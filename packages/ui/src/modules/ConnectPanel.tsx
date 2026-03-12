'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  query,
  where,
  orderBy,
  collection,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { useAuth } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'

/* ─── Types ─── */

interface ConnectPanelProps {
  portal: string
  clientId?: string
  userId?: string
}

type ConnectTab = 'channels' | 'chat' | 'meet'

interface ChannelRecord {
  _id: string
  name?: string
  description?: string
  icon?: string
  members?: string[]
  created_at?: string
  updated_at?: string
  last_message?: string
  last_message_at?: string
  unread_count?: number
}

interface ChatRecord {
  _id: string
  participants?: string[]
  participant_names?: Record<string, string>
  last_message?: string
  last_message_at?: string
  last_sender?: string
  unread_count?: number
}

interface MessageRecord {
  _id: string
  content?: string
  sender_email?: string
  sender_name?: string
  created_at?: string
  channel_id?: string
  chat_id?: string
  type?: string
}

interface MeetRoomRecord {
  _id: string
  room_name?: string
  meet_link?: string
  host_email?: string
  host_name?: string
  status?: string
  created_at?: string
}

interface UserProfileData {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  job_title?: string
  division?: string
  status?: string
  phone?: string
  employee_profile?: {
    meet_room?: { meet_link?: string }
    profile_photo_url?: string
  }
}

/* ─── Helpers ─── */

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    if (days === 1) return 'Yesterday'
    if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}

function getOtherParticipant(
  chat: ChatRecord,
  currentEmail: string
): { email: string; name: string } {
  const others = (chat.participants || []).filter((p) => p !== currentEmail)
  const otherEmail = others[0] || 'Unknown'
  const name = chat.participant_names?.[otherEmail] || otherEmail.split('@')[0]
  return { email: otherEmail, name }
}

/* ─── Empty State ─── */

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">{icon}</span>
      <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
    </div>
  )
}

/* ─── Panel Close Button ─── */

function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      title="Close panel"
    >
      <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
    </button>
  )
}

/* ─── Main Component ─── */

export function ConnectPanel({ portal }: ConnectPanelProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ConnectTab>('channels')
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [panel3UserId, setPanel3UserId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')

  // Determine which panel is open
  const hasPanel2 = selectedChannelId !== null || selectedChatId !== null
  const hasPanel3 = panel3UserId !== null

  // Close handlers (right-to-left)
  const closePanel3 = useCallback(() => {
    setPanel3UserId(null)
  }, [])

  const closePanel2 = useCallback(() => {
    setSelectedChannelId(null)
    setSelectedChatId(null)
    setPanel3UserId(null)
    setMessageInput('')
  }, [])

  // Queries
  const channelsQuery: Query<DocumentData> | null = useMemo(() => {
    if (!user?.email) return null
    try {
      return query(collection(getDb(), 'channels'), orderBy('updated_at', 'desc'))
    } catch {
      return null
    }
  }, [user?.email])

  const chatsQuery: Query<DocumentData> | null = useMemo(() => {
    if (!user?.email) return null
    try {
      return query(
        collection(getDb(), 'direct_messages'),
        where('participants', 'array-contains', user.email),
        orderBy('last_message_at', 'desc')
      )
    } catch {
      return null
    }
  }, [user?.email])

  const meetRoomsQuery: Query<DocumentData> | null = useMemo(() => {
    if (!user?.email) return null
    try {
      return query(collection(getDb(), 'meet_rooms'), orderBy('created_at', 'desc'))
    } catch {
      return null
    }
  }, [user?.email])

  // Messages for selected channel or chat
  const messagesQuery: Query<DocumentData> | null = useMemo(() => {
    if (selectedChannelId) {
      try {
        return query(
          collection(getDb(), 'messages'),
          where('channel_id', '==', selectedChannelId),
          orderBy('created_at', 'asc')
        )
      } catch {
        return null
      }
    }
    if (selectedChatId) {
      try {
        return query(
          collection(getDb(), 'messages'),
          where('chat_id', '==', selectedChatId),
          orderBy('created_at', 'asc')
        )
      } catch {
        return null
      }
    }
    return null
  }, [selectedChannelId, selectedChatId])

  // User profile for Panel 3
  const profileQuery: Query<DocumentData> | null = useMemo(() => {
    if (!panel3UserId) return null
    return query(collection(getDb(), 'users'), where('email', '==', panel3UserId))
  }, [panel3UserId])

  const { data: channels } = useCollection<ChannelRecord>(channelsQuery, `connect-channels-${user?.email || 'none'}`)
  const { data: chats } = useCollection<ChatRecord>(chatsQuery, `connect-chats-${user?.email || 'none'}`)
  const { data: meetRooms } = useCollection<MeetRoomRecord>(meetRoomsQuery, `connect-meets-${user?.email || 'none'}`)
  const { data: messages } = useCollection<MessageRecord>(messagesQuery, `connect-msgs-${selectedChannelId || selectedChatId || 'none'}`)
  const { data: profileData } = useCollection<UserProfileData>(profileQuery, `connect-profile-${panel3UserId || 'none'}`)

  const selectedChannel = channels.find((c) => c._id === selectedChannelId)
  const selectedChat = chats.find((c) => c._id === selectedChatId)
  const profileUser = profileData.length > 0 ? profileData[0] : null

  // Get panel 2 title
  const panel2Title = selectedChannel?.name || (selectedChat ? getOtherParticipant(selectedChat, user?.email || '').name : '')

  // Send message placeholder
  const handleSend = useCallback(() => {
    if (!messageInput.trim()) return
    // Placeholder: would write to Firestore messages collection
    setMessageInput('')
  }, [messageInput])

  const tabs: Array<{ key: ConnectTab; label: string; icon: string }> = [
    { key: 'channels', label: 'Channels', icon: 'tag' },
    { key: 'chat', label: 'Chat', icon: 'chat_bubble' },
    { key: 'meet', label: 'Meet', icon: 'videocam' },
  ]

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-7xl gap-0 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
      {/* ═══ Panel 1: List ═══ */}
      <div
        className="flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-card)]"
        style={{ width: '280px', minWidth: '280px' }}
      >
        {/* Header */}
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">RPI Connect</h2>
          <p className="text-xs text-[var(--text-muted)]">Internal team communication</p>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-[var(--border-subtle)] px-2 py-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                closePanel2()
              }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
              }`}
              style={activeTab === tab.key ? { background: 'var(--portal)' } : undefined}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="border-b border-[var(--border-subtle)] px-3 py-2">
          {activeTab === 'channels' && (
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white transition-colors"
              style={{ background: 'var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
              New Channel
            </button>
          )}
          {activeTab === 'chat' && (
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white transition-colors"
              style={{ background: 'var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>
              New Message
            </button>
          )}
          {activeTab === 'meet' && (
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white transition-colors"
              style={{ background: 'var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>videocam</span>
              Start Meet
            </button>
          )}
        </div>

        {/* List content */}
        <div className="flex-1 overflow-y-auto">
          {/* Channels Tab */}
          {activeTab === 'channels' && (
            channels.length > 0 ? (
              <div className="space-y-0.5 p-1">
                {channels.map((channel) => {
                  const isSelected = selectedChannelId === channel._id
                  return (
                    <button
                      key={channel._id}
                      onClick={() => {
                        setSelectedChannelId(channel._id)
                        setSelectedChatId(null)
                        setPanel3UserId(null)
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--portal-glow)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: isSelected ? 'var(--portal)' : 'var(--bg-surface)' }}
                      >
                        <span
                          className="material-icons-outlined"
                          style={{ fontSize: '16px', color: isSelected ? 'white' : 'var(--text-muted)' }}
                        >
                          {channel.icon || 'tag'}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isSelected ? 'text-[var(--portal-accent)]' : 'text-[var(--text-primary)]'}`}>
                            {channel.name || 'Unnamed'}
                          </span>
                          {channel.unread_count && channel.unread_count > 0 && (
                            <span
                              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                              style={{ background: 'var(--portal)' }}
                            >
                              {channel.unread_count}
                            </span>
                          )}
                        </div>
                        {channel.last_message && (
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {channel.last_message}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon="tag"
                title="No channels yet"
                subtitle="Channels will appear here when created"
              />
            )
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            chats.length > 0 ? (
              <div className="space-y-0.5 p-1">
                {chats.map((chat) => {
                  const other = getOtherParticipant(chat, user?.email || '')
                  const isSelected = selectedChatId === chat._id
                  return (
                    <button
                      key={chat._id}
                      onClick={() => {
                        setSelectedChatId(chat._id)
                        setSelectedChannelId(null)
                        setPanel3UserId(null)
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--portal-glow)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div
                        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: isSelected ? 'var(--portal)' : 'var(--bg-surface)', color: isSelected ? 'white' : 'var(--text-muted)' }}
                      >
                        {other.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isSelected ? 'text-[var(--portal-accent)]' : 'text-[var(--text-primary)]'}`}>
                            {other.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {formatTimestamp(chat.last_message_at)}
                          </span>
                        </div>
                        {chat.last_message && (
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {chat.last_sender === user?.email ? 'You: ' : ''}{chat.last_message}
                          </p>
                        )}
                      </div>
                      {chat.unread_count && chat.unread_count > 0 && (
                        <span
                          className="mt-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                          style={{ background: 'var(--portal)' }}
                        >
                          {chat.unread_count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon="chat_bubble"
                title="No conversations yet"
                subtitle="Start a chat with a team member"
              />
            )
          )}

          {/* Meet Tab */}
          {activeTab === 'meet' && (
            meetRooms.length > 0 ? (
              <div className="space-y-0.5 p-1">
                {meetRooms.map((room) => (
                  <a
                    key={room._id}
                    href={room.meet_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'var(--portal-glow)' }}
                    >
                      <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>
                        videocam
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {room.room_name || 'Meet Room'}
                      </span>
                      {room.host_name && (
                        <p className="text-xs text-[var(--text-muted)]">{room.host_name}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        room.status === 'active'
                          ? 'bg-[rgba(16,185,129,0.1)] text-[var(--success)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {room.status || 'Available'}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="videocam"
                title="No meeting rooms"
                subtitle="Meeting rooms will appear here when configured"
              />
            )
          )}
        </div>
      </div>

      {/* ═══ Panel 2: Conversation ═══ */}
      {hasPanel2 && (
        <div
          className="flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-primary)]"
          style={{ flex: '1 1 auto', minWidth: '320px' }}
        >
          {/* Panel 2 Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-2">
              {selectedChannel && (
                <>
                  <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
                    {selectedChannel.icon || 'tag'}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{panel2Title}</h3>
                    {selectedChannel.description && (
                      <p className="text-xs text-[var(--text-muted)]">{selectedChannel.description}</p>
                    )}
                  </div>
                </>
              )}
              {selectedChat && (
                <>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--portal)' }}
                  >
                    {panel2Title[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{panel2Title}</h3>
                    <p className="text-xs text-[var(--text-muted)]">Direct message</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Info button (opens Panel 3) */}
              {selectedChannel && (
                <button
                  onClick={() => setPanel3UserId('channel-info')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  title="Channel info"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>info</span>
                </button>
              )}
              {selectedChat && (
                <button
                  onClick={() => {
                    const other = getOtherParticipant(selectedChat, user?.email || '')
                    setPanel3UserId(other.email)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  title="View profile"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>person</span>
                </button>
              )}
              <PanelCloseButton onClick={closePanel2} />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isOwn = msg.sender_email === user?.email
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${
                          isOwn
                            ? 'rounded-br-sm text-white'
                            : 'rounded-bl-sm bg-[var(--bg-card)] text-[var(--text-primary)]'
                        }`}
                        style={isOwn ? { background: 'var(--portal)' } : undefined}
                      >
                        {!isOwn && (
                          <p className="mb-0.5 text-[10px] font-medium text-[var(--portal-accent)]">
                            {msg.sender_name || msg.sender_email?.split('@')[0] || 'Unknown'}
                          </p>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        <p className={`mt-1 text-right text-[10px] ${isOwn ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                          {formatTimestamp(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon="forum"
                title="No messages yet"
                subtitle="Be the first to send a message"
              />
            )}
          </div>

          {/* Message Input */}
          <div className="border-t border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!messageInput.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--portal)' }}
                title="Send message"
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Panel 3: Context ═══ */}
      {hasPanel3 && hasPanel2 && (
        <div
          className="flex flex-col bg-[var(--bg-card)]"
          style={{ width: '260px', minWidth: '260px' }}
        >
          {/* Panel 3 Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {panel3UserId === 'channel-info' ? 'Channel Info' : 'Profile'}
            </span>
            <PanelCloseButton onClick={closePanel3} />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Channel Info */}
            {panel3UserId === 'channel-info' && selectedChannel && (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-xl"
                    style={{ background: 'var(--portal-glow)' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '28px', color: 'var(--portal)' }}>
                      {selectedChannel.icon || 'tag'}
                    </span>
                  </span>
                  <h4 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                    {selectedChannel.name}
                  </h4>
                  {selectedChannel.description && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{selectedChannel.description}</p>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Members ({selectedChannel.members?.length || 0})
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {(selectedChannel.members || []).map((email) => (
                      <div key={email} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--text-secondary)]">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                          person
                        </span>
                        {email.split('@')[0]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* User Profile */}
            {panel3UserId && panel3UserId !== 'channel-info' && (
              profileUser ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center">
                    {(profileUser.employee_profile as EmployeeProfileForPanel3 | undefined)?.profile_photo_url ? (
                      <img
                        src={(profileUser.employee_profile as EmployeeProfileForPanel3).profile_photo_url}
                        alt=""
                        className="h-16 w-16 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
                        style={{ background: 'var(--portal)' }}
                      >
                        {(profileUser.first_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <h4 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                      {profileUser.first_name} {profileUser.last_name}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {profileUser.job_title || 'Team Member'}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {profileUser.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>email</span>
                        <span className="text-[var(--text-secondary)]">{profileUser.email}</span>
                      </div>
                    )}
                    {profileUser.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>phone</span>
                        <span className="text-[var(--text-secondary)]">{profileUser.phone}</span>
                      </div>
                    )}
                    {profileUser.division && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>account_tree</span>
                        <span className="text-[var(--text-secondary)]">{profileUser.division}</span>
                      </div>
                    )}
                    {profileUser.status && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>circle</span>
                        <span
                          className={`font-medium ${
                            profileUser.status.toLowerCase() === 'active'
                              ? 'text-[var(--success)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {profileUser.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                    {(profileUser.employee_profile as EmployeeProfileForPanel3 | undefined)?.meet_room?.meet_link && (
                      <a
                        href={(profileUser.employee_profile as EmployeeProfileForPanel3).meet_room?.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
                      >
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>videocam</span>
                        Join Meet Room
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon="person"
                  title="Profile not found"
                  subtitle="User profile data is not available"
                />
              )
            )}
          </div>
        </div>
      )}

      {/* ═══ No Panel 2: Show welcome state ═══ */}
      {!hasPanel2 && (
        <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg-primary)] text-center">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">forum</span>
          <h3 className="mt-4 text-lg font-semibold text-[var(--text-secondary)]">RPI Connect</h3>
          <p className="mt-1 max-w-xs text-sm text-[var(--text-muted)]">
            Select a channel, chat, or meeting room from the left to get started.
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── Helper type for Panel 3 profile access ─── */
interface EmployeeProfileForPanel3 {
  profile_photo_url?: string
  meet_room?: { meet_link?: string }
}
