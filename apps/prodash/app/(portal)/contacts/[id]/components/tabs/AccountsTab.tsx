'use client'

import { useState, useMemo, useCallback } from 'react'
import type { Account } from '@tomachina/core'
import { formatCurrency, formatDate, str } from '../../lib/formatters'
import { EmptyState } from '../../lib/ui-helpers'

interface AccountsTabProps {
  accounts: Account[]
  loading: boolean
  clientId: string
}

type CategoryKey = 'annuity' | 'life' | 'medicare' | 'investments'

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
  investments: ['statement', 'application', 'prospectus'],
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

const CATEGORY_CONFIG: Record<CategoryKey, { label: string; icon: string; color: string }> = {
  annuity: { label: 'Annuity', icon: 'savings', color: '#f59e0b' },
  life: { label: 'Life', icon: 'favorite', color: '#10b981' },
  medicare: { label: 'Medicare', icon: 'health_and_safety', color: '#3b82f6' },
  investments: { label: 'Investments', icon: 'show_chart', color: '#a78bfa' },
}

type FilterKey = 'all' | CategoryKey

export function AccountsTab({ accounts, loading, clientId }: AccountsTabProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  // Filter inactive
  const visibleAccounts = useMemo(() => {
    if (showInactive) return accounts
    return accounts.filter((a) => {
      const s = str(a.status).toLowerCase()
      return s !== 'inactive' && s !== 'terminated' && s !== 'lapsed' && s !== 'cancelled' && s !== 'merged' && s !== 'deleted'
        && !(a as Record<string, unknown>)._merged_into
    })
  }, [accounts, showInactive])

  // Detect ddup groups among visible accounts
  const ddupAccountIds = useMemo(() => {
    const groups = findDdupGroups(visibleAccounts)
    const ids = new Set<string>()
    for (const accountIds of groups.values()) {
      for (const id of accountIds) {
        ids.add(id)
      }
    }
    return ids
  }, [visibleAccounts])

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = { annuity: 0, life: 0, medicare: 0, investments: 0 }
    for (const acct of visibleAccounts) {
      const cat = getCategory(acct) as CategoryKey
      if (cat in counts) counts[cat]++
    }
    return counts
  }, [visibleAccounts])

  // Filter by active category
  const filteredByCategory = useMemo(() => {
    if (activeFilter === 'all') return visibleAccounts
    return visibleAccounts.filter((a) => getCategory(a) === activeFilter)
  }, [visibleAccounts, activeFilter])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<CategoryKey, Account[]> = {
      annuity: [],
      life: [],
      medicare: [],
      investments: [],
    }
    for (const acct of filteredByCategory) {
      const cat = getCategory(acct)
      if (cat in groups) {
        groups[cat as CategoryKey].push(acct)
      }
    }
    return groups
  }, [filteredByCategory])

  const handleToggleSelect = useCallback((accountId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }, [])

  // Items 6-7 (DD-2, FIX-4): Build composite IDs as clientId::accountId
  // for the dedup page, using '::' delimiter to avoid conflicts with hyphens
  // in Firestore doc IDs that may use UUID format.
  const handleDdupSelected = useCallback(() => {
    const compositeIds = Array.from(selected).map((acctId) => `${clientId}::${acctId}`)
    const ids = compositeIds.join(',')
    window.open(`/ddup?ids=${ids}&type=account`, '_blank', 'noopener,noreferrer')
  }, [selected, clientId])

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
      {/* Account type filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-sm font-medium transition-all ${
            activeFilter === 'all' ? 'text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          style={activeFilter === 'all' ? { backgroundColor: 'var(--portal)' } : undefined}
        >
          All
          <span className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
            activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
          }`}>{visibleAccounts.length}</span>
        </button>
        {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((cat) => {
          const config = CATEGORY_CONFIG[cat]
          const count = categoryCounts[cat]
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(activeFilter === cat ? 'all' : cat)}
              className={`inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 text-sm font-medium transition-all ${
                activeFilter === cat ? 'text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={activeFilter === cat ? { backgroundColor: config.color } : undefined}
            >
              <span className="material-icons-outlined text-[16px]">{config.icon}</span>
              {config.label}
              <span className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
                activeFilter === cat ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Header: toggle inactive + ddup button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {filteredByCategory.length} Account{filteredByCategory.length !== 1 ? 's' : ''}
          </p>
          {selected.size >= 2 && (
            <button
              onClick={handleDdupSelected}
              className="inline-flex items-center gap-1.5 rounded border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.15)] px-4 py-1.5 text-sm font-medium text-[#f59e0b] transition-all hover:bg-[rgba(245,158,11,0.25)]"
            >
              <span className="material-icons-outlined text-[16px]">compare_arrows</span>
              DeDup Selected ({selected.size})
            </button>
          )}
        </div>
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

      {/* Ddup group notice */}
      {ddupAccountIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.06)] px-3 py-2">
          <span className="material-icons-outlined text-[16px] text-[#f59e0b]">warning_amber</span>
          <p className="text-xs text-[#f59e0b]">
            {ddupAccountIds.size} accounts share a carrier and may be duplicates. Highlighted cards below.
          </p>
        </div>
      )}

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
                {accts.map((acct) => {
                  const acctId = str(acct.account_id) || str((acct as Record<string, unknown>)._id)
                  return (
                    <AccountSummaryCard
                      key={acctId}
                      account={acct}
                      category={cat}
                      clientId={clientId}
                      isDdup={ddupAccountIds.has(acctId)}
                      isSelected={selected.has(acctId)}
                      onToggleSelect={handleToggleSelect}
                    />
                  )
                })}
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

