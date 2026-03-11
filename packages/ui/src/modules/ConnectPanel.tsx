'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  query,
  where,
  orderBy,
  limit as fbLimit,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { useAuth } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import type { Communication, Client, Template } from '@tomachina/core'

/* ─── Types ─── */

interface CommRecord extends Communication {
  _id: string
  from_name?: string
  to_name?: string
  from_email?: string
  to_email?: string
  from_phone?: string
  to_phone?: string
  preview?: string
}

interface ClientRecord extends Client {
  _id: string
  full_name?: string
  dnd_all?: boolean
  dnd_email?: boolean
  dnd_sms?: boolean
}

interface TemplateRecord extends Template {
  _id: string
}

type ChannelFilter = 'all' | 'sms' | 'email' | 'call' | 'meeting'
type ComposeChannel = 'sms' | 'email'

/* ─── Channel Config ─── */

const CHANNEL_ICONS: Record<string, string> = {
  sms: 'sms',
  email: 'email',
  call: 'phone',
  meeting: 'videocam',
  chat: 'chat',
}

const CHANNEL_FILTERS: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
  { key: 'call', label: 'Call' },
  { key: 'meeting', label: 'Meeting' },
]

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

function getPreview(comm: CommRecord): string {
  if (comm.preview) return comm.preview
  if (comm.body) return comm.body.slice(0, 120) + (comm.body.length > 120 ? '...' : '')
  if (comm.subject) return comm.subject
  return 'No preview available'
}

function getSenderName(comm: CommRecord): string {
  if (comm.from_name) return comm.from_name
  if (comm.from_email) return comm.from_email.split('@')[0]
  if (comm.from_phone) return comm.from_phone
  return comm.direction === 'outbound' ? 'You' : 'Unknown'
}

/* ─── Main Component ─── */

interface ConnectPanelProps {
  portal: string
  clientId?: string
  userId?: string
}

