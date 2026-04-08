'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const revenueQuery: Query<DocumentData> = query(collections.revenue())
const agentsQuery: Query<DocumentData> = query(collections.agents())

interface RevenueRecord {
  _id: string
  agent_name?: string
  agent_id?: string
  carrier?: string
  product_type?: string
  premium?: number
  total_premium?: number
  amount?: number
  commission_type?: string
  period?: string
}

interface AgentRecord {
  _id: string
  first_name?: string
  last_name?: string
  agent_name?: string
  status?: string
  state?: string
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function AnalysisPage() {
  const { data: revenue, loading: revLoading } = useCollection<RevenueRecord>(revenueQuery, 'analysis-revenue')
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'analysis-agents')

  const anyLoading = revLoading || agentsLoading

  /* Revenue analysis */
  const analysis = useMemo(() => {
    if (revLoading) return { total: 0, byCarrier: {} as Record<string, number>, byAgent: {} as Record<string, number>, byType: {} as Record<string, number> }

    let total = 0
    const byCarrier: Record<string, number> = {}
    const byAgent: Record<string, number> = {}
    const byType: Record<string, number> = {}

    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (isNaN(amount)) return
      total += amount
      const carrier = r.carrier || 'Unknown'
      byCarrier[carrier] = (byCarrier[carrier] || 0) + amount
      const agent = r.agent_name || 'Unassigned'
      byAgent[agent] = (byAgent[agent] || 0) + amount
      const type = r.product_type || r.commission_type || 'Unknown'
      byType[type] = (byType[type] || 0) + amount
    })

    return { total, byCarrier, byAgent, byType }
  }, [revenue, revLoading])

  const topCarriers = useMemo(
    () => Object.entries(analysis.byCarrier).sort(([, a], [, b]) => b - a).slice(0, 10),
    [analysis.byCarrier]
  )

  const topAgents = useMemo(
    () => Object.entries(analysis.byAgent).sort(([, a], [, b]) => b - a).slice(0, 10),
    [analysis.byAgent]
  )

  const topTypes = useMemo(
    () => Object.entries(analysis.byType).sort(([, a], [, b]) => b - a).slice(0, 8),
    [analysis.byType]
  )

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Business Analysis</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Revenue analysis, valuation comparisons, and trend reporting</p>

      {/* Top Metrics */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon="payments" label="Total Revenue" value={formatCurrency(analysis.total)} loading={revLoading} />
        <MetricCard icon="receipt_long" label="Revenue Records" value={revenue.length.toLocaleString()} loading={revLoading} />
        <MetricCard icon="business" label="Carriers" value={Object.keys(analysis.byCarrier).length.toLocaleString()} loading={revLoading} />
        <MetricCard icon="support_agent" label="Total Agents" value={agents.length.toLocaleString()} loading={agentsLoading} />
      </div>

      {/* Three-Column Analysis */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* By Carrier */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Revenue by Carrier</h2>
          <div className="mt-3 space-y-2">
            {anyLoading ? (
              <LoadingRows count={5} />
            ) : topCarriers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No carrier data.</p>
            ) : (
              topCarriers.map(([name, amount]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)] truncate">{name}</span>
                    <span className="font-medium text-[var(--text-primary)]">{formatCurrency(amount)}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((amount / analysis.total) * 100)}%`,
                        background: 'var(--portal)',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Agent */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Revenue by Agent</h2>
          <div className="mt-3 space-y-2">
            {anyLoading ? (
              <LoadingRows count={5} />
            ) : topAgents.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No agent data.</p>
            ) : (
              topAgents.map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)] truncate">{name}</span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCurrency(amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Product Type */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Revenue by Type</h2>
          <div className="mt-3 space-y-2">
            {anyLoading ? (
              <LoadingRows count={5} />
            ) : topTypes.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No type data.</p>
            ) : (
              topTypes.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)] truncate">{type}</span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCurrency(amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, loading }: {
  icon: string; label: string; value: string; loading: boolean
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
        <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      )}
    </div>
  )
}

function LoadingRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-[var(--bg-surface)]" />
      ))}
    </>
  )
}
