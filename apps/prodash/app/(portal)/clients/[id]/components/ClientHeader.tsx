'use client'

import type { Client } from '@tomachina/core'
import { formatPhone, getAge, getInitials, hashColor } from '../lib/formatters'

interface ClientHeaderProps {
  client: Client
}

export function ClientHeader({ client }: ClientHeaderProps) {
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown'
  const preferred = client.preferred_name as string | undefined
  const status = (client.client_status as string) || 'Unknown'
  const initials = getInitials(fullName)
  const avatarColor = hashColor(fullName)

  // Meta chips
  const age = getAge(client.dob)
  const location = [client.city, client.state].filter(Boolean).join(', ')
  const book = client.book_of_business as string | undefined
  const timezone = client.timezone as string | undefined

  const metaChips: { label: string; icon: string }[] = []
  if (age) metaChips.push({ label: `${age} yrs`, icon: 'cake' })
  if (location) metaChips.push({ label: location, icon: 'location_on' })
  if (book) metaChips.push({ label: book, icon: 'menu_book' })
  if (timezone) metaChips.push({ label: timezone, icon: 'schedule' })

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      {/* Row 1: Avatar + Name + Status + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>

          {/* Name + subtitle */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{fullName}</h1>
              <StatusBadge status={status} />
            </div>
            {preferred && preferred !== client.first_name && (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                Goes by &ldquo;{preferred}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <QuickAction
            icon="phone"
            label="Call"
            href={client.phone ? `tel:${client.phone}` : undefined}
          />
          <QuickAction
            icon="email"
            label="Email"
            href={client.email ? `mailto:${client.email}` : undefined}
          />
          <QuickAction icon="edit" label="Edit" variant="outlined" />
        </div>
      </div>

      {/* Row 2: Meta chips */}
      {metaChips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {metaChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-medium)] px-3 py-1 text-xs text-[var(--text-secondary)]"
            >
              <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">
                {chip.icon}
              </span>
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let colorClass = 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
  if (s === 'active' || s === 'client') {
    colorClass = 'bg-emerald-500/15 text-emerald-400'
  } else if (s === 'prospect' || s === 'lead') {
    colorClass = 'bg-blue-500/15 text-blue-400'
  } else if (s === 'inactive' || s === 'lost') {
    colorClass = 'bg-red-500/15 text-red-400'
  } else if (s === 'pending') {
    colorClass = 'bg-amber-500/15 text-amber-400'
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Quick Action Button
// ---------------------------------------------------------------------------

function QuickAction({
  icon,
  label,
  href,
  variant = 'filled',
}: {
  icon: string
  label: string
  href?: string
  variant?: 'filled' | 'outlined'
}) {
  const base =
    'inline-flex items-center justify-center rounded-lg p-2.5 transition-all duration-150'
  const filled =
    'bg-[var(--portal)]/15 text-[var(--portal)] hover:bg-[var(--portal)]/25'
  const outlined =
    'border border-[var(--border-medium)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]'

  const className = `${base} ${variant === 'outlined' ? outlined : filled}`

  if (href) {
    return (
      <a href={href} title={label} className={className}>
        <span className="material-icons-outlined text-[20px]">{icon}</span>
      </a>
    )
  }

  return (
    <button title={label} className={className}>
      <span className="material-icons-outlined text-[20px]">{icon}</span>
    </button>
  )
}
