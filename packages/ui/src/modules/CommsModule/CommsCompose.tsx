'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchValidated } from '../fetchValidated'
import { useMmsUpload } from '../comms/useMmsUpload'
import { ActiveCallScreen } from './ActiveCallScreen'
import type { ActiveCallData } from './ActiveCallScreen'
import { useTwilioDevice } from './TwilioDeviceProvider'

/* ─── Types ─── */

type ComposeChannel = 'sms' | 'email' | 'call'

interface CommsComposeProps {
  onBack: () => void
  /** When set, locks the channel to this value (from tab navigation) */
  presetChannel?: ComposeChannel
  /** When set, pre-fills the To field with this contact */
  presetContact?: ClientResult | null
  /** When set, pre-fills the email subject (e.g. "Re: ...") */
  replySubject?: string
}

/* ─── Client Search Result ─── */

export interface ClientResult {
  id: string
  name: string
  phone: string
  email: string
  book: string
}

/* ─── Mock Templates (TRK-064) ─── */

interface CommsTemplate {
  id: string
  label: string
  channel: 'sms' | 'email' | 'both'
  body: string
}

const DEFAULT_TEMPLATES: CommsTemplate[] = [
  { id: 'appt-reminder', label: 'Appointment Reminder', channel: 'both', body: 'Hi {{name}}, this is a reminder about your upcoming appointment on {{date}}. Please call us if you need to reschedule.' },
  { id: 'aep-enrollment', label: 'AEP Enrollment Follow-Up', channel: 'both', body: 'Hi {{name}}, just following up on your Medicare enrollment. AEP ends December 7th — let us know if you have any questions.' },
  { id: 'rmd-notification', label: 'RMD Notification', channel: 'email', body: 'Dear {{name}}, this is a reminder that your Required Minimum Distribution (RMD) for the current tax year is due. Please review and contact us with any questions.' },
  { id: 'welcome', label: 'New Client Welcome', channel: 'both', body: 'Welcome to Retirement Protectors, {{name}}! We are excited to work with you. Your dedicated agent is {{agent}}.' },
  { id: 'birthday', label: 'Birthday Greeting', channel: 'sms', body: 'Happy Birthday, {{name}}! Wishing you all the best from your team at Retirement Protectors.' },
  { id: 'policy-review', label: 'Annual Policy Review', channel: 'email', body: 'Dear {{name}}, it is time for your annual policy review. We want to make sure your coverage still meets your needs. Please let us know a convenient time to connect.' },
]

/* ─── Twilio Stub Constants (TRK-095/096) ─── */

const TWILIO_888_NUMBER = '+1 (888) 620-8587'
const TWILIO_888_LABEL = 'RPI Toll-Free'

type StubSendState = 'idle' | 'sending' | 'sent'

/* ─── Dialer Key Pad (TRK-069: keyboard input) ─── */