// Item 14 (AT-4): No bottom chevron/expand arrow exists on account cards.
// Navigation is via card click (opens account detail in new tab) and document buttons.
function AccountSummaryCard({
  account,
  category,
  clientId,
  isDdup,
  isSelected,
  onToggleSelect,
}: {
  account: Account
  category: CategoryKey
  clientId: string
  isDdup: boolean
  isSelected: boolean
  onToggleSelect: (accountId: string) => void
}) {
  const statusColor = getStatusColor(str(account.status))
  const acctId = str(account.account_id) || str((account as Record<string, unknown>)._id)
  const policyNum = str(account.policy_number) || str(account.account_number)

  // Product-type-specific fields
  const fields = getSummaryFields(account, category)

  // Document buttons
  const docTypes = CATEGORY_DOCS[category] ?? []
  const documents = ((account as Record<string, unknown>).documents as AccountDocument[] | undefined) ?? []

  const handleCardClick = useCallback(() => {
    window.location.href = `/accounts/${clientId}/${acctId}`
  }, [clientId, acctId])

  const handleCheckboxClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onToggleSelect(acctId)
  }, [onToggleSelect, acctId])

  const handleCheckboxKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent card navigation when interacting with checkbox
    e.stopPropagation()
  }, [])

  // Build border/bg classes based on ddup status
  const cardBorderBg = isDdup
    ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.04)]'
    : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'

  const selectedRing = isSelected ? 'ring-2 ring-[rgba(245,158,11,0.5)]' : ''

  return (
    <div
      onClick={handleCardClick}
      className={`relative cursor-pointer rounded-lg border p-4 transition-all hover:border-[var(--portal)]/50 hover:bg-[rgba(74,122,181,0.04)] ${cardBorderBg} ${selectedRing}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() }}
    >
      {/* Checkbox — top-left */}
      <div className="absolute top-3 left-3">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={handleCheckboxClick}
          onKeyDown={handleCheckboxKeyDown}
          onChange={() => { /* controlled via onClick */ }}
          className="h-4 w-4 cursor-pointer rounded border-[var(--border-subtle)] bg-transparent opacity-40 transition-opacity hover:opacity-100 checked:opacity-100 accent-[#f59e0b]"
          aria-label={`Select account ${policyNum || acctId}`}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-3 pl-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {str(account.carrier_name) || str(account.carrier) || 'Unknown Carrier'}
            </p>
            {isDdup && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(245,158,11,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#f59e0b]">
                <span className="material-icons-outlined text-[11px]">warning_amber</span>
                Possible Duplicate
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {str(account.product_name) || str(account.plan_name) || str(account.product) || 'Unknown Product'}
          </p>
          {policyNum && (
            <p className="mt-0.5 font-mono text-xs text-[var(--portal)]">
              #{policyNum}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {str(account.status) || 'Unknown'}
        </span>
      </div>

      {/* Summary fields — 6 per card, specific to product type */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 pl-6">
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
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-3 pl-6">
          {docTypes.map((docType) => {
            const docItem = documents.find((d) => d.doc_type === docType)
            const hasDoc = !!docItem?.url
            return (
              <button
                key={docType}
                onClick={(e) => {
                  e.stopPropagation()
                  if (hasDoc) {
                    window.open(docItem!.url, '_blank', 'noopener,noreferrer')
                  }
                }}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-all ${
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
        { label: 'Product Type', value: str(account.account_type) },
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
        { label: 'Product Type', value: str(account.account_type) },
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
    case 'investments':
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
  if (cat === 'bdria' || cat === 'investments') return 'investments'

  const t = (str(acct.product_type) + ' ' + str(acct.account_type)).toLowerCase()
  if (t.includes('annuity') || t.includes('fia') || t.includes('myga')) return 'annuity'
  if (t.includes('life')) return 'life'
  if (t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('med supp')) return 'medicare'
  if (t.includes('bd') || t.includes('ria') || t.includes('advisory') || t.includes('brokerage')) return 'investments'
  return 'annuity' // default fallback
}

/**
 * Find potential duplicate account groups.
 * Accounts are grouped by normalized carrier name — if 2+ active accounts
 * share the same carrier, they form a ddup group.
 */
function findDdupGroups(accounts: Account[]): Map<string, string[]> {
  const carrierMap = new Map<string, string[]>()

  for (const acct of accounts) {
    // Only consider active accounts for ddup detection
    const s = str(acct.status).toLowerCase()
    if (s === 'inactive' || s === 'terminated' || s === 'lapsed' || s === 'cancelled' || s === 'deleted' || s === 'merged') continue

    const carrier = (str(acct.carrier_name) || str(acct.carrier)).toLowerCase().trim()
    if (!carrier || carrier === 'unknown carrier') continue

    const acctId = str(acct.account_id) || str((acct as Record<string, unknown>)._id)
    if (!acctId) continue

    const existing = carrierMap.get(carrier)
    if (existing) {
      existing.push(acctId)
    } else {
      carrierMap.set(carrier, [acctId])
    }
  }

  // Only keep groups with 2+ accounts (actual duplicates)
  const ddupGroups = new Map<string, string[]>()
  for (const [carrier, ids] of carrierMap) {
    if (ids.length >= 2) {
      ddupGroups.set(carrier, ids)
    }
  }

  return ddupGroups
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
