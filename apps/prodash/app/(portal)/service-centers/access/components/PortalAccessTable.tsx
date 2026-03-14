'use client'

import { useState } from 'react'
import { AccessStatusBadge } from './AccessStatusBadge'
import { CredentialsModal } from './CredentialsModal'

type AccessStatus = 'connected' | 'pending' | 'expired' | 'not_started'

interface PortalAccessItem {
  access_id: string
  client_id: string
  service_name: string
  category: string
  status: AccessStatus
  portal_url?: string
  username?: string
  last_verified?: string
  last_login?: string
  notes?: string
}

interface PortalAccessTableProps {
  items: PortalAccessItem[]
  onVerify: (accessId: string) => void
  onUpdateCredentials: (accessId: string, username: string, notes: string) => void
}

function formatDate(raw: string | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function maskUsername(username: string | undefined): string {
  if (!username) return '—'
  if (username.length <= 4) return '••••'
  return username.slice(0, 3) + '•'.repeat(Math.min(username.length - 3, 6))
}

const CATEGORY_ORDER = ['annuity', 'life', 'medicare', 'investment', 'government', 'other']

export function PortalAccessTable({ items, onVerify, onUpdateCredentials }: PortalAccessTableProps) {
  const [verifying, setVerifying] = useState<string | null>(null)
  const [credentialsFor, setCredentialsFor] = useState<PortalAccessItem | null>(null)

  const handleVerify = async (accessId: string) => {
    setVerifying(accessId)
    try {
      await onVerify(accessId)
    } finally {
      setVerifying(null)
    }
  }

  // Group by category
  const grouped = items.reduce<Record<string, PortalAccessItem[]>>((acc, item) => {
    const key = item.category || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">vpn_key</span>
        <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No portal access tracked</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Carrier and vendor portal access will appear here</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] capitalize">
              {cat}
            </h4>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Carrier / Product Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Last Login</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(grouped[cat] ?? []).map((item) => {
                    const isVerifying = verifying === item.access_id
                    const isVerified = item.status === 'connected'
                    return (
                      <tr key={item.access_id} className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--text-primary)]">{item.service_name}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          {maskUsername(item.username)}
                        </td>
                        <td className="px-4 py-3">
                          <AccessStatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {formatDate(item.last_login)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {/* Verify */}
                            <button
                              onClick={() => handleVerify(item.access_id)}
                              disabled={isVerifying}
                              className={`inline-flex items-center gap-1 rounded-md h-[34px] px-2.5 text-xs font-medium border transition-all disabled:opacity-50 ${
                                isVerified
                                  ? 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50'
                                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
                              }`}
                              title="Mark as verified"
                            >
                              {isVerifying ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                              ) : (
                                <span className="material-icons-outlined text-[14px]">verified</span>
                              )}
                              Verify
                            </button>

                            {/* Open Portal */}
                            {item.portal_url && (
                              <button
                                onClick={() => window.open(item.portal_url, '_blank', 'noopener,noreferrer')}
                                className="inline-flex items-center gap-1 rounded-md h-[34px] px-2.5 text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:text-[var(--portal)]"
                                title="Open carrier portal"
                              >
                                <span className="material-icons-outlined text-[14px]">open_in_new</span>
                                Open
                              </button>
                            )}

                            {/* Add Credentials */}
                            <button
                              onClick={() => setCredentialsFor(item)}
                              className="inline-flex items-center gap-1 rounded-md h-[34px] px-2.5 text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:text-[var(--portal)]"
                              title="Add or update credentials"
                            >
                              <span className="material-icons-outlined text-[14px]">key</span>
                              Creds
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Credentials modal */}
      {credentialsFor && (
        <CredentialsModal
          serviceName={credentialsFor.service_name}
          existingUsername={credentialsFor.username}
          existingNotes={credentialsFor.notes}
          onSave={(username, notes) => onUpdateCredentials(credentialsFor.access_id, username, notes)}
          onClose={() => setCredentialsFor(null)}
        />
      )}
    </>
  )
}
