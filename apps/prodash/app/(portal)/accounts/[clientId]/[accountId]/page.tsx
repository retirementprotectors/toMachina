'use client'

import { use } from 'react'
import Link from 'next/link'
import { useDocument } from '@tomachina/db'
import type { Account, Client } from '@tomachina/core'

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
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--portal)]">
          <span className="material-icons-outlined text-[18px]">arrow_back</span>
          Back to Client
        </Link>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">account_balance_wallet</span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Account not found</h2>
        </div>
      </div>
    )
  }

  const clientName = client ? `${str(client.first_name)} ${str(client.last_name)}` : 'Client'
  const statusColor = getStatusColor(str(account.status))

  // Collect all non-empty fields into sections
  const sections = buildSections(account)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--portal)]">
        <span className="material-icons-outlined text-[18px]">arrow_back</span>
        Back to {clientName}
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {str(account.product_type) || str(account.account_type_category) || str(account.account_type) || 'Account'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              {str(account.carrier_name) || str(account.carrier) || 'Unknown Carrier'}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {str(account.product_name) || str(account.plan_name) || ''}
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

      {/* Detail sections */}
      {sections.map((section) => (
        <div key={section.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {section.title}
          </h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{f.label}</dt>
                <dd className={`mt-1 text-sm text-[var(--text-primary)] ${f.mono ? 'font-mono' : ''}`}>
                  {f.value || <span className="text-[var(--text-muted)]">&mdash;</span>}
                </dd>
              </div>
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

interface FieldItem { label: string; value: string; mono?: boolean }
interface Section { title: string; fields: FieldItem[] }

function buildSections(account: Account): Section[] {
  const sections: Section[] = []

  // Skip internal/migration fields
  const skip = new Set(['_id', '_migrated_at', '_source', 'client_id', 'ghl_contact_id', 'ghl_object_id', 'import_source', 'created_at', 'updated_at', 'account_type_category'])

  // Group remaining fields
  const details: FieldItem[] = []
  for (const [key, val] of Object.entries(account)) {
    if (skip.has(key)) continue
    if (val == null || val === '') continue
    // Already shown in header
    if (['carrier_name', 'product_name', 'plan_name', 'product_type', 'account_type', 'status', 'account_value', 'premium', 'annual_premium', 'account_number', 'policy_number', 'contract_number', 'issue_date', 'effective_date'].includes(key)) continue

    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const isMoney = key.includes('value') || key.includes('premium') || key.includes('benefit') || key.includes('income') || key.includes('deposit') || key.includes('surrender')
    const isDate = key.includes('date') || key.includes('_at')

    let display = String(val)
    if (isMoney) display = formatCurrency(val)
    else if (isDate) display = formatDate(val)

    details.push({ label, value: display, mono: key.includes('number') || key.includes('id') })
  }

  if (details.length > 0) {
    sections.push({ title: 'Account Details', fields: details })
  }

  return sections
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'in force') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-400'
  if (s === 'terminated' || s === 'lapsed' || s === 'cancelled') return 'bg-red-500/15 text-red-400'
  if (s === 'replaced') return 'bg-blue-500/15 text-blue-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
