'use client'

import { useEffect, useRef } from 'react'
import { AccountTypePills } from './AccountTypePills'
import { StatusBadge } from './StatusBadge'

// ---------------------------------------------------------------------------
// CCX-010: Client Quick-View Hover Card
// ---------------------------------------------------------------------------

interface ClientHoverCardProps {
  client: Record<string, unknown>
  anchorEl: HTMLElement | null
  onClose: () => void
}

function formatPhoneDisplay(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length !== 10) return raw || ''
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function cleanNameDisplay(name: string): string {
  return (name || '').replace(/["']/g, '').replace(/\s+/g, ' ').trim()
}

export function ClientHoverCard({ client, anchorEl, onClose }: ClientHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const firstName = cleanNameDisplay(String(client.preferred_name || client.first_name || ''))
  const lastName = cleanNameDisplay(String(client.last_name || ''))
  const fullName = `${firstName} ${lastName}`.trim()
  const phone = String(client.phone || '')
  const email = String(client.email || '')
  const status = String(client.status || '')
  const accountTypes = (client.account_type_categories as string[]) || []
  const lastActivity = client.last_activity_at
    ? new Date(String(client.last_activity_at)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const clientId = String(client._id || client.client_id || '')

  // Position card below anchor using fixed positioning
  const anchorRect = anchorEl?.getBoundingClientRect()
  const top = anchorRect ? anchorRect.bottom + 6 : 0
  const left = anchorRect ? anchorRect.left : 0

  // Close on outside click
  useEffect(() => {
    function handleMousedown(e: MouseEvent) {
      if (
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMousedown)
    return () => document.removeEventListener('mousedown', handleMousedown)
  }, [onClose, anchorEl])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const dispatchCommsAction = (action: 'call' | 'sms' | 'email') => {
    window.dispatchEvent(new CustomEvent('comms-action', {
      detail: { action, clientId, phone, email, name: fullName }
    }))
    onClose()
  }

  if (!anchorEl) return null

  return (
    <div
      ref={cardRef}
      className="fixed z-[999] w-72 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl"
      style={{
        top,
        left,
        boxShadow: 'var(--shadow-dropdown, 0 8px 32px rgba(0,0,0,.18))',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--text-primary)]">{fullName || 'Unknown'}</p>
          {status && (
            <div className="mt-1">
              <StatusBadge status={status} />
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label="Close"
        >
          <span className="material-icons-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Contact details */}
      <div className="space-y-2 px-4 py-3">
        {phone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">phone</span>
            <span className="text-[var(--text-secondary)]">{formatPhoneDisplay(phone)}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2 text-sm">
            <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">email</span>
            <a
              href={`mailto:${email}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[var(--portal)] hover:underline"
            >
              {email}
            </a>
          </div>
        )}
        {accountTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">account_balance_wallet</span>
            <AccountTypePills accountTypes={accountTypes} />
          </div>
        )}
        {lastActivity && (
          <div className="flex items-center gap-2 text-sm">
            <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">schedule</span>
            <span className="text-xs text-[var(--text-muted)]">Last activity: {lastActivity}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
        {phone && (
          <button
            onClick={() => dispatchCommsAction('call')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
            title="Call"
          >
            <span className="material-icons-outlined text-[15px]">call</span>
            Call
          </button>
        )}
        {phone && (
          <button
            onClick={() => dispatchCommsAction('sms')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
            title="Text"
          >
            <span className="material-icons-outlined text-[15px]">sms</span>
            Text
          </button>
        )}
        {email && (
          <button
            onClick={() => dispatchCommsAction('email')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
            title="Email"
          >
            <span className="material-icons-outlined text-[15px]">mail_outline</span>
            Email
          </button>
        )}
        <a
          href={`/contacts/${clientId}`}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          title="Open profile"
        >
          <span className="material-icons-outlined text-[15px]">open_in_new</span>
          View
        </a>
      </div>
    </div>
  )
}
