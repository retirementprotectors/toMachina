'use client'

import { useState } from 'react'
import { AccessStatusBadge } from './AccessStatusBadge'

type AccessStatus = 'connected' | 'pending' | 'expired' | 'not_started'
type AuthorizationStatus = 'not_started' | 'sent' | 'on_file'

interface ApiAccessItem {
  access_id: string
  client_id: string
  service_name: string
  subcategory?: string
  category: string
  status: AccessStatus
  authorization_status?: AuthorizationStatus
  last_verified?: string
  notes?: string
}

interface ApiAccessTableProps {
  items: ApiAccessItem[]
  onVerify: (accessId: string) => void
}

function formatDate(raw: string | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SERVICE_ICONS: Record<string, string> = {
  'cms.gov': 'health_and_safety',
  'ssa.gov': 'account_balance',
  'State Insurance Commissioner': 'gavel',
  'default': 'public',
}

const AUTH_STATUS_CONFIG: Record<AuthorizationStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  sent: { label: 'Sent', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  on_file: { label: 'On File', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
}

export function ApiAccessTable({ items, onVerify }: ApiAccessTableProps) {
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
            const authStatus = item.authorization_status ?? 'not_started'
            const authConfig = AUTH_STATUS_CONFIG[authStatus]
            const isVerified = authStatus === 'on_file' || item.status === 'connected'

            return (
              <tr key={item.access_id} className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-icons-outlined text-[20px] text-[var(--text-muted)]">{icon}</span>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{item.service_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.subcategory || item.category}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AccessStatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${authConfig.bg} ${authConfig.text}`}>
                    {authConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {formatDate(item.last_verified)}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)] max-w-[200px] truncate">
                  {item.notes || '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleVerify(item.access_id)}
                    disabled={isVerifying}
                    className={`inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium border transition-all disabled:opacity-50 ${
                      isVerified
                        ? 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
                    }`}
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
