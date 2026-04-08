'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

/* ─── Stable query references ─── */
const clientsQuery: Query<DocumentData> = query(collections.clients())
const opportunitiesQuery: Query<DocumentData> = query(collections.opportunities())
const revenueQuery: Query<DocumentData> = query(collections.revenue())
const agentsQuery: Query<DocumentData> = query(collections.agents())

interface ClientRecord { _id: string; source?: string; status?: string; created_at?: string }
interface OppRecord { _id: string; stage?: string; status?: string; deal_value?: number; estimated_value?: number; created_at?: string }
interface RevenueRecord { _id: string; total_premium?: number; premium?: number; amount?: number; carrier?: string; product_type?: string; agent_name?: string; created_at?: string }
interface AgentRecord { _id: string; agent_name?: string; first_name?: string; last_name?: string; status?: string; state?: string }

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function IntelligencePage() {
  const { data: clients, loading: clientsLoading } = useCollection<ClientRecord>(clientsQuery, 'intel-clients')
  const { data: opportunities, loading: oppsLoading } = useCollection<OppRecord>(opportunitiesQuery, 'intel-opps')
  const { data: revenue, loading: revLoading } = useCollection<RevenueRecord>(revenueQuery, 'intel-revenue')
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'intel-agents')

  const anyLoading = clientsLoading || oppsLoading || revLoading || agentsLoading

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

  /* Revenue analysis */
  const revenueAnalysis = useMemo(() => {
    if (revLoading) return { total: 0, carriers: 0, products: 0, monthlyTrend: [] as Array<{ month: string; amount: number }>, topAgents: [] as Array<{ name: string; total: number }> }
    let total = 0
    const carriers = new Set<string>()
    const products = new Set<string>()
    const monthlyMap: Record<string, number> = {}
    const agentMap: Record<string, number> = {}

    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (!isNaN(amount)) total += amount
      if (r.carrier) carriers.add(r.carrier)
      if (r.product_type) products.add(r.product_type)

      // Monthly trend
      if (r.created_at) {
        const d = new Date(r.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyMap[key] = (monthlyMap[key] || 0) + (isNaN(amount) ? 0 : amount)
      }

      // Agent revenue
      if (r.agent_name) {
        agentMap[r.agent_name] = (agentMap[r.agent_name] || 0) + (isNaN(amount) ? 0 : amount)
      }
    })

    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }))

    const topAgents = Object.entries(agentMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, total]) => ({ name, total }))

    return { total, carriers: carriers.size, products: products.size, monthlyTrend, topAgents }
  }, [revenue, revLoading])

  /* Client acquisition funnel */
  const clientFunnel = useMemo(() => {
    if (clientsLoading) return { total: 0, bySource: [] as Array<{ source: string; count: number }>, byStatus: [] as Array<{ status: string; count: number }> }
    const sourceMap: Record<string, number> = {}
    const statusMap: Record<string, number> = {}
    clients.forEach((c) => {
      const src = c.source || 'Unknown'
      sourceMap[src] = (sourceMap[src] || 0) + 1
      const st = c.status || 'active'
      statusMap[st] = (statusMap[st] || 0) + 1
    })
    return {
      total: clients.length,
      bySource: Object.entries(sourceMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([source, count]) => ({ source, count })),
      byStatus: Object.entries(statusMap).sort(([, a], [, b]) => b - a).map(([status, count]) => ({ status, count })),
    }
  }, [clients, clientsLoading])

  /* Data quality score */
  const dataQuality = useMemo(() => {
    if (clientsLoading) return 0
    if (clients.length === 0) return 100
    // Check for basic completeness: has source, has status
    const complete = clients.filter((c) => c.source && c.status).length
    return Math.round((complete / clients.length) * 100)
  }, [clients, clientsLoading])

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Intelligence</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Cross-platform analytics and insights</p>

      {/* Top Metrics */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon="people" label="Total Clients" value={clients.length.toLocaleString()} loading={clientsLoading} subtitle={`${dataQuality}% data quality`} />
        <MetricCard icon="trending_up" label="Open Opportunities" value={pipelineSummary.open.toLocaleString()} loading={oppsLoading} subtitle={`${pipelineSummary.won} won, ${pipelineSummary.lost} lost`} />
        <MetricCard icon="payments" label="Total Revenue" value={formatCurrency(revenueAnalysis.total)} loading={revLoading} subtitle={`${revenueAnalysis.carriers} carriers`} />
        <MetricCard icon="category" label="Product Types" value={revenueAnalysis.products.toLocaleString()} loading={revLoading} subtitle="Across all revenue" />
      </div>

      {/* Revenue Trend Chart (bar visualization) */}
      <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Revenue Trend</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Monthly revenue for last 12 months</p>
        {revLoading ? (
          <div className="mt-4 flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          </div>
        ) : revenueAnalysis.monthlyTrend.length === 0 ? (
          <div className="mt-4 flex flex-col items-center py-8">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">bar_chart</span>
            <p className="mt-2 text-xs text-[var(--text-muted)]">No revenue data with dates available</p>
          </div>
        ) : (
          <div className="mt-4">
            {/* Simple bar chart */}
            <div className="flex items-end gap-1" style={{ height: '160px' }}>
              {revenueAnalysis.monthlyTrend.map((m) => {
                const maxAmount = Math.max(...revenueAnalysis.monthlyTrend.map((x) => x.amount), 1)
                const height = Math.max(4, (m.amount / maxAmount) * 140)
                return (
                  <div key={m.month} className="group relative flex flex-1 flex-col items-center justify-end">
                    <div className="absolute -top-6 hidden rounded bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-medium text-[var(--text-primary)] shadow-md group-hover:block">
                      {formatCurrency(m.amount)}
                    </div>
                    <div
                      className="w-full rounded-t transition-all group-hover:opacity-80"
                      style={{ height: `${height}px`, background: 'var(--portal)', minWidth: '8px' }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-1">
              {revenueAnalysis.monthlyTrend.map((m) => (
                <div key={m.month} className="flex-1 text-center text-[9px] text-[var(--text-muted)]">
                  {m.month.split('-')[1]}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Middle Section: Pipeline + Client Funnel */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                {opportunities.length > 0 && (
                  <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Conversion Rate</span>
                    <span>{Math.round((pipelineSummary.won / opportunities.length) * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Client Acquisition Funnel */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Client Acquisition</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">By source and status</p>
          {clientsLoading ? (
            <div className="mt-4 flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : clients.length === 0 ? (
            <div className="mt-4 flex flex-col items-center py-8">
              <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">person_add</span>
              <p className="mt-2 text-xs text-[var(--text-muted)]">No clients yet</p>
            </div>
          ) : (
            <div className="mt-4">
              <div className="space-y-2">
                {clientFunnel.bySource.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">{s.source}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round((s.count / clients.length) * 100)}%`, background: 'var(--portal)' }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-medium text-[var(--text-primary)]">{s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
              {clientFunnel.byStatus.length > 0 && (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">By Status</p>
                  <div className="flex flex-wrap gap-2">
                    {clientFunnel.byStatus.map((s) => (
                      <span key={s.status} className="rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                        {s.status}: {s.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Top Agents + Data Quality */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performing Agents */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Top Performing Agents</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">By total revenue</p>
          {revLoading ? (
            <div className="mt-4 flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : revenueAnalysis.topAgents.length === 0 ? (
            <div className="mt-4 flex flex-col items-center py-8">
              <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">leaderboard</span>
              <p className="mt-2 text-xs text-[var(--text-muted)]">No agent revenue data</p>
            </div>
          ) : (
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Agent</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueAnalysis.topAgents.map((a, i) => (
                    <tr key={a.name} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 pr-4 text-xs text-[var(--text-muted)]">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">{a.name}</td>
                      <td className="py-2 text-right text-[var(--text-secondary)]">{formatCurrency(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Data Quality + Platform Health */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Platform Health</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Data quality and ecosystem metrics</p>
          {anyLoading ? (
            <div className="mt-4 flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Quality Score */}
              <div className="rounded-lg bg-[var(--bg-surface)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Data Quality Score</span>
                  <span className="text-lg font-bold" style={{ color: dataQuality >= 80 ? '#22c55e' : dataQuality >= 60 ? '#eab308' : '#ef4444' }}>
                    {dataQuality}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-card)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${dataQuality}%`, background: dataQuality >= 80 ? '#22c55e' : dataQuality >= 60 ? '#eab308' : '#ef4444' }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">Based on client profile completeness</p>
              </div>

              {/* Health metrics */}
              <HealthRow icon="people" label="Clients" value={clients.length.toLocaleString()} />
              <HealthRow icon="handshake" label="Opportunities" value={opportunities.length.toLocaleString()} />
              <HealthRow icon="receipt_long" label="Revenue Records" value={revenue.length.toLocaleString()} />
              <HealthRow icon="payments" label="Total Premium" value={formatCurrency(revenueAnalysis.total)} />
              <HealthRow icon="support_agent" label="Agents" value={agents.length.toLocaleString()} />
              <HealthRow icon="business" label="Carriers" value={revenueAnalysis.carriers.toLocaleString()} />
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
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--portal-glow)' }}>
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
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
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
