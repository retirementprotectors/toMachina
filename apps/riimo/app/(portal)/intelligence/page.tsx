'use client'

import { useMemo } from 'react'
import { query, limit, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

/* ─── Stable query references ─── */
const clientsQuery: Query<DocumentData> = query(collections.clients())
const opportunitiesQuery: Query<DocumentData> = query(collections.opportunities())
const revenueQuery: Query<DocumentData> = query(collections.revenue())

interface OpportunityRecord {
  _id: string
  stage?: string
  status?: string
  deal_value?: number
  estimated_value?: number
  created_at?: string
}

interface RevenueRecord {
  _id: string
  total_premium?: number
  premium?: number
  amount?: number
  carrier_name?: string
  product_type?: string
  created_at?: string
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function IntelligencePage() {
  const { data: clients, loading: clientsLoading } = useCollection(clientsQuery, 'intel-clients')
  const { data: opportunities, loading: oppsLoading } = useCollection<OpportunityRecord>(opportunitiesQuery, 'intel-opps')
  const { data: revenue, loading: revLoading } = useCollection<RevenueRecord>(revenueQuery, 'intel-revenue')

  const anyLoading = clientsLoading || oppsLoading || revLoading

  /* Pipeline summary */
  const pipelineSummary = useMemo(() => {
    if (oppsLoading) return { open: 0, won: 0, lost: 0, totalValue: 0 }
    let open = 0, won = 0, lost = 0, totalValue = 0
    opportunities.forEach((o) => {
      const stage = (o.stage || '').toLowerCase()
      const status = (o.status || '').toLowerCase()
      if (stage.includes('closed won') || status === 'won') won++
      else if (stage.includes('closed lost') || status === 'lost') lost++
      else open++
      const val = Number(o.deal_value || o.estimated_value || 0)
      if (!isNaN(val)) totalValue += val
    })
    return { open, won, lost, totalValue }
  }, [opportunities, oppsLoading])

  /* Revenue trends */
  const revenueSummary = useMemo(() => {
    if (revLoading) return { total: 0, carriers: 0, products: 0 }
    let total = 0
    const carriers = new Set<string>()
    const products = new Set<string>()
    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (!isNaN(amount)) total += amount
      if (r.carrier_name) carriers.add(r.carrier_name)
      if (r.product_type) products.add(r.product_type)
    })
    return { total, carriers: carriers.size, products: products.size }
  }, [revenue, revLoading])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Intelligence</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Cross-platform analytics and insights</p>

      {/* Top Metrics */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon="people"
          label="Total Clients"
          value={clients.length.toLocaleString()}
          loading={clientsLoading}
        />
        <MetricCard
          icon="trending_up"
          label="Open Opportunities"
          value={pipelineSummary.open.toLocaleString()}
          loading={oppsLoading}
          subtitle={`${pipelineSummary.won} won, ${pipelineSummary.lost} lost`}
        />
        <MetricCard
          icon="payments"
          label="Total Revenue"
          value={formatCurrency(revenueSummary.total)}
          loading={revLoading}
          subtitle={`${revenueSummary.carriers} carriers`}
        />
        <MetricCard
          icon="category"
          label="Product Types"
          value={revenueSummary.products.toLocaleString()}
          loading={revLoading}
          subtitle="Across all revenue"
        />
      </div>

      {/* Pipeline & Revenue Section */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline Funnel */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Opportunity Pipeline</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Deal stage distribution</p>
          {oppsLoading ? (
            <div className="mt-4 flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : opportunities.length === 0 ? (
            <div className="mt-4 flex flex-col items-center py-8 text-center">
              <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">trending_up</span>
              <p className="mt-2 text-xs text-[var(--text-muted)]">No opportunities yet</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <PipelineBar label="Open" count={pipelineSummary.open} total={opportunities.length} color="var(--portal)" />
              <PipelineBar label="Won" count={pipelineSummary.won} total={opportunities.length} color="#22c55e" />
              <PipelineBar label="Lost" count={pipelineSummary.lost} total={opportunities.length} color="#ef4444" />
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Pipeline Value</span>
                  <span className="font-bold text-[var(--text-primary)]">{formatCurrency(pipelineSummary.totalValue)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Client Growth */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Platform Health</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Key metrics across the ecosystem</p>
          {anyLoading ? (
            <div className="mt-4 flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <HealthRow icon="people" label="Clients" value={clients.length.toLocaleString()} />
              <HealthRow icon="handshake" label="Opportunities" value={opportunities.length.toLocaleString()} />
              <HealthRow icon="receipt_long" label="Revenue Records" value={revenue.length.toLocaleString()} />
              <HealthRow icon="payments" label="Total Premium" value={formatCurrency(revenueSummary.total)} />
              <HealthRow icon="business" label="Carriers" value={revenueSummary.carriers.toLocaleString()} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function MetricCard({ icon, label, value, loading, subtitle }: {
  icon: string; label: string; value: string; loading: boolean; subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--portal-glow)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-[var(--bg-surface)]" />
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </>
      )}
    </div>
  )
}

function PipelineBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-medium text-[var(--text-primary)]">{count} ({pct}%)</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function HealthRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-sm" style={{ color: 'var(--portal)' }}>{icon}</span>
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}
