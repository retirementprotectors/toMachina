'use client'

import { use, useState, useCallback } from 'react'
import Link from 'next/link'
import { useDocument, getDb } from '@tomachina/db'
import { doc, updateDoc } from 'firebase/firestore'
import type { Account, Client } from '@tomachina/core'
import { AccountDocuments } from '@tomachina/ui/src/modules/AccountDocuments'

function str(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

function formatCurrency(raw: unknown): string {
  if (raw == null || raw === '') return ''
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  if (isNaN(num)) return String(raw)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)
}

function formatDate(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatPercent(raw: unknown): string {
  if (raw == null || raw === '') return ''
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[%\s]/g, ''))
  if (isNaN(num)) return String(raw)
  return `${num}%`
}

// ---------------------------------------------------------------------------
// Inline Edit Field for Account Detail
// ---------------------------------------------------------------------------

function InlineAccountField({
  label,
  value,
  fieldKey,
  clientId,
  accountId,
  type = 'text',
  options,
  mono,
  formatDisplay,
}: {
  label: string
  value: string
  fieldKey: string
  clientId: string
  accountId: string
  type?: 'text' | 'date' | 'number' | 'select'
  options?: { label: string; value: string }[]
  mono?: boolean
  formatDisplay?: (val: string) => string
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(value)
  const [saving, setSaving] = useState(false)

  const displayed = formatDisplay ? formatDisplay(value) : value

  const handleSave = useCallback(async () => {
    if (editVal === value) { setEditing(false); return }
    setSaving(true)
    try {
      const ref = doc(getDb(), 'clients', clientId, 'accounts', accountId)
      await updateDoc(ref, {
        [fieldKey]: editVal,
        updated_at: new Date().toISOString(),
      })
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }, [editVal, value, clientId, accountId, fieldKey])

  if (!editing) {
    return (
      <div className="group">
        <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
        <dd
          className={`mt-1 flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-[var(--bg-surface)] ${mono ? 'font-mono text-sm' : 'text-sm'} text-[var(--text-primary)]`}
          onClick={() => { setEditVal(value); setEditing(true) }}
          title="Click to edit"
        >
          {displayed || <span className="text-[var(--text-muted)]">&mdash;</span>}
          <span className="material-icons-outlined text-[14px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
        </dd>
      </div>
    )
  }

  const inputCls = 'w-full rounded-md border border-[var(--portal)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--portal)]/30'

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <div className="mt-1 space-y-1.5">
        {type === 'select' && options ? (
          <select value={editVal} onChange={(e) => setEditVal(e.target.value)} className={inputCls} autoFocus>
            <option value="">--</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            className={inputCls}
            autoFocus
          />
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving} className="rounded bg-[var(--portal)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} disabled={saving} className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account Detail Page
// ---------------------------------------------------------------------------

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; accountId: string }>
}) {
  const { clientId, accountId } = use(params)
  const { data: account, loading, error } = useDocument<Account>(`clients/${clientId}/accounts`, accountId)
  const { data: client } = useDocument<Client>('clients', clientId)

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6">
        <div className="h-5 w-32 rounded bg-[var(--bg-surface)]" />
        <div className="h-64 rounded-xl bg-[var(--bg-card)]" />
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/accounts" className="text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]">
            Accounts
          </Link>
          <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">chevron_right</span>
          <Link href={`/contacts/${clientId}`} className="text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]">
            {client ? `${str(client.first_name)} ${str(client.last_name)}` : 'Client'}
          </Link>
        </nav>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">account_balance_wallet</span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Account not found</h2>
        </div>
      </div>
    )
  }

  const clientName = client ? `${str(client.first_name)} ${str(client.last_name)}` : 'Client'
  const statusColor = getStatusColor(str(account.status))
  const sections = buildProductSections(account, clientId, accountId)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/accounts" className="text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]">
          Accounts
        </Link>
        <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">chevron_right</span>
        <Link href={`/contacts/${clientId}`} className="text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]">
          {clientName}
        </Link>
        <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">chevron_right</span>
        <span className="font-medium text-[var(--text-primary)]">
          {str(account.carrier) || str(account.product_name) || 'Account'}
        </span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {str(account.product_type) || str(account.account_type_category) || str(account.account_type) || 'Account'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              {str(account.carrier) || str(account.carrier) || 'Unknown Carrier'}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {str(account.product_name) || str(account.plan_name) || ''}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Client: {clientName}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}>
            {str(account.status) || 'Unknown'}
          </span>
        </div>

        {/* Key stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Account Value" value={formatCurrency(account.account_value)} />
          <StatCard label="Premium" value={formatCurrency(account.premium || account.annual_premium)} />
          <StatCard label="Policy #" value={str(account.account_number) || str(account.policy_number) || str(account.contract_number)} mono />
          <StatCard label="Issue Date" value={formatDate(account.issue_date || account.effective_date)} />
        </div>
      </div>

      {/* Special links */}
      <div className="flex gap-3">
        <Link
          href="/service-centers/beni"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined text-[16px]">groups</span>
          View in Beni Center
        </Link>
        <Link
          href="/service-centers/rmd"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined text-[16px]">calculate</span>
          View in RMD Center
        </Link>
      </div>

      {/* Account Documents — linked files from ACF */}
      <AccountDocuments accountId={accountId} />

      {/* Detail sections — inline editing */}
      {sections.map((section) => (
        <div key={section.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {section.icon && (
              <span className="material-icons-outlined text-[16px] text-[var(--portal)]">{section.icon}</span>
            )}
            {section.title}
          </h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((f) => (
              <InlineAccountField
                key={f.fieldKey}
                label={f.label}
                value={f.rawValue}
                fieldKey={f.fieldKey}
                clientId={clientId}
                accountId={accountId}
                type={f.type}
                options={f.options}
                mono={f.mono}
                formatDisplay={f.formatDisplay}
              />
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-lg font-semibold text-[var(--text-primary)] ${mono ? 'font-mono text-sm' : ''}`}>
        {value || <span className="text-[var(--text-muted)]">&mdash;</span>}
      </p>
    </div>
  )
}

interface FieldDef {
  label: string
  fieldKey: string
  rawValue: string
  type?: 'text' | 'date' | 'number' | 'select'
  options?: { label: string; value: string }[]
  mono?: boolean
  formatDisplay?: (val: string) => string
}

interface SectionDef {
  title: string
  icon: string
  fields: FieldDef[]
}

function buildProductSections(account: Account, clientId: string, accountId: string): SectionDef[] {
  const cat = str(account.account_type_category).toLowerCase()
  const t = (str(account.product_type) + ' ' + str(account.account_type)).toLowerCase()

  // Detect category
  let category = 'generic'
  if (cat === 'annuity' || /annuity|fia|myga|spia|dia|rila/.test(t)) category = 'annuity'
  else if (cat === 'life' || /life|iul|vul|gul|term|whole/.test(t)) category = 'life'
  else if (cat === 'medicare' || /medicare|mapd|pdp|supplement|medigap/.test(t)) category = 'medicare'
  else if (cat === 'investments' || cat === 'investment' || cat === 'bdria' || cat === 'bd_ria' || t.includes('advisory') || t.includes('brokerage')) category = 'investments'

  switch (category) {
    case 'annuity': return buildAnnuitySections(account)
    case 'life': return buildLifeSections(account)
    case 'medicare': return buildMedicareSections(account)
    case 'investments': return buildInvestmentSections(account)
    default: return buildGenericSections(account)
  }
}

function f(label: string, fieldKey: string, val: unknown, opts?: Partial<FieldDef>): FieldDef {
  return { label, fieldKey, rawValue: str(val), ...opts }
}

function buildAnnuitySections(a: Account): SectionDef[] {
  const showContractNumber = a.contract_number && a.contract_number !== a.policy_number
  const policyLabel = showContractNumber ? 'Policy Number' : 'Policy / Contract Number'
  const sections: SectionDef[] = [
    {
      title: 'Contract Details', icon: 'savings',
      fields: [
        f('Carrier', 'carrier', a.carrier),
        f('Product', 'product_name', a.product_name),
        f('Account Type', 'account_type', a.account_type),
        f('Tax Status', 'tax_status', a.tax_status, { type: 'select', options: ['IRA','Roth IRA','Non-Qualified','401(k)','403(b)','SEP IRA','SIMPLE IRA','Inherited IRA'].map(v => ({ label: v, value: v })) }),
        f('Market', 'market', a.market),
        f(policyLabel, 'policy_number', a.policy_number, { mono: true }),
        ...(showContractNumber ? [f('Contract Number', 'contract_number', a.contract_number, { mono: true })] : []),
        f('NAIC Code', 'naic_code', a.naic_code, { mono: true }),
        f('Charter Code', 'charter_code', a.charter_code, { mono: true }),
        f('Plan Name', 'plan_name', a.plan_name),
        f('Plan Code', 'plan_code', a.plan_code, { mono: true }),
        f('Data Source', 'data_source', a.data_source),
        f('Book of Business', 'book_of_business', a.book_of_business),
      ],
    },
    {
      title: 'Values', icon: 'account_balance',
      fields: [
        f('Account Value', 'account_value', a.account_value, { formatDisplay: formatCurrency }),
        f('Surrender Value', 'surrender_value', a.surrender_value, { formatDisplay: formatCurrency }),
        f('Premium', 'premium', a.premium, { formatDisplay: formatCurrency }),
        f('Annual Premium', 'annual_premium', a.annual_premium, { formatDisplay: formatCurrency }),
        f('Death Benefit', 'death_benefit', a.death_benefit, { formatDisplay: formatCurrency }),
        f('Cash Value', 'cash_value', a.cash_value, { formatDisplay: formatCurrency }),
        f('Income Benefit', 'income_benefit', a.income_benefit, { formatDisplay: formatCurrency }),
        f('Benefit Base', 'benefit_base', a.benefit_base, { formatDisplay: formatCurrency }),
        f('Net Deposits', 'net_deposits', a.net_deposits, { formatDisplay: formatCurrency }),
        f('Total Premiums Paid', 'total_premiums_paid', a.total_premiums_paid, { formatDisplay: formatCurrency }),
        f('Guaranteed Rate', 'guaranteed_rate', a.guaranteed_rate, { formatDisplay: formatPercent }),
        f('Current Rate', 'current_rate', a.current_rate, { formatDisplay: formatPercent }),
      ],
    },
    {
      title: 'Dates', icon: 'event',
      fields: [
        f('Issue Date', 'issue_date', a.issue_date, { type: 'date', formatDisplay: formatDate }),
        f('Effective Date', 'effective_date', a.effective_date, { type: 'date', formatDisplay: formatDate }),
        f('Maturity Date', 'maturity_date', a.maturity_date, { type: 'date', formatDisplay: formatDate }),
        f('Surrender End Date', 'surrender_end_date', a.surrender_end_date, { type: 'date', formatDisplay: formatDate }),
        f('As Of Date', 'as_of_date', a.as_of_date, { type: 'date', formatDisplay: formatDate }),
        f('Last Transaction', 'last_transaction_date', a.last_transaction_date, { type: 'date', formatDisplay: formatDate }),
      ],
    },
    {
      title: 'Ownership', icon: 'person',
      fields: [
        f('Account Owner', 'account_owner', a.account_owner),
        f('Owner', 'owner_name', a.owner_name),
        f('Annuitant', 'annuitant_name', a.annuitant_name),
        f('Joint Owner', 'joint_owner_name', a.joint_owner_name),
        f('Joint Owner', 'joint_owner', a.joint_owner),
        f('Annuitant', 'annuitant', a.annuitant),
        f('Beneficiary', 'beneficiary', a.beneficiary),
      ],
    },
  ]
  const hasRmd = a.rmd_calculated || a.rmd_remaining || a.prior_year_fmv
  if (hasRmd) {
    const valIdx = sections.findIndex(s => s.title === 'Values')
    sections.splice(valIdx + 1, 0, {
      title: 'RMD Info', icon: 'calculate',
      fields: [
        f('RMD Calculated', 'rmd_calculated', a.rmd_calculated, { formatDisplay: formatCurrency }),
        f('RMD Remaining', 'rmd_remaining', a.rmd_remaining, { formatDisplay: formatCurrency }),
        f('Prior Year FMV', 'prior_year_fmv', a.prior_year_fmv, { formatDisplay: formatCurrency }),
        f('Issue Age', 'issue_age', a.issue_age),
      ],
    })
  }
  const hasRider = a.rider_name || a.income_base || a.rider_activated
  if (hasRider) {
    const riderStatus = a.rider_activated ? 'TRIGGERED' : 'DORMANT'
    const riderFields: FieldDef[] = [
      f('Rider Name', 'rider_name', a.rider_name),
      f('Status', 'rider_activated', riderStatus),
      f('Income Base', 'income_base', a.income_base, { formatDisplay: formatCurrency }),
      ...(a.rider_activated ? [f('Income Amount', 'income_amount', a.income_amount, { formatDisplay: formatCurrency })] : [f('Rollup Rate', 'rollup_rate', a.rollup_rate, { formatDisplay: formatPercent })]),
      f('Payment Mode', 'payment_mode', a.payment_mode),
      f('Rider Fee', 'rider_fee', a.rider_fee, { formatDisplay: formatPercent }),
      f('Payout Rate', 'payout_rate', a.payout_rate, { formatDisplay: formatPercent }),
    ]
    sections.splice(2, 0, { title: 'Income Rider', icon: 'trending_up', fields: riderFields })
  }
  return sections
}

function buildLifeSections(a: Account): SectionDef[] {
  return [
    {
      title: 'Policy Details', icon: 'favorite',
      fields: [
        f('Carrier', 'carrier', a.carrier),
        f('Parent Carrier', 'parent_carrier', a.parent_carrier),
        f('Product', 'product_name', a.product_name),
        f('Policy Type', 'policy_type', a.policy_type || a.product_type),
        f('Policy Number', 'policy_number', a.policy_number, { mono: true }),
        f('Account Number', 'account_number', a.account_number, { mono: true }),
        f('Status', 'status', a.status),
        f('Plan Name', 'plan_name', a.plan_name),
        f('Plan Code', 'plan_code', a.plan_code, { mono: true }),
        f('Writing Agent', 'writing_agent_id', a.writing_agent_id, { mono: true }),
        f('Market', 'market', a.market),
      ],
    },
    {
      title: 'Coverage', icon: 'shield',
      fields: [
        f('Face Amount', 'face_amount', a.face_amount, { formatDisplay: formatCurrency }),
        f('Face Value', 'face_value', a.face_value, { formatDisplay: formatCurrency }),
        f('Premium', 'premium', a.premium, { formatDisplay: formatCurrency }),
        f('Annual Premium', 'annual_premium', a.annual_premium, { formatDisplay: formatCurrency }),
        f('Billing Mode', 'billing_mode', a.billing_mode),
        f('Cash Value', 'cash_value', a.cash_value, { formatDisplay: formatCurrency }),
        f('Surrender Value', 'surrender_value', a.surrender_value, { formatDisplay: formatCurrency }),
        f('Death Benefit', 'death_benefit', a.death_benefit, { formatDisplay: formatCurrency }),
        f('Account Value', 'account_value', a.account_value, { formatDisplay: formatCurrency }),
        f('Loan Balance', 'loan_balance', a.loan_balance, { formatDisplay: formatCurrency }),
        f('Commission Split', 'commission_split', a.commission_split),
        f('Premium Mode', 'premium_mode', a.premium_mode),
      ],
    },
    {
      title: 'Underwriting', icon: 'verified_user',
      fields: [
        f('Health Class', 'health_class', a.health_class),
        f('Risk Class', 'risk_class', a.risk_class),
        f('Issue Age', 'issue_age', a.issue_age),
        f('MEC', 'mec', a.mec || a.is_mec),
        f('DB Option', 'death_benefit_option', a.death_benefit_option || a.db_option),
      ],
    },
    {
      title: 'Dates', icon: 'event',
      fields: [
        f('Issue Date', 'issue_date', a.issue_date, { type: 'date', formatDisplay: formatDate }),
        f('Effective Date', 'effective_date', a.effective_date, { type: 'date', formatDisplay: formatDate }),
        f('Expiration Date', 'expiration_date', a.expiration_date, { type: 'date', formatDisplay: formatDate }),
        f('Maturity Date', 'maturity_date', a.maturity_date, { type: 'date', formatDisplay: formatDate }),
        f('Paid To Date', 'paid_to_date', a.paid_to_date, { type: 'date', formatDisplay: formatDate }),
        f('Last Transaction', 'last_transaction_date', a.last_transaction_date, { type: 'date', formatDisplay: formatDate }),
      ],
    },
    {
      title: 'Ownership', icon: 'person',
      fields: [
        f('Policy Owner', 'policy_owner', a.policy_owner),
        f('Owner', 'owner_name', a.owner_name),
        f('Insured', 'insured_name', a.insured_name),
        f('Insured DOB', 'insured_dob', a.insured_dob, { type: 'date', formatDisplay: formatDate }),
        f('Joint Insured', 'joint_insured_name', a.joint_insured_name),
      ],
    },
    {
      title: 'Beneficiaries', icon: 'family_restroom',
      fields: [
        f('Beneficiary', 'beneficiary', a.beneficiary),
        f('Primary Beneficiary', 'primary_beneficiary', a.primary_beneficiary),
        f('Primary %', 'primary_beneficiary_pct', a.primary_beneficiary_pct, { formatDisplay: formatPercent }),
      ],
    },
  ]
}

function buildMedicareSections(a: Account): SectionDef[] {
  return [
    {
      title: 'Plan Details', icon: 'health_and_safety',
      fields: [
        f('Carrier', 'carrier', a.carrier),
        f('Parent Carrier', 'parent_carrier', a.parent_carrier),
        f('Plan Name', 'plan_name', a.plan_name),
        f('Plan Type', 'plan_type', a.plan_type || a.product_type),
        f('Plan ID', 'plan_id', a.plan_id || a.policy_number, { mono: true }),
        f('Coverage Type', 'coverage_type', a.coverage_type),
        f('Status', 'status', a.status),
        f('Core Product Type', 'core_product_type', a.core_product_type),
        f('Ancillary Type', 'ancillary_type', a.ancillary_type),
        f('MAPD Type', 'mapd_type', a.mapd_type),
        f('Plan Letter', 'plan_letter', a.plan_letter),
        f('CMS Plan Code', 'cms_plan_code', a.cms_plan_code, { mono: true }),
        f('Carrier Charter', 'carrier_charter', a.carrier_charter),
      ],
    },
    {
      title: 'Costs', icon: 'payments',
      fields: [
        f('Monthly Premium', 'premium', a.premium, { formatDisplay: formatCurrency }),
        f('Deductible', 'deductible', a.deductible, { formatDisplay: formatCurrency }),
        f('Max Out of Pocket', 'max_oop', a.max_oop, { formatDisplay: formatCurrency }),
        f('Drug Deductible', 'drug_deductible', a.drug_deductible, { formatDisplay: formatCurrency }),
        f('Annual Premium', 'annual_premium', a.annual_premium, { formatDisplay: formatCurrency }),
        f('Commissionable Premium', 'commissionable_premium', a.commissionable_premium, { formatDisplay: formatCurrency }),
        f('Planned Premium', 'planned_premium', a.planned_premium, { formatDisplay: formatCurrency }),
      ],
    },
    {
      title: 'Dates', icon: 'event',
      fields: [
        f('Effective Date', 'effective_date', a.effective_date, { type: 'date', formatDisplay: formatDate }),
        f('Disenrollment Date', 'disenrollment_date', a.disenrollment_date, { type: 'date', formatDisplay: formatDate }),
        f('Term Date', 'term_date', a.term_date, { type: 'date', formatDisplay: formatDate }),
        f('Termination Date', 'termination_date', a.termination_date, { type: 'date', formatDisplay: formatDate }),
        f('Submitted Date', 'submitted_date', a.submitted_date, { type: 'date', formatDisplay: formatDate }),
      ],
    },
    {
      title: 'Enrollment', icon: 'how_to_reg',
      fields: [
        f('Election Type', 'election_type', a.election_type),
        f('Writing Agent', 'writing_agent_id', a.writing_agent_id, { mono: true }),
        f('Carrier Status', 'carrier_application_status', a.carrier_application_status),
        f('Sales Type', 'carrier_sales_type', a.carrier_sales_type),
        f('Medicare Beneficiary ID', 'medicare_beneficiary_id', a.medicare_beneficiary_id, { mono: true }),
        f('Member ID', 'member_id', a.member_id, { mono: true }),
      ],
    },
  ]
}

function buildInvestmentSections(a: Account): SectionDef[] {
  return [
    {
      title: 'Account Details', icon: 'show_chart',
      fields: [
        f('Custodian', 'custodian', a.custodian || a.carrier),
        f('Custodian ID', 'custodian_id', a.custodian_id, { mono: true }),
        f('Custodian Account #', 'custodian_account_number', a.custodian_account_number, { mono: true }),
        f('Account Type', 'account_type', a.account_type),
        f('Account Number', 'account_number', a.account_number || a.policy_number, { mono: true }),
        f('Account Registration', 'account_registration', a.account_registration),
        f('Advisor', 'advisor', a.advisor),
        f('Advisor of Record', 'advisor_of_record', a.advisor_of_record),
        f('Status', 'status', a.status),
        f('Tax Status', 'tax_status', a.tax_status),
        f('BD/RIA Firm', 'bd_ria_firm', a.bd_ria_firm),
        f('Book of Business', 'book_of_business', a.book_of_business),
        f('Market', 'market', a.market),
      ],
    },
    {
      title: 'Values', icon: 'account_balance',
      fields: [
        f('Account Value', 'account_value', a.account_value, { formatDisplay: formatCurrency }),
        f('Model', 'model', a.model),
        f('Risk Level', 'risk_level', a.risk_level),
        f('Fee Schedule', 'fee_schedule', a.fee_schedule, { formatDisplay: formatPercent }),
        f('Net Deposits', 'net_deposits', a.net_deposits, { formatDisplay: formatCurrency }),
        f('Advisory Fee %', 'advisory_fee_pct', a.advisory_fee_pct, { formatDisplay: formatPercent }),
        f('Advisory Fees', 'advisory_fees', a.advisory_fees, { formatDisplay: formatCurrency }),
        f('Death Benefit', 'death_benefit', a.death_benefit, { formatDisplay: formatCurrency }),
      ],
    },
    {
      title: 'Dates', icon: 'event',
      fields: [
        f('Effective Date', 'effective_date', a.effective_date, { type: 'date', formatDisplay: formatDate }),
        f('Rebalance Date', 'rebalance_date', a.rebalance_date, { type: 'date', formatDisplay: formatDate }),
        f('As Of Date', 'as_of_date', a.as_of_date, { type: 'date', formatDisplay: formatDate }),
        f('Issue Date', 'issue_date', a.issue_date, { type: 'date', formatDisplay: formatDate }),
      ],
    },
    {
      title: 'Ownership', icon: 'person',
      fields: [
        f('Owner', 'owner_name', a.owner_name),
        f('Joint Owner', 'joint_owner_name', a.joint_owner_name),
      ],
    },
  ]
}

function buildGenericSections(a: Account): SectionDef[] {
  const skip = new Set(['_id', '_migrated_at', '_source', 'client_id', 'ghl_contact_id', 'ghl_object_id', 'import_source', 'created_at', 'updated_at', 'account_type_category'])
  const headerShown = new Set(['carrier', 'product_name', 'plan_name', 'product_type', 'account_type', 'status', 'account_value', 'premium', 'annual_premium', 'account_number', 'policy_number', 'contract_number', 'issue_date', 'effective_date'])

  const fields: FieldDef[] = []
  for (const [key, val] of Object.entries(a)) {
    if (skip.has(key) || headerShown.has(key)) continue
    if (val == null || val === '') continue
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const isMoney = key.includes('value') || key.includes('premium') || key.includes('benefit') || key.includes('amount')
    const isDate = key.includes('date') || key.includes('_at')
    fields.push(f(label, key, val, {
      formatDisplay: isMoney ? formatCurrency : isDate ? formatDate : undefined,
      type: isDate ? 'date' : isMoney ? 'number' : 'text',
      mono: key.includes('number') || key.includes('id'),
    }))
  }

  return fields.length > 0 ? [{ title: 'Account Details', icon: 'info', fields }] : []
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'in force') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-400'
  if (s === 'terminated' || s === 'lapsed' || s === 'cancelled') return 'bg-red-500/15 text-red-400'
  if (s === 'replaced') return 'bg-blue-500/15 text-blue-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
