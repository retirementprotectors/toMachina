'use client'

import { useState, useMemo } from 'react'
import type { Account } from '@tomachina/core'
import { formatCurrency, formatDate, str } from '../../lib/formatters'
import { EmptyState } from '../../lib/ui-helpers'

interface AccountsTabProps {
  accounts: Account[]
  loading: boolean
  clientId: string
}

type CategoryKey = 'all' | 'annuity' | 'life' | 'medicare' | 'bd_ria'

const CATEGORY_CONFIG: Record<CategoryKey, { label: string; icon: string; color: string }> = {
  all: { label: 'All', icon: 'apps', color: 'var(--portal)' },
  annuity: { label: 'Annuity', icon: 'savings', color: '#f59e0b' },
  life: { label: 'Life', icon: 'favorite', color: '#10b981' },
  medicare: { label: 'Medicare', icon: 'health_and_safety', color: '#3b82f6' },
  bd_ria: { label: 'BD/RIA', icon: 'show_chart', color: '#a78bfa' },
}

export function AccountsTab({ accounts, loading, clientId }: AccountsTabProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [activeFilter, setActiveFilter] = useState<CategoryKey>('all')

  // Filter inactive
  const visibleAccounts = useMemo(() => {
    let result = accounts
    if (!showInactive) {
      result = result.filter((a) => {
        const s = str(a.status).toLowerCase()
        return s !== 'inactive' && s !== 'terminated' && s !== 'lapsed' && s !== 'cancelled'
      })
    }
    if (activeFilter !== 'all') {
      result = result.filter((a) => getCategory(a) === activeFilter)
    }
    return result
  }, [accounts, showInactive, activeFilter])

  // Counts per category
  const counts = useMemo(() => {
    const c: Record<CategoryKey, number> = { all: 0, annuity: 0, life: 0, medicare: 0, bd_ria: 0 }
    const active = accounts.filter((a) => {
      const s = str(a.status).toLowerCase()
      return showInactive || (s !== 'inactive' && s !== 'terminated' && s !== 'lapsed' && s !== 'cancelled')
    })
    c.all = active.length
    active.forEach((a) => {
      const cat = getCategory(a)
      if (cat in c && cat !== 'all') c[cat as CategoryKey]++
    })
    return c
  }, [accounts, showInactive])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-lg bg-[var(--bg-card)]" />
        ))}
      </div>
    )
  }

  const inactiveCount = accounts.length - accounts.filter((a) => {
    const s = str(a.status).toLowerCase()
    return s !== 'inactive' && s !== 'terminated' && s !== 'lapsed' && s !== 'cancelled'
  }).length

  return (
    <div className="space-y-5">
      {/* DF-20: Account Type Filter Pills with counts */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((cat) => {
          const config = CATEGORY_CONFIG[cat]
          const isActive = activeFilter === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-sm font-medium transition-all ${
                isActive ? 'text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={isActive ? { backgroundColor: config.color } : undefined}
            >
              {config.label}
              <span className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-1 text-xs ${
                isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}>
                {counts[cat]}
              </span>
            </button>
          )
        })}

        {/* Show/hide inactive toggle */}
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium transition-all bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <span className="material-icons-outlined text-[14px]">
              {showInactive ? 'visibility_off' : 'visibility'}
            </span>
            {showInactive ? 'Hide' : 'Show'} Inactive ({inactiveCount})
          </button>
        )}
      </div>

      {/* PL2-5: KEEP pill headers, REMOVE icon + count section below — just cards directly */}
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleAccounts.map((acct) => (
          <AccountSummaryCard
            key={acct.account_id || str((acct as Record<string, unknown>)._id)}
            account={acct}
            category={getCategory(acct) as CategoryKey}
            clientId={clientId}
          />
        ))}
      </div>

      {accounts.length === 0 && (
        <EmptyState
          icon="account_balance_wallet"
          message="No accounts on file for this client."
        />
      )}

      {accounts.length > 0 && visibleAccounts.length === 0 && (
        <EmptyState
          icon="filter_alt_off"
          message="No accounts match your current filter."
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DF-19: Entire card clickable — remove "Detail" button
// DF-18: Add Policy Number to Account Cards
// ---------------------------------------------------------------------------

function AccountSummaryCard({
  account,
  category,
  clientId,
}: {
  account: Account
  category: CategoryKey
  clientId: string
}) {
  const statusColor = getStatusColor(str(account.status))
  const acctId = str(account.account_id) || str((account as Record<string, unknown>)._id)
  const policyNumber = str(account.policy_number) || str(account.account_number) || str(account.contract_number)

  // DF-21: "Product" -> "Product Type", DF-22: Medicare shows parent carrier
  const fields = getSummaryFields(account, category)

  return (
    <a
      href={`/accounts/${clientId}/${acctId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--portal)]/50 hover:bg-[var(--bg-card-hover)] cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {str(account.carrier_name) || str(account.carrier) || 'Unknown Carrier'}
          </p>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {str(account.product_name) || str(account.plan_name) || str(account.product) || 'Unknown Product'}
          </p>
          {/* DF-18: Policy Number on card */}
          {policyNumber && (
            <p className="text-xs font-mono text-[var(--text-muted)]">{policyNumber}</p>
          )}
        </div>
        <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {str(account.status) || 'Unknown'}
        </span>
      </div>

      {/* Summary fields */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{f.label}</p>
            <p className={`text-xs text-[var(--text-primary)] ${f.mono ? 'font-mono' : ''}`}>
              {f.value || <span className="text-[var(--text-muted)]">&mdash;</span>}
            </p>
          </div>
        ))}
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SummaryField {
  label: string
  value: string
  mono?: boolean
}

function getSummaryFields(account: Account, category: CategoryKey): SummaryField[] {
  switch (category) {
    case 'annuity':
      return [
        { label: 'Product Type', value: str(account.product_name) || str(account.product) },
        { label: 'Account Type', value: str(account.account_type) },
        { label: 'Issue Date', value: formatDate(account.issue_date || account.effective_date) },
        { label: 'Market', value: str(account.market) },
        { label: 'Tax Status', value: str(account.tax_status) },
        { label: 'Value', value: formatCurrency(account.account_value) },
      ]
    case 'life':
      return [
        { label: 'Product Type', value: str(account.product_name) || str(account.product) },
        { label: 'Face Amount', value: formatCurrency(account.face_amount) },
        { label: 'Premium', value: formatCurrency(account.premium) },
        { label: 'Issue Date', value: formatDate(account.issue_date || account.effective_date) },
        { label: 'Policy Status', value: str(account.status) },
        { label: 'Cash Value', value: formatCurrency(account.cash_value) },
      ]
    case 'medicare':
      return [
        { label: 'Plan Type', value: str(account.plan_type || account.product_type) },
        /* DF-22: Show parent carrier */
        { label: 'Parent Carrier', value: str(account.parent_carrier) || str(account.carrier_name) || str(account.carrier) },
        { label: 'Effective Date', value: formatDate(account.effective_date) },
        { label: 'Premium', value: formatCurrency(account.premium) },
        { label: 'Plan ID', value: str(account.plan_id || account.policy_number), mono: true },
        { label: 'Coverage Type', value: str(account.coverage_type) },
      ]
    case 'bd_ria':
      return [
        { label: 'Account Type', value: str(account.account_type) },
        { label: 'Custodian', value: str(account.custodian) || str(account.carrier_name) },
        { label: 'Value', value: formatCurrency(account.account_value) },
        { label: 'Advisor', value: str(account.advisor) },
        { label: 'Account #', value: str(account.account_number) || str(account.policy_number), mono: true },
        { label: 'Status', value: str(account.status) },
      ]
    default:
      return []
  }
}

function getCategory(acct: Account): string {
  const cat = str(acct.account_type_category).toLowerCase()
  if (cat === 'annuity') return 'annuity'
  if (cat === 'life') return 'life'
  if (cat === 'medicare') return 'medicare'
  if (cat === 'bdria' || cat === 'bd_ria') return 'bd_ria'

  const t = (str(acct.product_type) + ' ' + str(acct.account_type)).toLowerCase()
  if (t.includes('annuity') || t.includes('fia') || t.includes('myga')) return 'annuity'
  if (t.includes('life')) return 'life'
  if (t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('med supp')) return 'medicare'
  if (t.includes('bd') || t.includes('ria') || t.includes('advisory') || t.includes('brokerage')) return 'bd_ria'
  return 'annuity' // default fallback
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'in force') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-400'
  if (s === 'terminated' || s === 'lapsed' || s === 'cancelled') return 'bg-red-500/15 text-red-400'
  if (s === 'inactive') return 'bg-gray-500/15 text-gray-400'
  if (s === 'replaced') return 'bg-blue-500/15 text-blue-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
