'use client'

import { useState } from 'react'
import { AccessStatusBadge } from './AccessStatusBadge'

type AccessStatus = 'active' | 'connected' | 'pending' | 'expired' | 'not_started'
type AuthStatus = 'none' | 'sent' | 'on_file'

interface ApiAccessItem {
  access_id: string
  client_id: string
  service_name: string
  category: string
  status: AccessStatus
  auth_status?: AuthStatus
  last_verified?: string
  notes?: string
}

interface ApiAccessTableProps {
  items: ApiAccessItem[]
  onVerify: (accessId: string) => void
  onAuthCycle?: (accessId: string, newStatus: AuthStatus) => void
}

function formatDate(raw: string | undefined): string {
  if (!raw) return '\u2014'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SERVICE_ICONS: Record<string, string> = {
  'cms.gov': 'health_and_safety',
  'Medicare.gov': 'health_and_safety',
  'ssa.gov': 'account_balance',
  'Social Security': 'account_balance',
  'IRS.gov': 'account_balance',
  'State Insurance Commissioner': 'gavel',
  'default': 'public',
}

// Display name overrides: normalize legacy service names to current branding
const DISPLAY_NAMES: Record<string, { name: string; sub?: string }> = {
  'Medicare.gov': { name: 'cms.gov', sub: 'Original Medicare' },
  'Social Security': { name: 'ssa.gov', sub: 'Social Security' },
  'Social Security / SSA.gov': { name: 'ssa.gov', sub: 'Social Security' },
}

const AUTH_CONFIG: Record<AuthStatus, { label: string; bg: string; text: string }> = {
  none: { label: 'None', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  sent: { label: 'Sent', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  on_file: { label: 'On File', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
}

const AUTH_CYCLE: Record<AuthStatus, AuthStatus> = {
  none: 'sent',
  sent: 'on_file',
  on_file: 'none',
}

export function ApiAccessTable({ items, onVerify, onAuthCycle }: ApiAccessTableProps) {
  const [verifying, setVerifying] = useState<string | null>(null)

  const handleVerify = async (accessId: string) => {
    setVerifying(accessId)
    try {
      await onVerify(accessId)
    } finally {
      setVerifying(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">api</span>
        <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No API integrations configured</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">API access tracking will appear here</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-surface)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Service</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Authorization</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Last Verified</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Notes</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const icon = SERVICE_ICONS[item.service_name] ?? SERVICE_ICONS.default
            const isVerifying = verifying === item.access_id
            const authStatus: AuthStatus = item.auth_status || 'none'
            const authConfig = AUTH_CONFIG[authStatus]
            const display = DISPLAY_NAMES[item.service_name]
            const displayName = display?.name || item.service_name
            const displaySub = display?.sub || item.category

            return (
              <tr key={item.access_id} className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-icons-outlined text-[20px] text-[var(--text-muted)]">{icon}</span>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{displayName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{displaySub}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AccessStatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onAuthCycle?.(item.access_id, AUTH_CYCLE[authStatus])}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${authConfig.bg} ${authConfig.text}`}
                    title={`Click to cycle: ${authStatus} \u2192 ${AUTH_CYCLE[authStatus]}`}
                  >
                    {authConfig.label}
                  </button>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {formatDate(item.last_verified)}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)] max-w-[200px] truncate">
                  {item.notes || '\u2014'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleVerify(item.access_id)}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:text-[var(--portal)] disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                    ) : (
                      <span className="material-icons-outlined text-[14px]">verified</span>
                    )}
                    Verify
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
