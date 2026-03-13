'use client'

import type { Account } from '@tomachina/core'
import { formatCurrency, formatDate, str } from '../../lib/formatters'
import { SectionCard, DetailField, FieldGrid, EmptyState } from '../../lib/ui-helpers'

interface MedicareTabProps {
  accounts: Account[]
  loading: boolean
}

export function MedicareTab({ accounts, loading }: MedicareTabProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-48 rounded-lg bg-[var(--bg-card)]" />
        ))}
      </div>
    )
  }

  // Filter to medicare accounts
  const medicareAccounts = accounts.filter((acct) => {
    const cat = str(acct.account_type_category).toLowerCase()
    if (cat === 'medicare') return true
    const pt = str(acct.product_type).toLowerCase()
    if (pt.includes('medicare') || pt.includes('mapd') || pt.includes('pdp') || pt.includes('med supp') || pt.includes('medigap')) return true
    return false
  })

  if (medicareAccounts.length === 0) {
    return <EmptyState icon="local_hospital" message="No Medicare accounts on file for this client." />
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-glow)] text-[var(--portal)]">
          <span className="material-icons-outlined text-[20px]">local_hospital</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {medicareAccounts.length} Medicare {medicareAccounts.length === 1 ? 'Plan' : 'Plans'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {countByType(medicareAccounts)}
          </p>
        </div>
      </div>

      {/* Plan cards */}
      {medicareAccounts.map((acct) => (
        <MedicarePlanCard key={acct.account_id || str(acct.policy_number)} account={acct} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MedicarePlanCard({ account }: { account: Account }) {
  const planType = getPlanType(account)
  const statusColor = getStatusColor(str(account.status))

  return (
    <SectionCard
      title={planType || 'Medicare Plan'}
      icon={getPlanIcon(planType)}
    >
      <div className="space-y-4">
        {/* Header row: carrier + status */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              {str(account.carrier_name) || str(account.carrier) || 'Unknown Carrier'}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {str(account.plan_name) || str(account.product_name) || str(account.product) || 'Unknown Plan'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {str(account.status) || 'Unknown'}
          </span>
        </div>

        {/* Detail grid */}
        <FieldGrid cols={3}>
          <DetailField label="Plan Type" value={planType} />
          <DetailField label="Policy Number" value={str(account.account_number) || str(account.policy_number) || str(account.contract_number)} mono />
          <DetailField label="Carrier" value={str(account.carrier_name) || str(account.carrier)} />
          <DetailField label="Monthly Premium" value={formatCurrency(account.monthly_premium || account.premium)} />
          <DetailField label="Effective Date" value={formatDate(account.effective_date || account.issue_date)} />
          <DetailField label="Medicare ID" value={str(account.medicare_id)} mono />
        </FieldGrid>

        {/* Additional details if available */}
        {(str(account.plan_id) || str(account.contract_id) || str(account.pbp) || str(account.segment_id)) && (
          <div className="border-t border-[var(--border-subtle)] pt-3">
            <FieldGrid cols={4}>
              {str(account.plan_id) && <DetailField label="Plan ID" value={str(account.plan_id)} mono />}
              {str(account.contract_id) && <DetailField label="Contract ID" value={str(account.contract_id)} mono />}
              {str(account.pbp) && <DetailField label="PBP" value={str(account.pbp)} mono />}
              {str(account.segment_id) && <DetailField label="Segment" value={str(account.segment_id)} mono />}
            </FieldGrid>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function getPlanType(account: Account): string {
  // Check explicit plan_type first
  const pt = str(account.plan_type).toLowerCase()
  if (pt.includes('mapd') || pt.includes('medicare advantage')) return 'MAPD'
  if (pt.includes('pdp') || pt.includes('prescription drug')) return 'PDP'
  if (pt.includes('med supp') || pt.includes('medigap') || pt.includes('supplement')) return 'Med Supp'
  if (pt.includes('dsnp') || pt.includes('dual')) return 'DSNP'
  if (pt.includes('csnp') || pt.includes('chronic')) return 'CSNP'

  // Fallback: check product_type
  const prodType = str(account.product_type).toLowerCase()
  if (prodType.includes('mapd') || prodType.includes('medicare advantage')) return 'MAPD'
  if (prodType.includes('pdp') || prodType.includes('prescription drug')) return 'PDP'
  if (prodType.includes('med supp') || prodType.includes('medigap') || prodType.includes('supplement')) return 'Med Supp'

  return str(account.plan_type) || str(account.product_type) || 'Medicare'
}

function getPlanIcon(planType: string): string {
  switch (planType) {
    case 'MAPD': return 'health_and_safety'
    case 'PDP': return 'medication'
    case 'Med Supp': return 'medical_services'
    case 'DSNP': return 'accessibility_new'
    case 'CSNP': return 'monitor_heart'
    default: return 'local_hospital'
  }
}

function countByType(accounts: Account[]): string {
  const counts: Record<string, number> = {}
  for (const acct of accounts) {
    const type = getPlanType(acct)
    counts[type] = (counts[type] || 0) + 1
  }
  return Object.entries(counts)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ')
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'in force' || s === 'enrolled') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'pending' || s === 'pending enrollment') return 'bg-amber-500/15 text-amber-400'
  if (s === 'terminated' || s === 'lapsed' || s === 'cancelled' || s === 'disenrolled') return 'bg-red-500/15 text-red-400'
  if (s === 'replaced') return 'bg-blue-500/15 text-blue-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
