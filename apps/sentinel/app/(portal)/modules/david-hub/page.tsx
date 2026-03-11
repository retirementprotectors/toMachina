'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const revenueQuery: Query<DocumentData> = query(collections.revenue())
const agentsQuery: Query<DocumentData> = query(collections.agents())
const opportunitiesQuery: Query<DocumentData> = query(collections.opportunities())

interface RevenueRecord {
  _id: string
  agent_name?: string
  carrier_name?: string
  product_type?: string
  premium?: number
  total_premium?: number
  amount?: number
}

interface AgentRecord {
  _id: string
  agent_name?: string
  first_name?: string
  last_name?: string
  status?: string
}

interface OpportunityRecord {
  _id: string
  stage?: string
  deal_value?: number
  estimated_value?: number
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function DavidHubPage() {
  const { data: revenue, loading: revLoading } = useCollection<RevenueRecord>(revenueQuery, 'david-revenue')
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'david-agents')
  const { data: opps, loading: oppsLoading } = useCollection<OpportunityRecord>(opportunitiesQuery, 'david-opps')

  const metrics = useMemo(() => {
    let totalRevenue = 0
    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (!isNaN(amount)) totalRevenue += amount
    })

    let pipelineValue = 0
    let openDeals = 0
    opps.forEach((o) => {
      const stage = (o.stage || '').toLowerCase()
      if (!stage.includes('closed')) {
        openDeals++
        const val = Number(o.deal_value || o.estimated_value || 0)
        if (!isNaN(val)) pipelineValue += val
      }
    })

    const activeAgents = agents.filter((a) => (a.status || '').toLowerCase() === 'active').length

    return { totalRevenue, pipelineValue, openDeals, activeAgents, totalAgents: agents.length }
  }, [revenue, agents, opps])

  const anyLoading = revLoading || agentsLoading || oppsLoading

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">DAVID HUB</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">B2B command center — entry calculators and deal evaluation</p>

      {/* Key Metrics */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon="payments" label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} loading={revLoading} />
        <MetricCard icon="trending_up" label="Pipeline Value" value={formatCurrency(metrics.pipelineValue)} loading={oppsLoading} subtitle={`${metrics.openDeals} open deals`} />
        <MetricCard icon="people" label="Active Agents" value={metrics.activeAgents.toLocaleString()} loading={agentsLoading} subtitle={`of ${metrics.totalAgents} total`} />
        <MetricCard icon="receipt_long" label="Revenue Records" value={revenue.length.toLocaleString()} loading={revLoading} />
      </div>

      {/* Calculator Cards */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Entry Calculators</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">M&amp;A deal evaluation tools</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CalculatorCard
            icon="analytics"
            title="MEC Calculator"
            description="Modified Endowment Contract analysis for life insurance deal evaluation"
          />
          <CalculatorCard
            icon="price_check"
            title="PRP Evaluator"
            description="Producer Revenue Projection for book-of-business valuation"
          />
          <CalculatorCard
            icon="timeline"
            title="SPH Projections"
            description="Surrender Period Horizon modeling for annuity blocks"
          />
          <CalculatorCard
            icon="account_balance"
            title="Deal Valuation"
            description="Comprehensive M&amp;A deal valuation with DCF and NPV analysis"
          />
        </div>
      </div>

      {/* Placeholder for future calculator inline rendering */}
      {!anyLoading && (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
          <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">calculate</span>
          <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Inline Calculators Coming Soon</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            DAVID entry calculators will render inline here, replacing the pop-out GAS-based DAVID-HUB web app.
          </p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, loading, subtitle }: {
  icon: string; label: string; value: string; loading: boolean; subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
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

function CalculatorCard({ icon, title, description }: {
  icon: string; title: string; description: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--portal-glow)' }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '22px', color: 'var(--portal)' }}>{icon}</span>
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}
          >
            Coming Soon
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      </div>
    </div>
  )
}
