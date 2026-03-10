'use client'

import { useState } from 'react'
import type { Account } from '@tomachina/core'
import { formatCurrency, formatDate, str } from '../../lib/formatters'
import { EmptyState } from '../../lib/ui-helpers'

interface AccountsTabProps {
  accounts: Account[]
  loading: boolean
}

type FilterKey = 'all' | 'annuity' | 'life' | 'medicare' | 'bd_ria'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'annuity', label: 'Annuity' },
  { key: 'life', label: 'Life' },
  { key: 'medicare', label: 'Medicare' },
  { key: 'bd_ria', label: 'BD/RIA' },
]

export function AccountsTab({ accounts, loading }: AccountsTabProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-lg bg-[var(--bg-card)]" />
        ))}
      </div>
    )
  }

  // Count by type
  const counts: Record<FilterKey, number> = {
    all: accounts.length,
    annuity: 0,
    life: 0,
    medicare: 0,
    bd_ria: 0,
  }

  for (const acct of accounts) {
    const t = str(acct.account_type).toLowerCase()
    if (t.includes('annuity') || t.includes('fia') || t.includes('myga')) counts.annuity++
    else if (t.includes('life')) counts.life++
    else if (t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('med supp')) counts.medicare++
    else if (t.includes('bd') || t.includes('ria') || t.includes('advisory') || t.includes('brokerage')) counts.bd_ria++
  }

  // Filter
  const filtered =
    filter === 'all'
      ? accounts
      : accounts.filter((acct) => {
          const t = str(acct.account_type).toLowerCase()
          switch (filter) {
            case 'annuity':
              return t.includes('annuity') || t.includes('fia') || t.includes('myga')
            case 'life':
              return t.includes('life')
            case 'medicare':
              return t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('med supp')
            case 'bd_ria':
              return t.includes('bd') || t.includes('ria') || t.includes('advisory') || t.includes('brokerage')
            default:
              return true
          }
        })

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
              filter === f.key
                ? 'bg-[var(--portal)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {f.label}
            <span
              className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
                filter === f.key
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Account cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="account_balance_wallet"
          message={
            filter === 'all'
              ? 'No accounts on file for this client.'
              : `No ${FILTERS.find((f) => f.key === filter)?.label ?? ''} accounts found.`
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((acct) => (
            <AccountCard key={acct.account_id || str(acct.policy_number)} account={acct} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account Card
// ---------------------------------------------------------------------------

function AccountCard({ account }: { account: Account }) {
  const statusColor = getStatusColor(str(account.status))

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[var(--border-medium)]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {str(account.account_type)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
            {str(account.carrier) || 'Unknown Carrier'}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {str(account.status) || 'Unknown'}
        </span>
      </div>

      {/* Details */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        <MiniField label="Product" value={str(account.product)} />
        <MiniField label="Policy #" value={str(account.policy_number)} mono />
        <MiniField label="Premium" value={formatCurrency(account.premium)} />
        <MiniField label="Face Amount" value={formatCurrency(account.face_amount)} />
        <MiniField label="Effective" value={formatDate(account.effective_date)} />
      </div>
    </div>
  )
}

function MiniField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className={`text-sm text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-[var(--text-muted)]">&mdash;</span>}
      </p>
    </div>
  )
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'in force') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-400'
  if (s === 'terminated' || s === 'lapsed' || s === 'cancelled') return 'bg-red-500/15 text-red-400'
  if (s === 'replaced') return 'bg-blue-500/15 text-blue-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
