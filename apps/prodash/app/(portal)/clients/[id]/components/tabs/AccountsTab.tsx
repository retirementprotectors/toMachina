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

type CategoryKey = 'annuity' | 'life' | 'medicare' | 'bd_ria'

// ---------------------------------------------------------------------------
// Document types per product category
// ---------------------------------------------------------------------------

type DocType = 'statement' | 'application' | 'illustration' | 'contract' | 'policy' | 'plan_summary' | 'prospectus'

interface AccountDocument {
  doc_type: DocType
  url: string
  uploaded_at: string
  uploaded_by: string
}

const CATEGORY_DOCS: Record<CategoryKey, DocType[]> = {
  annuity: ['statement', 'application', 'illustration', 'contract'],
  life: ['statement', 'application', 'illustration', 'policy'],
  medicare: ['statement', 'application', 'plan_summary'],
  bd_ria: ['statement', 'application', 'prospectus'],
}

const DOC_LABELS: Record<DocType, string> = {
  statement: 'Statement',
  application: 'Application',
  illustration: 'Illustration',
  contract: 'Contract',
  policy: 'Policy',
  plan_summary: 'Plan Summary',
  prospectus: 'Prospectus',
}

// ---------------------------------------------------------------------------
// Category config — "BD/RIA" display label changed to "Investment"
// Data value (bd_ria) remains unchanged
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<CategoryKey, { label: string; icon: string; color: string }> = {
  annuity: { label: 'Annuity', icon: 'savings', color: '#f59e0b' },
  life: { label: 'Life', icon: 'favorite', color: '#10b981' },
  medicare: { label: 'Medicare', icon: 'health_and_safety', color: '#3b82f6' },
  bd_ria: { label: 'Investment', icon: 'show_chart', color: '#a78bfa' }, // display label: Investment (data: bd_ria)
}

export function AccountsTab({ accounts, loading, clientId }: AccountsTabProps) {
  const [showInactive, setShowInactive] = useState(false)

  // Filter inactive
  const visibleAccounts = useMemo(() => {
    if (showInactive) return accounts
    return accounts.filter((a) => {
      const s = str(a.status).toLowerCase()
      return s !== 'inactive' && s !== 'terminated' && s !== 'lapsed' && s !== 'cancelled'
    })
  }, [accounts, showInactive])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<CategoryKey, Account[]> = {
      annuity: [],
      life: [],
      medicare: [],
      bd_ria: [],
    }
    for (const acct of visibleAccounts) {
      const cat = getCategory(acct)
      if (cat in groups) {
        groups[cat as CategoryKey].push(acct)
      }
    }
    return groups
  }, [visibleAccounts])

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
      {/* Header: toggle inactive */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {visibleAccounts.length} Account{visibleAccounts.length !== 1 ? 's' : ''}
        </p>
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <span className="material-icons-outlined text-[14px]">
              {showInactive ? 'visibility_off' : 'visibility'}
            </span>
            {showInactive ? 'Hide' : 'Show'} Inactive ({inactiveCount})
          </button>
        )}
      </div>

      {/* Grouped accounts */}
      {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((cat) => {
        const accts = grouped[cat]
        const config = CATEGORY_CONFIG[cat]
        return (
          <div key={cat}>
            {/* Group header */}
            <div className="mb-3 flex items-center gap-2">
              <span className="material-icons-outlined text-[18px]" style={{ color: config.color }}>
                {config.icon}
              </span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {config.label} ({accts.length})
              </h3>
            </div>

            {accts.length === 0 ? (
              <p className="ml-7 mb-4 text-xs text-[var(--text-muted)] italic">No {config.label.toLowerCase()} accounts</p>
            ) : (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {accts.map((acct) => (
                  <AccountSummaryCard
                    key={acct.account_id || str((acct as Record<string, unknown>)._id)}
                    account={acct}
                    category={cat}
                    clientId={clientId}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {accounts.length === 0 && (
        <EmptyState
          icon="account_balance_wallet"
          message="No accounts on file for this client."
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Product-type-specific summary card
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

  // Product-type-specific fields
  const fields = getSummaryFields(account, category)

  // Document buttons
  const docTypes = CATEGORY_DOCS[category] ?? []
  const documents = ((account as Record<string, unknown>).documents as AccountDocument[] | undefined) ?? []

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--portal)]/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            {str(account.carrier_name) || str(account.carrier) || 'Unknown Carrier'}
          </p>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {str(account.product_name) || str(account.plan_name) || str(account.product) || 'Unknown Product'}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {str(account.status) || 'Unknown'}
        </span>
      </div>

      {/* Summary fields — 6 per card, specific to product type */}
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

      {/* Document buttons */}
      {docTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-3">
          {docTypes.map((docType) => {
            const doc = documents.find((d) => d.doc_type === docType)
            const hasDoc = !!doc?.url
            return (
              <button
                key={docType}
                onClick={() => {
                  if (hasDoc) {
                    window.open(doc!.url, '_blank', 'noopener,noreferrer')
                  } else {
                    // Placeholder — upload flow will be wired later
                    const label = DOC_LABELS[docType]
                    // Use toast system when available; for now, no user feedback to avoid alert()
                    void label // no-op — keeps reference
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-md h-[28px] px-2.5 text-xs font-medium transition-all ${
                  hasDoc
                    ? 'bg-[var(--portal)] text-white hover:brightness-110'
                    : 'border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--portal)]/50 hover:text-[var(--text-secondary)]'
                }`}
                title={hasDoc ? `Open ${DOC_LABELS[docType]}` : `No ${DOC_LABELS[docType]} uploaded yet`}
              >
                <span className="material-icons-outlined text-[12px]">
                  {hasDoc ? 'description' : 'upload_file'}
                </span>
                {DOC_LABELS[docType]}
              </button>
            )
          })}
        </div>
      )}

      {/* Detail link — opens in NEW TAB */}
      <div className="mt-3 flex justify-end">
        <a
          href={`/accounts/${clientId}/${acctId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--portal)] hover:underline"
        >
          Detail
          <span className="material-icons-outlined text-[12px]">open_in_new</span>
        </a>
      </div>
    </div>
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
        { label: 'Product', value: str(account.product_name) || str(account.product) },
        { label: 'Account Type', value: str(account.account_type) },
        { label: 'Issue Date', value: formatDate(account.issue_date || account.effective_date) },
        { label: 'Market', value: str(account.market) },
        { label: 'Tax Status', value: str(account.tax_status) },
        { label: 'Value', value: formatCurrency(account.account_value) },
      ]
    case 'life':
      return [
        { label: 'Product', value: str(account.product_name) || str(account.product) },
        { label: 'Face Amount', value: formatCurrency(account.face_amount) },
        { label: 'Premium', value: formatCurrency(account.premium) },
        { label: 'Issue Date', value: formatDate(account.issue_date || account.effective_date) },
        { label: 'Policy Status', value: str(account.status) },
        { label: 'Cash Value', value: formatCurrency(account.cash_value) },
      ]
    case 'medicare':
      return [
        { label: 'Plan Type', value: str(account.plan_type || account.product_type) },
        { label: 'Carrier', value: str(account.carrier_name) || str(account.carrier) },
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
