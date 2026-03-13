'use client'

import { useState } from 'react'
import type { Client } from '@tomachina/core'
import { getAge, getInitials, hashColor } from '../lib/formatters'
import { AccessButton } from './AccessButton'

interface ClientHeaderProps {
  client: Client
  clientId: string
}

export function ClientHeader({ client, clientId }: ClientHeaderProps) {
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown'
  const displayName = (client.preferred_name as string) || client.first_name || fullName
  const status = (client.client_status as string) || 'Unknown'
  const initials = getInitials(fullName)
  const avatarColor = hashColor(fullName)
  const facebookUrl = client.facebook_url as string | undefined

  // Meta
  const age = getAge(client.dob)
  const location = [client.city, client.state].filter(Boolean).join(', ')
  const timezone = client.timezone as string | undefined
  const acfLink = client.acf_link as string | undefined

  const [ai3Loading, setAi3Loading] = useState(false)

  const handleAI3 = () => {
    setAi3Loading(true)
    // Placeholder: will trigger PDF_SERVICE generation
    setTimeout(() => setAi3Loading(false), 2000)
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      {/* Row 1: Avatar + Name + Status + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Avatar — Facebook pic or initials */}
          {facebookUrl ? (
            <img
              src={facebookUrl}
              alt={fullName}
              className="h-14 w-14 shrink-0 rounded-full object-cover"
              onError={(e) => {
                // Fallback to initials on image error
                const el = e.currentTarget
                el.style.display = 'none'
                el.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${facebookUrl ? 'hidden' : ''}`}
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>

          {/* Name block */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{displayName}</h1>
              <StatusBadge status={status} />
            </div>
            {displayName !== fullName && (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{fullName}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* ACF Button */}
          <button
            onClick={() => {
              if (acfLink) window.open(acfLink, '_blank', 'noopener,noreferrer')
            }}
            disabled={!acfLink}
            className={`inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium transition-all ${
              acfLink
                ? 'bg-[var(--portal)]/15 text-[var(--portal)] hover:bg-[var(--portal)]/25 border border-[var(--portal)]/30'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed opacity-50 border border-[var(--border)]'
            }`}
            title={acfLink ? 'Open Active Client File in Google Drive' : 'No ACF link on file'}
          >
            <span className="material-icons-outlined text-[18px]">folder_open</span>
            ACF
          </button>

          {/* Access Button */}
          <AccessButton clientId={clientId} />

          {/* AI3 Button */}
          <button
            onClick={handleAI3}
            disabled={ai3Loading}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--portal)] px-4 py-1.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
            title="Generate AI3 Report (Assets, Income, Insurance, Inventory)"
          >
            {ai3Loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[18px]">description</span>
            )}
            AI3
          </button>
        </div>
      </div>

      {/* Row 2: Meta chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {age != null && (
          <MetaChip icon="cake" label={`${age} yrs`} />
        )}
        {location && (
          <MetaChip icon="location_on" label={location} />
        )}
        {timezone && (
          <MetaChip icon="schedule" label={String(timezone)} />
        )}
      </div>
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
  } else if (s === 'deceased') {
    colorClass = 'bg-gray-500/15 text-gray-400'
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Meta Chip
// ---------------------------------------------------------------------------

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-medium)] px-3 py-1 text-xs text-[var(--text-secondary)]">
      <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">{icon}</span>
      {label}
    </span>
  )
}
