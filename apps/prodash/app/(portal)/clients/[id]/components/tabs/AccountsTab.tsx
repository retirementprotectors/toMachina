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
    const cat = getCategory(acct)
    if (cat === 'annuity') counts.annuity++
    else if (cat === 'life') counts.life++
    else if (cat === 'medicare') counts.medicare++
    else if (cat === 'bd_ria') counts.bd_ria++
  }

  // Filter
  const filtered =
    filter === 'all'
      ? accounts
      : accounts.filter((acct) => getCategory(acct) === filter)

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

      {/* Account summary */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryMiniCard label="Total Accounts" value={String(accounts.length)} icon="layers" />
          <SummaryMiniCard label="Total Value" value={formatCurrency(accounts.reduce((sum, a) => sum + parseFloat(String(a.account_value || a.premium || a.face_amount || 0).replace(/[$,]/g, '')), 0))} icon="account_balance" />
          <SummaryMiniCard label="Active" value={String(accounts.filter((a) => ['active', 'in force'].includes(String(a.status || '').toLowerCase())).length)} icon="check_circle" />
          <SummaryMiniCard label="Pending" value={String(accounts.filter((a) => String(a.status || '').toLowerCase() === 'pending').length)} icon="pending" />
        </div>
      )}

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
  const acctId = str(account.account_id) || str(account.policy_number) || str((account as Record<string, unknown>)._id)
  const clientId = str(account.client_id)
  const valueAmount = account.account_value || account.premium || account.face_amount
  const valueStr = formatCurrency(valueAmount)
  const carrierName = str(account.carrier_name) || str(account.carrier) || 'Unknown Carrier'

  return (
    <a
      href={clientId && acctId ? `/accounts/${clientId}/${acctId}` : undefined}
      className="group relative block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-all hover:border-[var(--portal)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
    >
      {/* Header with carrier indicator */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--portal-glow)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
              {getAccountIcon(str(account.account_type_category))}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {str(account.product_type) || str(account.account_type_category) || str(account.account_type)}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{carrierName}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {str(account.status) || 'Unknown'}
        </span>
      </div>

      {/* Value prominent */}
      {valueStr && (
        <p className="mt-3 text-xl font-bold text-[var(--text-primary)]">{valueStr}</p>
      )}

      {/* Details */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <MiniField label="Product" value={str(account.product_name) || str(account.plan_name) || str(account.product)} />
        <MiniField label="Policy #" value={str(account.account_number) || str(account.policy_number) || str(account.contract_number)} mono />
        <MiniField label="Issue Date" value={formatDate(account.issue_date || account.effective_date)} />
      </div>

      {/* View Details hover action */}
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--portal)' }}>
        <span>View Details</span>
        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
      </div>
    </a>
  )
}

function getAccountIcon(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('annuity')) return 'savings'
  if (c.includes('life')) return 'favorite'
  if (c.includes('medicare')) return 'health_and_safety'
  if (c.includes('bd') || c.includes('ria')) return 'show_chart'
  return 'account_balance_wallet'
}

/** Classify an account into a filter category using multiple field sources */
function getCategory(acct: Account): FilterKey {
  // First check the migration-set category
  const cat = str(acct.account_type_category).toLowerCase()
  if (cat === 'annuity') return 'annuity'
  if (cat === 'life') return 'life'
  if (cat === 'medicare') return 'medicare'
  if (cat === 'bdria' || cat === 'bd_ria') return 'bd_ria'

  // Fallback: check product_type or account_type text
  const t = (str(acct.product_type) + ' ' + str(acct.account_type)).toLowerCase()
  if (t.includes('annuity') || t.includes('fia') || t.includes('myga')) return 'annuity'
  if (t.includes('life')) return 'life'
  if (t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('med supp')) return 'medicare'
  if (t.includes('bd') || t.includes('ria') || t.includes('advisory') || t.includes('brokerage')) return 'bd_ria'
  return 'all'
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

function SummaryMiniCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-center">
      <span className="material-icons-outlined text-[16px] text-[var(--portal)]">{icon}</span>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
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
