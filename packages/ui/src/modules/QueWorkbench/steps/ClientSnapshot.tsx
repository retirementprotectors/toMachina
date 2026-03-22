'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../../fetchValidated'
import type { QueProductLine } from '../types'

interface ClientSnapshotProps {
  sessionId: string | null
  productLine: QueProductLine
  onNext: () => void
  onSessionCreated: (sessionId: string) => void
}

interface MemberRow {
  client_id: string
  client_name: string
  role: string
  dob?: string
  gender?: string
  state?: string
}

interface SessionSnapshot {
  household_name: string
  members: MemberRow[]
  accounts: Record<string, unknown>[]
  financials?: {
    total_income?: number
    net_worth?: number
    filing_status?: string
    tax_bracket?: string
  }
  state?: string
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function calculateAge(dob: string): number | null {
  try {
    const birth = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const monthDiff = now.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--
    }
    return age
  } catch {
    return null
  }
}

export function ClientSnapshot({ sessionId, productLine, onNext, onSessionCreated }: ClientSnapshotProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [confirming, setConfirming] = useState(false)

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetchValidated<{ client_snapshot: SessionSnapshot; household_name: string }>(`/api/que/${sessionId}`)
      if (!result.success) {
        setError(result.error ?? 'Failed to load session')
        return
      }
      if (result.data) {
        setSnapshot({
          ...result.data.client_snapshot,
          household_name: result.data.household_name,
        })
      } else {
        setError('Unexpected response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      if (!sessionId) {
        // Create a new session
        const result = await fetchValidated<{ session_id: string }>('/api/que', {
          method: 'POST',
          body: JSON.stringify({ product_line: productLine }),
        })
        if (!result.success) {
          setError(result.error ?? 'Failed to create session')
          return
        }
        if (result.data) {
          onSessionCreated(result.data.session_id)
        } else {
          setError('Failed to create session')
          return
        }
      }
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="material-icons-outlined animate-spin text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
          sync
        </span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">Loading client data...</p>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">person_add</span>
        <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">New {productLine} Session</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          A household will be selected when the session is created.
        </p>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={confirming}
          className="mt-4 flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          {confirming ? (
            <>
              <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>sync</span>
              Creating...
            </>
          ) : (
            <>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
              Create Session
            </>
          )}
        </button>
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">error_outline</span>
        <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={() => void loadSession()}
          className="mt-2 text-xs font-medium transition-colors hover:brightness-110"
          style={{ color: 'var(--portal)' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!snapshot) return null

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Household header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{snapshot.household_name}</h2>
        {snapshot.state && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">State: {snapshot.state}</p>
        )}
      </div>

      {/* Members */}
      <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>people</span>
          Household Members
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Age</th>
              <th className="py-2 pr-4">Gender</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.members.map((m) => (
              <tr key={m.client_id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">{m.client_name}</td>
                <td className="py-2 pr-4 text-[var(--text-secondary)]">{m.role}</td>
                <td className="py-2 pr-4 text-[var(--text-secondary)]">{m.dob ? calculateAge(m.dob) ?? '-' : '-'}</td>
                <td className="py-2 pr-4 text-[var(--text-secondary)]">{m.gender ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financials */}
      {snapshot.financials && (
        <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>account_balance</span>
            Combined Financials
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {snapshot.financials.total_income != null && (
              <div>
                <p className="text-xs text-[var(--text-muted)]">Income</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrency(snapshot.financials.total_income)}
                </p>
              </div>
            )}
            {snapshot.financials.net_worth != null && (
              <div>
                <p className="text-xs text-[var(--text-muted)]">Net Worth</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrency(snapshot.financials.net_worth)}
                </p>
              </div>
            )}
            {snapshot.financials.filing_status && (
              <div>
                <p className="text-xs text-[var(--text-muted)]">Filing Status</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {snapshot.financials.filing_status}
                </p>
              </div>
            )}
            {snapshot.financials.tax_bracket && (
              <div>
                <p className="text-xs text-[var(--text-muted)]">Tax Bracket</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {snapshot.financials.tax_bracket}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts */}
      {snapshot.accounts.length > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>folder_open</span>
            Accounts ({snapshot.accounts.length})
          </h3>
          <div className="space-y-2">
            {snapshot.accounts.map((acct, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--text-primary)]">
                  {(acct.carrier_name as string) ?? 'Unknown Carrier'} — {(acct.product_name as string) ?? (acct.account_type as string) ?? 'Account'}
                </span>
                {acct.account_value != null && (
                  <span className="font-medium text-[var(--text-secondary)]">
                    {formatCurrency(acct.account_value as number)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm button */}
      <div className="flex items-center justify-end gap-3">
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={confirming}
          className="flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          {confirming ? (
            <>
              <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>sync</span>
              Confirming...
            </>
          ) : (
            <>
              Confirm Data Current
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
