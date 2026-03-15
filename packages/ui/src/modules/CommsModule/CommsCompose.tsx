'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/* ─── Types ─── */

type ComposeChannel = 'sms' | 'email' | 'call'

interface CommsComposeProps {
  onBack: () => void
  /** When set, locks the channel to this value (from tab navigation) */
  presetChannel?: ComposeChannel
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

/* ─── Mock Search Results ─── */

const MOCK_CLIENTS = [
  { id: '1', name: 'John Smith', phone: '(515) 555-1234', email: 'jsmith@email.com', book: 'RPI' },
  { id: '2', name: 'Jane Doe', phone: '(515) 555-5678', email: 'jane.doe@email.com', book: 'Sprenger' },
  { id: '3', name: 'Robert Johnson', phone: '(515) 555-9012', email: 'robert.j@email.com', book: 'RPI' },
  { id: '4', name: 'Mary Williams', phone: '(515) 555-3456', email: 'mwilliams@yahoo.com', book: 'McCormick' },
  { id: '5', name: 'David Chen', phone: '(515) 555-7890', email: 'd.chen@gmail.com', book: 'Gradient' },
]

/* ─── Dialer Key Pad (TRK-069: keyboard input) ─── */

function DialerPad({ number, onDigit, inputRef }: { number: string; onDigit: (d: string) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-center">
        <input
          ref={inputRef}
          type="text"
          value={number || ''}
          onChange={(e) => {
            // Only allow valid dialer characters
            const cleaned = e.target.value.replace(/[^0-9*#]/g, '')
            // Calculate what was added
            if (cleaned.length > number.length) {
              const added = cleaned.slice(number.length)
              for (const ch of added) {
                onDigit(ch)
              }
            } else if (cleaned.length < number.length) {
              // Characters were removed — set via DEL signals
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
          className="flex flex-1 items-center justify-center gap-2 rounded-lg h-12 text-sm font-medium text-white transition-colors hover:brightness-110"
          style={{ background: 'var(--success, #10b981)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>call</span>
          Start Call
        </button>
        <button
          onClick={() => { onDigit('DEL'); inputRef.current?.focus() }}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>backspace</span>
        </button>
      </div>
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

export function CommsCompose({ onBack, presetChannel }: CommsComposeProps) {
  const [channel, setChannel] = useState<ComposeChannel>(presetChannel ?? 'sms')
  const [toSearch, setToSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<typeof MOCK_CLIENTS[0] | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [template, setTemplate] = useState('none')
  const [dialerNumber, setDialerNumber] = useState('')
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [templates, setTemplates] = useState<CommsTemplate[]>(DEFAULT_TEMPLATES)
  const dialerInputRef = useRef<HTMLInputElement | null>(null)

  // Sync channel when presetChannel changes (tab navigation)
  useEffect(() => {
    if (presetChannel) {
      setChannel(presetChannel)
    }
  }, [presetChannel])

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

  const filteredClients = MOCK_CLIENTS.filter((c) =>
    c.name.toLowerCase().includes(toSearch.toLowerCase()) ||
    c.phone.includes(toSearch) ||
    c.email.toLowerCase().includes(toSearch.toLowerCase())
  )

  const selectClient = (client: typeof MOCK_CLIENTS[0]) => {
    setSelectedClient(client)
    setToSearch(client.name)
    setShowResults(false)
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

  // Filter templates by current channel for the dropdown
  const availableTemplates = templates.filter((t) => {
    if (channel === 'call') return false
    return t.channel === 'both' || t.channel === channel
  })

  // Determine if channel switcher should be shown (hidden when preset from tabs)
  const showChannelSwitcher = !presetChannel

  // Suppress unused var warnings for mock state
  void selectedClient

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
            {showResults && toSearch.length > 0 && !selectedClient && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-lg">
                {filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
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
                      <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{client.book}</span>
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

        {/* SMS mode */}
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
              <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
                <span>{message.length} / 160 characters</span>
                {message.length > 160 && <span className="text-[#f59e0b]">{Math.ceil(message.length / 160)} segments</span>}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">From</label>
              <select className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] h-[38px] px-3 text-sm text-[var(--text-primary)] outline-none">
                <option>+1 (888) 620-8587 (RPI Toll-Free)</option>
                <option>+1 (515) 500-2308 (RPI Local)</option>
              </select>
            </div>
          </>
        )}

        {/* Email mode */}
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
              <select className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] h-[38px] px-3 text-sm text-[var(--text-primary)] outline-none">
                <option>josh@retireprotected.com</option>
                <option>vince@retireprotected.com</option>
                <option>nikki@retireprotected.com</option>
              </select>
            </div>
          </>
        )}

        {/* Call mode */}
        {channel === 'call' && (
          <DialerPad number={dialerNumber} onDigit={handleDialerDigit} inputRef={dialerInputRef} />
        )}

        {/* Template with Manage button (SMS/Email only — TRK-064) */}
        {channel !== 'call' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)]">Template</label>
              <button
                onClick={() => setShowTemplateManager(true)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--portal)] transition-colors hover:brightness-110"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>settings</span>
                Manage Templates
              </button>
            </div>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
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

      {/* Send button (SMS/Email only) */}
      {channel !== 'call' && (
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg h-[42px] text-sm font-medium text-white transition-colors hover:brightness-110"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>send</span>
            {channel === 'sms' ? 'Send SMS' : 'Send Email'}
          </button>
        </div>
      )}
    </div>
  )
}