function DialerPad({ number, onDigit, inputRef, onStartCall, callState }: {
  number: string
  onDigit: (d: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onStartCall: () => void
  callState: 'idle' | 'connecting' | 'active'
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

  return (
    <div className="space-y-4">
      {/* TRK-096: Outbound Caller ID — Twilio 888 */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>phone_forwarded</span>
        <span className="text-xs text-[var(--text-muted)]">Caller ID:</span>
        <span className="text-xs font-medium text-[var(--text-primary)]">{TWILIO_888_NUMBER}</span>
        <span className="ml-auto rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{TWILIO_888_LABEL}</span>
      </div>

      <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-center">
        <input
          ref={inputRef}
          type="text"
          value={number || ''}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9*#]/g, '')
            if (cleaned.length > number.length) {
              const added = cleaned.slice(number.length)
              for (const ch of added) {
                onDigit(ch)
              }
            } else if (cleaned.length < number.length) {
              const diff = number.length - cleaned.length
              for (let i = 0; i < diff; i++) {
                onDigit('DEL')
              }
            }
          }}
          placeholder="Enter number..."
          className="w-full bg-transparent text-center text-2xl font-semibold tracking-wider text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => { onDigit(key); inputRef.current?.focus() }}
            className="flex h-12 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-lg font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onStartCall}
          disabled={callState !== 'idle' || number.length < 3}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg h-12 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: callState === 'connecting' ? 'var(--warning, #f59e0b)' : 'var(--success, #10b981)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
            {callState === 'connecting' ? 'hourglass_top' : 'call'}
          </span>
          {callState === 'connecting' ? 'Connecting...' : 'Start Call'}
        </button>
        <button
          onClick={() => { onDigit('DEL'); inputRef.current?.focus() }}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>backspace</span>
        </button>
      </div>

      {/* Spacer after dialer */}
      <div className="pt-1" />
    </div>
  )
}

/* ─── Template Manager (TRK-064) ─── */

function TemplateManager({
  templates,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: {
  templates: CommsTemplate[]
  onAdd: (t: Omit<CommsTemplate, 'id'>) => void
  onEdit: (id: string, t: Omit<CommsTemplate, 'id'>) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [formLabel, setFormLabel] = useState('')
  const [formChannel, setFormChannel] = useState<'sms' | 'email' | 'both'>('both')
  const [formBody, setFormBody] = useState('')

  const resetForm = () => {
    setFormLabel('')
    setFormChannel('both')
    setFormBody('')
    setShowAdd(false)
    setEditingId(null)
  }

  const startEdit = (t: CommsTemplate) => {
    setEditingId(t.id)
    setFormLabel(t.label)
    setFormChannel(t.channel)
    setFormBody(t.body)
    setShowAdd(false)
  }

  const handleSave = () => {
    if (!formLabel.trim() || !formBody.trim()) return
    if (editingId) {
      onEdit(editingId, { label: formLabel.trim(), channel: formChannel, body: formBody.trim() })
    } else {
      onAdd({ label: formLabel.trim(), channel: formChannel, body: formBody.trim() })
    }
    resetForm()
  }

  const isEditing = showAdd || editingId !== null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          </button>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Manage Templates</h3>
        </div>
        {!isEditing && (
          <button
            onClick={() => { resetForm(); setShowAdd(true) }}
            className="flex items-center gap-1 rounded-md h-[34px] px-3 text-xs font-medium text-white transition-colors hover:brightness-110"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
            New Template
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isEditing && (
        <div className="border-b border-[var(--border-subtle)] px-4 py-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Template Name</label>
            <input
              type="text"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="e.g. Follow-Up Reminder"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Channel</label>
            <div className="flex gap-1.5">
              {(['sms', 'email', 'both'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setFormChannel(ch)}
                  className={`flex-1 rounded-md h-[34px] text-xs font-medium transition-colors ${
                    formChannel === ch
                      ? 'text-white'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                  style={formChannel === ch ? { background: 'var(--portal)' } : undefined}
                >
                  {ch === 'both' ? 'Both' : ch.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Body</label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Template body... use {{name}}, {{date}}, {{agent}} for merge fields"
              rows={4}
              className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!formLabel.trim() || !formBody.trim()}
              className="flex items-center gap-1 rounded-md h-[34px] px-4 text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check</span>
              {editingId ? 'Save Changes' : 'Add Template'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-md h-[34px] px-4 text-xs font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="flex-1 overflow-y-auto">
        {templates.length > 0 ? (
          templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{t.label}</span>
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                    {t.channel === 'both' ? 'SMS + Email' : t.channel.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{t.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(t)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  title="Edit template"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--error, #ef4444)]"
                  title="Delete template"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">description</span>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">No templates yet</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Create one to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Component ─── */

export function CommsCompose({ onBack, presetChannel, presetContact, replySubject }: CommsComposeProps) {
  const { makeCall, isReady: deviceReady, isMuted, toggleMute, hangup: deviceHangup, sendDigits } = useTwilioDevice()
  const [channel, setChannel] = useState<ComposeChannel>(presetChannel ?? 'sms')
  /* CP11: When presetContact is provided, show client name (not raw phone/email) */
  const presetDetail = presetChannel === 'email' ? presetContact?.email : presetContact?.phone
  const isPreset = !!presetContact
  const [toSearch, setToSearch] = useState(presetContact ? presetContact.name : '')
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(presetContact ?? null)
  const [clientResults, setClientResults] = useState<ClientResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState(replySubject || '')
  const [template, setTemplate] = useState('none')
  const [dialerNumber, setDialerNumber] = useState(presetContact?.phone?.replace(/[^0-9]/g, '') ?? '')
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [templates, setTemplates] = useState<CommsTemplate[]>(DEFAULT_TEMPLATES)
  const dialerInputRef = useRef<HTMLInputElement | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* TRK-095/096/097: Send/call states */
  // COMMS-V2-008: MMS attachment support for SMS tab
  const mms = useMmsUpload()

  const [smsSendState, setSmsSendState] = useState<StubSendState>('idle')
  const [emailSendState, setEmailSendState] = useState<StubSendState>('idle')
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active'>('idle')
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  /* TRK-13571: Manual call log state */
  const [showLogCall, setShowLogCall] = useState(false)
  const [logDirection, setLogDirection] = useState<'inbound' | 'outbound'>('outbound')
  const [logOutcome, setLogOutcome] = useState('connected')
  const [logNotes, setLogNotes] = useState('')
  const [logDuration, setLogDuration] = useState('')
  const [logCallState, setLogCallState] = useState<StubSendState>('idle')

  // Sync channel when presetChannel changes (tab navigation)
  useEffect(() => {
    if (presetChannel) {
      setChannel(presetChannel)
    }
  }, [presetChannel])

  // Sync presetContact when active client changes (navigated to different client)
  useEffect(() => {
    if (presetContact) {
      setSelectedClient(presetContact)
      // Show name + phone/email in the To field so user sees who they're contacting
      const detail = presetChannel === 'email' ? presetContact.email : presetContact.phone
      setToSearch(detail ? `${presetContact.name} — ${detail}` : presetContact.name)
      setShowResults(false)
      // Pre-fill the dialer number for Call tab
      if (presetContact.phone) {
        setDialerNumber(presetContact.phone.replace(/[^0-9]/g, ''))
      }
    }
  }, [presetContact?.id, presetChannel])

  // Debounced client search via API
  useEffect(() => {
    if (!toSearch || toSearch.length < 2 || selectedClient) {
      setClientResults([])
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetchValidated(`/api/clients?q=${encodeURIComponent(toSearch)}&limit=10`)
        if (res.success) {
              if (res.success && res.data) {
            setClientResults((Array.isArray(res.data) ? res.data : []).map((c) => ({
              id: String(c.id || c.client_id || ''),
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              phone: String(c.phone || c.mobile_phone || ''),
              email: String(c.email || ''),
              book: String(c.book || c.source || ''),
            })))
          }
        }
      } catch {
        // Search failed silently — user can retry
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [toSearch, selectedClient])

  // TRK-069: Keyboard event handler for dialer
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (channel !== 'call') return
    // Don't capture if user is typing in a text field other than the dialer
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Allow only from the dialer input
      if (!target.classList.contains('dialer-input-field')) return
    }
    const validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#']
    if (validKeys.includes(e.key)) {
      e.preventDefault()
      setDialerNumber((prev) => prev + e.key)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setDialerNumber((prev) => prev.slice(0, -1))
    }
  }, [channel])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const selectClient = (client: ClientResult) => {
    setSelectedClient(client)
    setToSearch(client.name)
    setShowResults(false)
    setClientResults([])
  }

  const handleDialerDigit = (d: string) => {
    if (d === 'DEL') {
      setDialerNumber((prev) => prev.slice(0, -1))
    } else {
      setDialerNumber((prev) => prev + d)
    }
  }

  // TRK-064: Template CRUD handlers
  const handleAddTemplate = (t: Omit<CommsTemplate, 'id'>) => {
    const newId = `custom-${Date.now()}`
    setTemplates((prev) => [...prev, { ...t, id: newId }])
  }

  const handleEditTemplate = (id: string, t: Omit<CommsTemplate, 'id'>) => {
    setTemplates((prev) => prev.map((tmpl) => tmpl.id === id ? { ...tmpl, ...t } : tmpl))
  }

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== id))
    if (template === id) setTemplate('none')
  }

  /* TRK-13568: Send SMS via Twilio API */
  const handleSmsSend = useCallback(async () => {
    if (!selectedClient?.phone || !message.trim()) return
    setSmsSendState('sending')
    setSendError(null)
    try {
      // COMMS-V2-008: Upload MMS attachment if present
      let mediaUrl: string | undefined
      if (mms.file && selectedClient.id) {
        mediaUrl = (await mms.upload(selectedClient.id)) || undefined
      }
      const res = await fetchValidated('/api/comms/send-sms', {
        method: 'POST',
        body: JSON.stringify({
          to: selectedClient.phone.replace(/[^0-9+]/g, ''),
          body: message.trim(),
          client_id: selectedClient.id,
          ...(mediaUrl ? { mediaUrl } : {}),
        }),
      })
      if (!res.success) throw new Error(res.error || 'SMS send failed')
      setSmsSendState('sent')
      mms.clear()
      setTimeout(() => { setSmsSendState('idle'); setMessage('') }, 2000)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'SMS send failed')
      setSmsSendState('idle')
    }
  }, [selectedClient, message])

  /* TRK-13569: Send email via SendGrid API */
  const handleEmailSend = useCallback(async () => {
    if (!selectedClient?.email || !message.trim()) return
    setEmailSendState('sending')
    setSendError(null)
    try {
      const res = await fetchValidated('/api/comms/send-email', {
        method: 'POST',
        body: JSON.stringify({
          to: selectedClient.email,
          subject: subject.trim() || 'No Subject',
          html: message.trim(),
          client_id: selectedClient.id,
        }),
      })
      if (!res.success) throw new Error(res.error || 'Email send failed')
      setEmailSendState('sent')
      setTimeout(() => { setEmailSendState('idle'); setMessage(''); setSubject('') }, 2000)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Email send failed')
      setEmailSendState('idle')
    }
  }, [selectedClient, message, subject])

  /* TRK-13663: Initiate voice call via Twilio Device SDK (replaces REST send-voice) */
  const handleStartCall = useCallback(async () => {
    if (callState !== 'idle' || dialerNumber.length < 3) return
    if (!deviceReady) {
      setSendError('Voice not ready — please wait a moment and try again')
      return
    }
    setCallState('connecting')
    setSendError(null)
    try {
      const to = dialerNumber.replace(/[^0-9+]/g, '')
      const toE164 = to.startsWith('+') ? to : `+1${to}`

      const call = await makeCall(toE164)
      if (!call) throw new Error('Call initiation failed')

      // 'accept' fires when Twilio connects the call
      call.on('accept', () => {
        setCallState('active')
        setActiveCall({
          callId: call.parameters?.CallSid || `call-${Date.now()}`,
          callerName: selectedClient?.name ?? 'Unknown',
          callerPhone: dialerNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'),
          callerLabel: selectedClient?.book,
        })
      })

      // 'disconnect' fires when call ends (either side)
      call.on('disconnect', () => {
        setCallState('idle')
        setActiveCall(null)
      })

      // 'error' fires if the call fails to connect
      call.on('error', (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Call error'
        setSendError(msg)
        setCallState('idle')
        setActiveCall(null)
      })
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Call failed')
      setCallState('idle')
    }
  }, [callState, dialerNumber, selectedClient, deviceReady, makeCall])

  const handleEndCall = useCallback(() => {
    deviceHangup()
    setActiveCall(null)
    setCallState('idle')
    setDialerNumber('')
  }, [deviceHangup])

  /* TRK-13571: Manual call log */
  const handleLogCall = useCallback(async () => {
    if (!selectedClient?.id) return
    setLogCallState('sending')
    setSendError(null)
    try {
      const res = await fetchValidated('/api/comms/log-call', {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClient.id,
          direction: logDirection,
          outcome: logOutcome,
          notes: logNotes.trim(),
          duration: logDuration ? Number(logDuration) : null,
          recipient: selectedClient.phone?.replace(/[^0-9+]/g, '') || null,
        }),
      })
      if (!res.success) throw new Error(res.error || 'Call log failed')
      setLogCallState('sent')
      setTimeout(() => {
        setLogCallState('idle')
        setLogNotes('')
        setLogDuration('')
        setShowLogCall(false)
      }, 1500)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Call log failed')
      setLogCallState('idle')
    }
  }, [selectedClient, logDirection, logOutcome, logNotes, logDuration])

  // Filter templates by current channel for the dropdown
  const availableTemplates = templates.filter((t) => {
    if (channel === 'call') return false
    return t.channel === 'both' || t.channel === channel
  })

  // Determine if channel switcher should be shown (hidden when preset from tabs)
  const showChannelSwitcher = !presetChannel

  // Template Manager view
  if (showTemplateManager) {
    return (
      <TemplateManager
        templates={templates}
        onAdd={handleAddTemplate}
        onEdit={handleEditTemplate}
        onDelete={handleDeleteTemplate}
        onClose={() => setShowTemplateManager(false)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {channel === 'sms' ? 'New Text' : channel === 'email' ? 'New Email' : 'New Call'}
        </h3>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* To field */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">To</label>
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '16px' }}>search</span>
            <input
              type="text"
              value={toSearch}
              onChange={(e) => { setToSearch(e.target.value); setShowResults(true); setSelectedClient(null) }}
              onFocus={() => setShowResults(true)}
              placeholder="Search client or enter number/email..."
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
            {showResults && toSearch.length >= 2 && !selectedClient && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-lg">
                {searchLoading ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Searching...</div>
                ) : clientResults.length > 0 ? (
                  clientResults.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => selectClient(client)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-surface)]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'var(--portal)' }}>
                        {client.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{client.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{client.phone} &middot; {client.email}</p>
                      </div>
                      {client.book && (
                        <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{client.book}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No clients found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Channel toggle (only if no preset) */}
        {showChannelSwitcher && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Channel</label>
            <div className="flex gap-1.5">
              {([
                { key: 'sms' as const, label: 'SMS', icon: 'sms' },
                { key: 'email' as const, label: 'Email', icon: 'email' },
                { key: 'call' as const, label: 'Call', icon: 'phone' },
              ]).map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => setChannel(ch.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium transition-colors ${
                    channel === ch.key
                      ? 'text-white'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                  style={channel === ch.key ? { background: 'var(--portal)' } : undefined}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{ch.icon}</span>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SMS mode — TRK-095: Twilio stub */}
        {channel === 'sms' && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={6}
                className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <span>{message.length} / 160 characters</span>
                  {message.length > 160 && <span className="text-[#f59e0b]">{Math.ceil(message.length / 160)} segments</span>}
                </div>
                {/* COMMS-V2-008: MMS attach button */}
                <label className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]">
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>attach_file</span>
                  <span className="text-[10px]">Attach</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      if (f) {
                        const err = mms.selectFile(f)
                        if (err) setSendError(err)
                      }
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {/* MMS attachment preview */}
              {mms.file && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                  {mms.preview ? (
                    <img src={mms.preview} alt="Preview" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>picture_as_pdf</span>
                  )}
                  <span className="flex-1 truncate text-xs text-[var(--text-primary)]">{mms.file.name}</span>
                  <button onClick={() => mms.clear()} className="text-[var(--text-muted)] hover:text-[var(--error,#ef4444)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">From</label>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] h-[38px] px-3">
                <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>phone</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{TWILIO_888_NUMBER}</span>
                <span className="ml-auto rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{TWILIO_888_LABEL}</span>
              </div>
            </div>
          </>
        )}

        {/* Email mode — TRK-097: Gmail API stub */}
        {channel === 'email' && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose your email..."
                rows={8}
                className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">From</label>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] h-[38px] px-3">
                <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>email</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">you@retireprotected.com</span>
                <span className="ml-auto rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">Workspace</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-[10px] text-[var(--text-muted)]">RPI Email</span>
              </div>
            </div>
          </>
        )}

        {/* Call mode — TRK-13570: Twilio voice + TRK-13571: Manual log */}
        {channel === 'call' && (
          <>
            {!showLogCall ? (
              <>
                <DialerPad
                  number={dialerNumber}
                  onDigit={handleDialerDigit}
                  inputRef={dialerInputRef}
                  onStartCall={handleStartCall}
                  callState={callState}
                />
                {/* Log Call toggle */}
                <button
                  onClick={() => setShowLogCall(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] h-[38px] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)]"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit_note</span>
                  Log a Call Manually
                </button>
              </>
            ) : (
              <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Log Call</h4>
                  <button
                    onClick={() => setShowLogCall(false)}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
                  </button>
                </div>

                {/* Direction toggle */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Direction</label>
                  <div className="flex gap-1.5">
                    {(['inbound', 'outbound'] as const).map((dir) => (
                      <button
                        key={dir}
                        onClick={() => setLogDirection(dir)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium transition-colors ${
                          logDirection === dir
                            ? 'text-white'
                            : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        }`}
                        style={logDirection === dir ? { background: 'var(--portal)' } : undefined}
                      >
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                          {dir === 'inbound' ? 'call_received' : 'call_made'}
                        </span>
                        {dir === 'inbound' ? 'Inbound' : 'Outbound'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outcome select */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Outcome</label>
                  <select
                    value={logOutcome}
                    onChange={(e) => setLogOutcome(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] h-[38px] px-3 text-sm text-[var(--text-primary)] outline-none"
                  >
                    <option value="connected">Connected</option>
                    <option value="voicemail">Voicemail</option>
                    <option value="no_answer">No Answer</option>
                    <option value="busy">Busy</option>
                    <option value="wrong_number">Wrong Number</option>
                    <option value="left_message">Left Message</option>
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Duration (seconds)</label>
                  <input
                    type="number"
                    value={logDuration}
                    onChange={(e) => setLogDuration(e.target.value)}
                    placeholder="e.g. 120"
                    min="0"
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-2 px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
                  <textarea
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="Call notes..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleLogCall}
                  disabled={logCallState !== 'idle' || !selectedClient?.id}
                  className="flex w-full items-center justify-center gap-2 rounded-lg h-[40px] text-sm font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: logCallState === 'sent'
                      ? 'var(--success, #10b981)'
                      : logCallState === 'sending'
                        ? 'var(--warning, #f59e0b)'
                        : 'var(--portal)',
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                    {logCallState === 'sent' ? 'check_circle' : logCallState === 'sending' ? 'hourglass_top' : 'save'}
                  </span>
                  {logCallState === 'sent' ? 'Call Logged' : logCallState === 'sending' ? 'Saving...' : 'Log Call'}
                </button>
                {!selectedClient?.id && (
                  <p className="text-center text-xs text-[var(--text-muted)]">Select a client above to log a call</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Template with Manage button (SMS/Email only — TRK-064, TRK-416) */}
        {channel !== 'call' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)]">Template</label>
              <button
                onClick={() => setShowTemplateManager(true)}
                className="flex items-center gap-1 rounded-full border border-[var(--portal)] px-3 py-1 text-sm font-medium text-[var(--portal)] transition-colors hover:brightness-110"
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>settings</span>
                Manage Templates ({availableTemplates.length})
              </button>
            </div>
            <select
              value={template}
              onChange={(e) => {
                const id = e.target.value
                setTemplate(id)
                if (id !== 'none') {
                  const t = templates.find(tmpl => tmpl.id === id)
                  if (t) {
                    let body = t.body
                    if (selectedClient) {
                      body = body.replace(/\{\{name\}\}/g, selectedClient.name || '')
                      body = body.replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
                    }
                    setMessage(body)
                  }
                }
              }}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] h-[38px] px-3 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="none">None - Custom Message</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Send error banner */}
      {sendError && (
        <div className="flex items-center gap-2 border-t border-[var(--error,#ef4444)] bg-[rgba(239,68,68,0.08)] px-4 py-2">
          <span className="material-icons-outlined text-[var(--error,#ef4444)]" style={{ fontSize: '16px' }}>error</span>
          <span className="flex-1 text-xs text-[var(--error,#ef4444)]">{sendError}</span>
          <button onClick={() => setSendError(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Dismiss</button>
        </div>
      )}

      {/* Hint: why send is disabled (no contact info on file) */}
      {channel === 'email' && selectedClient && !selectedClient.email && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-[var(--text-muted)]">
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>info</span>
          No email on file for {selectedClient.name}. Add their email in the contact record first.
        </div>
      )}
      {channel === 'sms' && selectedClient && !selectedClient.phone && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-[var(--text-muted)]">
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>info</span>
          No phone number on file for {selectedClient.name}.
        </div>
      )}

      {/* Send button — TRK-13568/13569: Twilio SMS / SendGrid Email */}
      {channel !== 'call' && (
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          {channel === 'sms' ? (
            <button
              onClick={handleSmsSend}
              disabled={smsSendState !== 'idle' || !selectedClient?.phone || !message.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg h-[40px] text-sm font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: smsSendState === 'sent'
                  ? 'var(--success, #10b981)'
                  : smsSendState === 'sending'
                    ? 'var(--warning, #f59e0b)'
                    : 'var(--portal)',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                {smsSendState === 'sent' ? 'check_circle' : smsSendState === 'sending' ? 'hourglass_top' : 'send'}
              </span>
              {smsSendState === 'sent' ? 'Sent' : smsSendState === 'sending' ? 'Sending...' : 'Send'}
            </button>
          ) : (
            <button
              onClick={handleEmailSend}
              disabled={emailSendState !== 'idle' || !selectedClient?.email || !message.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg h-[40px] text-sm font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: emailSendState === 'sent'
                  ? 'var(--success, #10b981)'
                  : emailSendState === 'sending'
                    ? 'var(--warning, #f59e0b)'
                    : 'var(--portal)',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                {emailSendState === 'sent' ? 'check_circle' : emailSendState === 'sending' ? 'hourglass_top' : 'send'}
              </span>
              {emailSendState === 'sent' ? 'Sent' : emailSendState === 'sending' ? 'Sending...' : 'Send'}
            </button>
          )}
        </div>
      )}

      {/* TRK-13570: Active Call Screen overlay */}
      {activeCall && (
        <ActiveCallScreen
          call={activeCall}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onEndCall={handleEndCall}
          onSendDigits={sendDigits}
        />
      )}
    </div>
  )
}