export function ConnectPanel({ portal, clientId, userId }: ConnectPanelProps) {
  const { user } = useAuth()
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeChannel, setComposeChannel] = useState<ComposeChannel>('email')
  const [composeRecipient, setComposeRecipient] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')

  // Query communications — scoped by client or user
  const commsQuery: Query<DocumentData> | null = useMemo(() => {
    if (clientId) {
      return query(
        collections.communications(),
        where('client_id', '==', clientId),
        orderBy('created_at', 'desc'),
        fbLimit(50)
      )
    }
    if (userId) {
      return query(
        collections.communications(),
        where('from_email', '==', userId),
        orderBy('created_at', 'desc'),
        fbLimit(50)
      )
    }
    // Default: show recent comms for current user
    if (user?.email) {
      return query(
        collections.communications(),
        orderBy('created_at', 'desc'),
        fbLimit(50)
      )
    }
    return null
  }, [clientId, userId, user?.email])

  const { data: communications, loading: commsLoading, error: commsError } =
    useCollection<CommRecord>(commsQuery, `connect-comms-${clientId || userId || user?.email || 'none'}`)

  // Query client for contact card (if in client context)
  const clientQuery: Query<DocumentData> | null = useMemo(() => {
    if (!clientId) return null
    return query(collections.clients(), where('client_id', '==', clientId))
  }, [clientId])

  const { data: clientRecords } = useCollection<ClientRecord>(
    clientQuery,
    `connect-client-${clientId || 'none'}`
  )
  const clientRecord = clientRecords.length > 0 ? clientRecords[0] : null

  // Query templates for quick-insert
  const templateQuery: Query<DocumentData> | null = useMemo(() => {
    return query(collections.templates(), where('status', '==', 'Active'))
  }, [])

  const { data: templates } = useCollection<TemplateRecord>(
    templateQuery,
    'connect-templates'
  )

  // Filter communications
  const filteredComms = useMemo(() => {
    let filtered = communications
    if (channelFilter !== 'all') {
      filtered = filtered.filter(
        (c) => c.channel?.toLowerCase() === channelFilter
      )
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          getPreview(c).toLowerCase().includes(q) ||
          getSenderName(c).toLowerCase().includes(q) ||
          (c.subject || '').toLowerCase().includes(q)
      )
    }
    return filtered
  }, [communications, channelFilter, searchQuery])

  // Recent activity (last 5)
  const recentActivity = useMemo(() => communications.slice(0, 5), [communications])

  // DND checks
  const dndAll = clientRecord?.dnd_all === true
  const dndEmail = clientRecord?.dnd_email === true || dndAll
  const dndSms = clientRecord?.dnd_sms === true || dndAll

  // Template insert
  const handleTemplateInsert = useCallback(
    (templateId: string) => {
      const tmpl = templates.find((t) => t._id === templateId)
      if (!tmpl) return
      if (tmpl.subject && !composeSubject) {
        setComposeSubject(tmpl.subject)
      }
      if (tmpl.body) {
        setComposeBody((prev) => (prev ? prev + '\n\n' + tmpl.body : tmpl.body || ''))
      }
      setSelectedTemplate('')
    },
    [templates, composeSubject]
  )

  // Send handler (placeholder)
  const handleSend = useCallback(() => {
    // Placeholder — /api/comms/send not yet available
    setComposeOpen(false)
    setComposeRecipient('')
    setComposeSubject('')
    setComposeBody('')
  }, [])

  /* ─── Loading ─── */
  if (commsLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Connect</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* ─── Error ─── */
  if (commsError) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Connect</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load communications: {commsError.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Connect</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {clientId ? 'Client communications' : 'Communications hub'}
          </p>
        </div>
        <button
          onClick={() => setComposeOpen(!composeOpen)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>edit</span>
          Compose
        </button>
      </div>

      <div className="mt-6 flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Compose Panel */}
          {composeOpen && (
            <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">New Message</h3>
                <button
                  onClick={() => setComposeOpen(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {/* Channel Selector */}
              <div className="mt-3 flex gap-2">
                {(['sms', 'email'] as ComposeChannel[]).map((ch) => {
                  const disabled = (ch === 'sms' && dndSms) || (ch === 'email' && dndEmail)
                  return (
                    <button
                      key={ch}
                      onClick={() => !disabled && setComposeChannel(ch)}
                      disabled={disabled}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        composeChannel === ch
                          ? 'text-white'
                          : disabled
                          ? 'border border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50'
                          : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={composeChannel === ch ? { background: 'var(--portal)' } : undefined}
                    >
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                        {CHANNEL_ICONS[ch]}
                      </span>
                      {ch.toUpperCase()}
                      {disabled && ' (DND)'}
                    </button>
                  )
                })}
              </div>

              {/* Recipient */}
              <input
                type="text"
                placeholder={composeChannel === 'sms' ? 'Phone number' : 'Email address'}
                value={composeRecipient}
                onChange={(e) => setComposeRecipient(e.target.value)}
                className="mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />

              {/* Subject (email only) */}
              {composeChannel === 'email' && (
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
                />
              )}

              {/* Template Quick-Insert */}
              {templates.length > 0 && (
                <div className="mt-2">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateInsert(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
                  >
                    <option value="">Insert template...</option>
                    {templates
                      .filter((t) => t.channel?.toLowerCase() === composeChannel || !t.channel)
                      .map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.template_name || t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Body */}
              <textarea
                placeholder="Type your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />

              {/* Send */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleSend}
                  disabled={!composeRecipient.trim() || !composeBody.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: 'var(--portal)' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>send</span>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setChannelFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  channelFilter === f.key
                    ? 'text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                style={channelFilter === f.key ? { background: 'var(--portal)' } : undefined}
              >
                {f.label}
              </button>
            ))}

            {/* Search */}
            <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1">
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                search
              </span>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 border-none bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* Message Timeline */}
          <div className="mt-4 space-y-2">
            {filteredComms.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] py-16">
                <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">
                  forum
                </span>
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  {communications.length === 0
                    ? 'No communications yet'
                    : 'No messages match your filters'}
                </p>
              </div>
            ) : (
              filteredComms.map((comm) => (
                <div
                  key={comm._id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  {/* Channel Icon */}
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'var(--portal-glow)' }}
                  >
                    <span
                      className="material-icons-outlined"
                      style={{ fontSize: '18px', color: 'var(--portal)' }}
                    >
                      {CHANNEL_ICONS[comm.channel?.toLowerCase()] || 'message'}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {getSenderName(comm)}
                      </span>
                      {comm.direction && (
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '12px' }}>
                          {comm.direction === 'outbound' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-[var(--text-muted)]">
                        {formatTimestamp(comm.sent_at || comm.created_at)}
                      </span>
                    </div>
                    {comm.subject && (
                      <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {comm.subject}
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {getPreview(comm)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contact Card Sidebar (client context) */}
        {clientId && (
          <div className="w-72 flex-shrink-0">
            <div className="sticky top-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Contact
              </h3>

              {clientRecord ? (
                <div className="mt-3">
                  {/* Client Name */}
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: 'var(--portal)' }}
                    >
                      {(clientRecord.first_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {clientRecord.full_name ||
                          `${clientRecord.first_name} ${clientRecord.last_name}`}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {clientRecord.client_status}
                      </p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-4 space-y-2">
                    {clientRecord.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                          phone
                        </span>
                        <span className="text-[var(--text-secondary)]">{clientRecord.phone}</span>
                      </div>
                    )}
                    {clientRecord.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                          email
                        </span>
                        <span className="text-[var(--text-secondary)]">{clientRecord.email}</span>
                      </div>
                    )}
                  </div>

                  {/* DND Indicators */}
                  {(dndAll || dndEmail || dndSms) && (
                    <div className="mt-4 space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Do Not Disturb
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {dndAll && (
                          <span className="rounded-full bg-[var(--error)] px-2 py-0.5 text-xs font-medium text-white">
                            All Channels
                          </span>
                        )}
                        {dndEmail && !dndAll && (
                          <span className="rounded-full bg-[rgba(239,68,68,0.15)] px-2 py-0.5 text-xs font-medium text-[var(--error)]">
                            Email
                          </span>
                        )}
                        {dndSms && !dndAll && (
                          <span className="rounded-full bg-[rgba(239,68,68,0.15)] px-2 py-0.5 text-xs font-medium text-[var(--error)]">
                            SMS
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity */}
                  {recentActivity.length > 0 && (
                    <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Recent Activity
                      </span>
                      <div className="mt-2 space-y-1.5">
                        {recentActivity.map((a) => (
                          <div key={a._id} className="flex items-center gap-2">
                            <span
                              className="material-icons-outlined text-[var(--text-muted)]"
                              style={{ fontSize: '12px' }}
                            >
                              {CHANNEL_ICONS[a.channel?.toLowerCase()] || 'message'}
                            </span>
                            <span className="flex-1 truncate text-xs text-[var(--text-muted)]">
                              {getPreview(a).slice(0, 40)}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {formatTimestamp(a.sent_at || a.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-xs text-[var(--text-muted)]">
                  No client data available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
