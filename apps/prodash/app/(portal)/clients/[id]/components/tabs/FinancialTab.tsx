'use client'

import type { Client } from '@tomachina/core'
import { formatCurrency, str } from '../../lib/formatters'
import { SectionCard, DetailField, EditableField, FieldGrid } from '../../lib/ui-helpers'

interface FinancialTabProps {
  client: Client
  editing?: boolean
  editData?: Record<string, unknown>
  onFieldChange?: (key: string, value: string) => void
}

export function FinancialTab({ client, editing = false, editData = {}, onFieldChange }: FinancialTabProps) {
  const ev = (key: string) => (editData[key] !== undefined ? String(editData[key]) : undefined)
  const F = editing ? EditableField : DetailField
  const fp = (label: string, fieldKey: string, value: unknown, opts?: { type?: 'text' | 'email' | 'tel' | 'date' | 'select' }) =>
    editing
      ? <EditableField label={label} value={formatCurrency(value)} fieldKey={fieldKey} editing={editing} editValue={ev(fieldKey)} onChange={onFieldChange} {...opts} />
      : <DetailField label={label} value={formatCurrency(value)} />
  const ft = (label: string, fieldKey: string, value: unknown) =>
    editing
      ? <EditableField label={label} value={str(value)} fieldKey={fieldKey} editing={editing} editValue={ev(fieldKey)} onChange={onFieldChange} />
      : <DetailField label={label} value={str(value)} />

  return (
    <div className="space-y-4">
      {/* Assets & Income */}
      <SectionCard title="Assets & Income" icon="savings">
        <FieldGrid cols={4}>
          {fp('Investable Assets', 'investable_assets', client.investable_assets)}
          {fp('Net Worth', 'net_worth', client.net_worth)}
          {fp('Household Income', 'household_income', client.household_income)}
          {fp('Annual Income', 'annual_income', client.annual_income)}
        </FieldGrid>
      </SectionCard>

      {/* Tax */}
      <SectionCard title="Tax Information" icon="receipt_long">
        <FieldGrid cols={3}>
          {ft('Federal Tax Bracket', 'federal_tax_bracket', client.federal_tax_bracket)}
          {ft('Filing Status', 'filing_status', client.filing_status)}
          {ft('Funding Source', 'funding_source', client.funding_source)}
        </FieldGrid>
      </SectionCard>

      {/* Risk Profile */}
      <SectionCard title="Risk Profile" icon="trending_up">
        <FieldGrid cols={3}>
          {editing ? (
            <EditableField label="Risk Score" value={str(client.risk_score)} fieldKey="risk_score" editing={editing} editValue={ev('risk_score')} onChange={onFieldChange} />
          ) : (
            <RiskScore label="Risk Score" value={client.risk_score} />
          )}
          {ft('Risk Objective', 'risk_objective', client.risk_objective)}
          {ft('Risk Willingness', 'risk_willingness', client.risk_willingness)}
          {ft('Drop Tolerance', 'drop_tolerance', client.drop_tolerance)}
          {ft('Time Horizon', 'time_horizon', client.time_horizon)}
          {ft('Investment Knowledge', 'investment_knowledge', client.investment_knowledge)}
        </FieldGrid>
      </SectionCard>

      {/* Net Worth Summary — visual bar */}
      <SectionCard title="Net Worth Summary" icon="assessment">
        {(() => {
          const assets = parseFloat(String(client.investable_assets || 0).replace(/[$,\s]/g, '')) || 0
          const netWorth = parseFloat(String(client.net_worth || 0).replace(/[$,\s]/g, '')) || 0
          const income = parseFloat(String(client.household_income || 0).replace(/[$,\s]/g, '')) || 0
          const maxVal = Math.max(assets, netWorth, income, 1)
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <NetWorthCard label="Investable Assets" value={client.investable_assets} icon="account_balance" />
                <NetWorthCard label="Net Worth" value={client.net_worth} icon="trending_up" />
                <NetWorthCard label="Household Income" value={client.household_income} icon="payments" />
              </div>
              {(assets > 0 || netWorth > 0) && (
                <div className="rounded-lg bg-[var(--bg-surface)] p-4">
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Relative Comparison</p>
                  <div className="space-y-2">
                    <BarRow label="Assets" value={assets} max={maxVal} color="var(--portal)" />
                    <BarRow label="Net Worth" value={netWorth} max={maxVal} color="var(--success)" />
                    <BarRow label="Income" value={income} max={maxVal} color="var(--info)" />
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </SectionCard>

      {/* ID.ME Status — always read-only (external system) */}
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

function NetWorthCard({ label, value, icon }: { label: string; value: unknown; icon?: string }) {
  const num = value != null && value !== '' ? parseFloat(String(value).replace(/[$,\s]/g, '')) : null
  const hasValue = num !== null && !isNaN(num)

  return (
    <div className="rounded-lg bg-[var(--bg-surface)] p-4 text-center">
      {icon && <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '20px' }}>{icon}</span>}
      <p className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
        {hasValue ? formatCurrency(num) : <span className="text-[var(--text-muted)]">&mdash;</span>}
      </p>
    </div>
  )
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-[var(--text-muted)]">{label}</span>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-[var(--bg-card)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-16 text-right text-xs font-medium text-[var(--text-primary)]">{formatCurrency(value)}</span>
    </div>
  )
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
