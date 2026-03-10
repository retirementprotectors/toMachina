'use client'

import type { Client } from '@tomachina/core'
import { formatCurrency, str } from '../../lib/formatters'
import { SectionCard, DetailField, FieldGrid } from '../../lib/ui-helpers'

interface FinancialTabProps {
  client: Client
}

export function FinancialTab({ client }: FinancialTabProps) {
  return (
    <div className="space-y-4">
      {/* Assets & Income */}
      <SectionCard title="Assets & Income" icon="savings">
        <FieldGrid cols={4}>
          <DetailField
            label="Investable Assets"
            value={formatCurrency(client.investable_assets)}
          />
          <DetailField label="Net Worth" value={formatCurrency(client.net_worth)} />
          <DetailField
            label="Household Income"
            value={formatCurrency(client.household_income)}
          />
          <DetailField
            label="Annual Income"
            value={formatCurrency(client.annual_income)}
          />
        </FieldGrid>
      </SectionCard>

      {/* Tax */}
      <SectionCard title="Tax Information" icon="receipt_long">
        <FieldGrid cols={3}>
          <DetailField label="Federal Tax Bracket" value={str(client.federal_tax_bracket)} />
          <DetailField label="Filing Status" value={str(client.filing_status)} />
          <DetailField label="Funding Source" value={str(client.funding_source)} />
        </FieldGrid>
      </SectionCard>

      {/* Risk Profile */}
      <SectionCard title="Risk Profile" icon="trending_up">
        <FieldGrid cols={3}>
          <RiskScore label="Risk Score" value={client.risk_score} />
          <DetailField label="Risk Objective" value={str(client.risk_objective)} />
          <DetailField label="Risk Willingness" value={str(client.risk_willingness)} />
          <DetailField label="Drop Tolerance" value={str(client.drop_tolerance)} />
          <DetailField label="Time Horizon" value={str(client.time_horizon)} />
          <DetailField label="Investment Knowledge" value={str(client.investment_knowledge)} />
        </FieldGrid>
      </SectionCard>

      {/* ID.ME Status */}
      <SectionCard title="ID.ME Verification" icon="verified_user">
        <div className="flex flex-wrap gap-3">
          <IdMeBadge label="IRS" status={str(client.idme_irs)} />
          <IdMeBadge label="SSA" status={str(client.idme_ssa)} />
          <IdMeBadge label="CMS" status={str(client.idme_cms)} />
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskScore({ label, value }: { label: string; value: unknown }) {
  const score = value != null && value !== '' ? Number(value) : null
  const hasScore = score !== null && !isNaN(score)

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1">
        {hasScore ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--text-primary)]">{score}</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, score))}%`,
                  backgroundColor: scoreColor(score),
                }}
              />
            </div>
          </div>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">&mdash;</span>
        )}
      </dd>
    </div>
  )
}

function scoreColor(score: number): string {
  if (score <= 30) return 'var(--success)'
  if (score <= 60) return 'var(--warning)'
  return 'var(--error)'
}

function IdMeBadge({ label, status }: { label: string; status: string }) {
  const s = status.toLowerCase()
  const isVerified = s === 'verified' || s === 'complete' || s === 'yes' || s === 'true'
  const isPending = s === 'pending' || s === 'in progress'

  let badgeClass = 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
  let icon = 'help_outline'

  if (isVerified) {
    badgeClass = 'bg-emerald-500/15 text-emerald-400'
    icon = 'verified'
  } else if (isPending) {
    badgeClass = 'bg-amber-500/15 text-amber-400'
    icon = 'pending'
  } else if (status) {
    badgeClass = 'bg-red-500/15 text-red-400'
    icon = 'cancel'
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${badgeClass}`}
    >
      <span className="material-icons-outlined text-[18px]">{icon}</span>
      <span>
        <span className="font-semibold">{label}</span>
        <span className="ml-1.5 text-xs opacity-75">
          {status || 'Not set'}
        </span>
      </span>
    </span>
  )
}
