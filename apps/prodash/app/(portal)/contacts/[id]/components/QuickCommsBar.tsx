'use client'

import type { Client } from '@tomachina/core'

interface QuickCommsBarProps {
  client: Client
  clientId: string
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function dispatchComms(channel: string, client: Client, clientId: string) {
  const cellPhone = (client.cell_phone as string) || ''
  const primaryPhone = (client.phone as string) || ''
  const phoneType = ((client.phone_type as string) || '').toLowerCase()
  const bestPhone = cellPhone || (phoneType === 'cell' || phoneType === 'mobile' ? primaryPhone : '') || primaryPhone || (client.alt_phone as string) || ''
  window.dispatchEvent(new CustomEvent('comms-action', {
    detail: {
      channel,
      contact: {
        id: client.client_id || clientId,
        name: [client.first_name, client.last_name].filter(Boolean).join(' '),
        phone: bestPhone,
        email: (client.email as string) || '',
        book: (client.book as string) || '',
      },
    },
  }))
}

export function QuickCommsBar({ client, clientId }: QuickCommsBarProps) {
  const lastCall = (client as Record<string, unknown>).last_call_at as string | undefined
  const lastSms = (client as Record<string, unknown>).last_sms_at as string | undefined
  const lastEmail = (client as Record<string, unknown>).last_email_at as string | undefined

  const actions = [
    { channel: 'voice', icon: 'phone', label: 'Call', last: lastCall, enabled: !!(client.phone || client.cell_phone) },
    { channel: 'sms', icon: 'message', label: 'Text', last: lastSms, enabled: !!(client.phone || client.cell_phone) },
    { channel: 'email', icon: 'mail', label: 'Email', last: lastEmail, enabled: !!client.email },
  ]

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Quick Actions</span>
      <div className="mx-2 h-5 w-px bg-[var(--border-subtle)]" />
      {actions.map(a => (
        <button
          key={a.channel}
          onClick={() => dispatchComms(a.channel, client, clientId)}
          disabled={!a.enabled}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-icons-outlined text-[18px]">{a.icon}</span>
          {a.label}
          {a.last && (
            <span className="text-xs text-[var(--text-muted)]">{timeAgo(a.last)}</span>
          )}
        </button>
      ))}
    </div>
  )
}
