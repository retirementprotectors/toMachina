'use client'

import { useState } from 'react'

/* ─── Types ─── */

type ComposeChannel = 'sms' | 'email' | 'call'

interface CommsComposeProps {
  onBack: () => void
}

/* ─── Mock Templates ─── */

const MOCK_TEMPLATES = [
  { id: 'none', label: 'None - Custom Message' },
  { id: 'appt-reminder', label: 'Appointment Reminder' },
  { id: 'aep-enrollment', label: 'AEP Enrollment Follow-Up' },
  { id: 'rmd-notification', label: 'RMD Notification' },
  { id: 'welcome', label: 'New Client Welcome' },
  { id: 'birthday', label: 'Birthday Greeting' },
  { id: 'policy-review', label: 'Annual Policy Review' },
]

/* ─── Mock Search Results ─── */

const MOCK_CLIENTS = [
  { id: '1', name: 'John Smith', phone: '(515) 555-1234', email: 'jsmith@email.com', book: 'RPI' },
  { id: '2', name: 'Jane Doe', phone: '(515) 555-5678', email: 'jane.doe@email.com', book: 'Sprenger' },
  { id: '3', name: 'Robert Johnson', phone: '(515) 555-9012', email: 'robert.j@email.com', book: 'RPI' },
  { id: '4', name: 'Mary Williams', phone: '(515) 555-3456', email: 'mwilliams@yahoo.com', book: 'McCormick' },
  { id: '5', name: 'David Chen', phone: '(515) 555-7890', email: 'd.chen@gmail.com', book: 'Gradient' },
]

/* ─── Dialer Key Pad ─── */

function DialerPad({ number, onDigit }: { number: string; onDigit: (d: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-center">
        <p className="text-2xl font-semibold tracking-wider text-[var(--text-primary)]">
          {number || 'Enter number...'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <button
            key={key}
            onClick={() => onDigit(key)}
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
          onClick={() => onDigit('DEL')}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>backspace</span>
        </button>
      </div>
    </div>
  )
}

/* ─── Component ─── */

export function CommsCompose({ onBack }: CommsComposeProps) {
  const [channel, setChannel] = useState<ComposeChannel>('sms')
  const [toSearch, setToSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<typeof MOCK_CLIENTS[0] | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [template, setTemplate] = useState('none')
  const [dialerNumber, setDialerNumber] = useState('')

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

  const channels: Array<{ key: ComposeChannel; label: string; icon: string }> = [
    { key: 'sms', label: 'SMS', icon: 'sms' },
    { key: 'email', label: 'Email', icon: 'email' },
    { key: 'call', label: 'Call', icon: 'phone' },
  ]

  // Suppress unused var warnings for mock state
  void selectedClient
  void template
  void subject

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
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">New Message</h3>
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

        {/* Channel toggle */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Channel</label>
          <div className="flex gap-1.5">
            {channels.map((ch) => (
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
          <DialerPad number={dialerNumber} onDigit={handleDialerDigit} />
        )}

        {/* Template (SMS/Email only) */}
        {channel !== 'call' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] h-[38px] px-3 text-sm text-[var(--text-primary)] outline-none"
            >
              {MOCK_TEMPLATES.map((t) => (
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
