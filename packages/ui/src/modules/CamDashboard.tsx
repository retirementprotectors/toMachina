'use client'

import { useMemo, useState } from 'react'
import { query, collection, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import { calculateFYC, calculateRenewal } from '@tomachina/core'

// ============================================================================
// Types
// ============================================================================

interface CamDashboardProps {
  portal: string
}

interface RevenueRecord {
  _id: string
  revenue_id?: string
  agent_id?: string
  agent_name?: string
  writing_agent?: string
  carrier_name?: string
  carrier?: string
  product_type?: string
  commission_type?: string
  revenue_type?: string
  amount?: number
  commission_amount?: number
  revenue_amount?: number
  premium?: number
  total_premium?: number
  period?: string
  status?: string
  source?: string
  created_at?: string
}

interface CompGridRecord {
  _id: string
  grid_id?: string
  carrier_id?: string
  carrier_name?: string
  product_type?: string
  level?: string
  rate?: number
  effective_date?: string
}

type TabKey = 'overview' | 'carriers' | 'agents' | 'types' | 'comp-grids' | 'projections' | 'pipeline'

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function parseAmount(r: RevenueRecord): number {
  const raw = r.amount ?? r.commission_amount ?? r.revenue_amount ?? r.total_premium ?? r.premium ?? 0
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  return isNaN(num) ? 0 : num
}

function str(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}20` }}>
          <span className="material-icons-outlined" style={{ color: accent, fontSize: '20px' }}>{icon}</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

function BarRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-[var(--text-secondary)]">{label}</span>
        <span className="ml-2 whitespace-nowrap font-medium text-[var(--text-primary)]">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, pct * 100)}%`, backgroundColor: 'var(--portal)' }}
        />
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--portal)] text-white'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">{icon}</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CamDashboard({ portal }: CamDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  // Queries
  const revenueQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'revenue')), [])
  const compGridQ = useMemo<Query<DocumentData> | null>(() => {
    try { return query(collection(getDb(), 'comp_grids')) } catch { return null }
  }, [])

  const { data: revenue, loading: revLoading, error: revError } = useCollection<RevenueRecord>(revenueQ, 'cam-revenue')
  const { data: compGrids, loading: cgLoading } = useCollection<CompGridRecord>(compGridQ, 'cam-comp-grids')

  // Aggregations
  const stats = useMemo(() => {
    if (revLoading) return null

    let totalAmount = 0
    const byCarrier: Record<string, number> = {}
    const byAgent: Record<string, number> = {}
    const byType: Record<string, number> = {}
    const byPeriod: Record<string, number> = {}
    const agentSet = new Set<string>()
    const carrierSet = new Set<string>()

    revenue.forEach((r) => {
      const amount = parseAmount(r)
      totalAmount += amount

      const carrier = str(r.carrier_name || r.carrier) || 'Unknown'
      byCarrier[carrier] = (byCarrier[carrier] || 0) + amount
      carrierSet.add(carrier)

      const agent = str(r.agent_name || r.writing_agent) || 'Unassigned'
      byAgent[agent] = (byAgent[agent] || 0) + amount
      agentSet.add(agent)

      const type = str(r.revenue_type || r.commission_type || r.product_type) || 'Other'
      byType[type] = (byType[type] || 0) + amount

      const period = str(r.period) || 'Unknown'
      byPeriod[period] = (byPeriod[period] || 0) + amount
    })

    return {
      totalAmount,
      totalRecords: revenue.length,
      carrierCount: carrierSet.size,
      agentCount: agentSet.size,
      byCarrier,
      byAgent,
      byType,
      byPeriod,
    }
  }, [revenue, revLoading])

  // Projections — FYC + renewal estimates based on current revenue
  const projections = useMemo(() => {
    if (!stats) return null
    const fycRate = 0.05
    const renewalRate = 0.02
    const fycEstimate = calculateFYC(stats.totalAmount, fycRate)
    const renewalYear1 = calculateRenewal(stats.totalAmount, renewalRate, 1)
    const renewalYear2 = calculateRenewal(stats.totalAmount, renewalRate, 2)
    const renewalYear3 = calculateRenewal(stats.totalAmount, renewalRate, 3)
    return { fycEstimate, renewalYear1, renewalYear2, renewalYear3 }
  }, [stats])

  // Sorted breakdowns
  const topCarriers = useMemo(() =>
    stats ? Object.entries(stats.byCarrier).sort((a, b) => b[1] - a[1]).slice(0, 15) : [],
    [stats]
  )
  const topAgents = useMemo(() =>
    stats ? Object.entries(stats.byAgent).sort((a, b) => b[1] - a[1]).slice(0, 15) : [],
    [stats]
  )
  const byType = useMemo(() =>
    stats ? Object.entries(stats.byType).sort((a, b) => b[1] - a[1]) : [],
    [stats]
  )
  const byPeriod = useMemo(() =>
    stats ? Object.entries(stats.byPeriod).sort((a, b) => a[0].localeCompare(b[0])) : [],
    [stats]
  )

  // Loading state
  if (revLoading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--bg-surface)]" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--bg-card)]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 rounded-xl bg-[var(--bg-card)]" />
          <div className="h-64 rounded-xl bg-[var(--bg-card)]" />
        </div>
      </div>
    )
  }

  // Error state
  if (revError) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load revenue data: {revError.message}
        </div>
      </div>
    )
  }

  // Empty state
  if (!stats || stats.totalRecords === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Commission Accounting Machine</p>
        <div className="mt-6">
          <EmptyState icon="payments" message="No revenue data available." />
        </div>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'carriers', label: 'Carriers' },
    { key: 'agents', label: 'Agents' },
    { key: 'types', label: 'By Type' },
    { key: 'comp-grids', label: 'Comp Grids' },
    { key: 'projections', label: 'Projections' },
    { key: 'pipeline', label: 'Pipeline' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Commission Accounting Machine — Revenue intelligence</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalAmount)} icon="payments" accent="#10b981" />
        <StatCard label="Revenue Records" value={stats.totalRecords.toLocaleString()} icon="receipt_long" accent="#3b82f6" />
        <StatCard label="Carriers" value={stats.carrierCount.toString()} icon="business" accent="#a78bfa" />
        <StatCard label="Agents" value={stats.agentCount.toString()} icon="groups" accent="#f59e0b" />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        {tabs.map((t) => (
          <TabButton key={t.key} active={activeTab === t.key} label={t.label} onClick={() => setActiveTab(t.key)} />
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top Carriers */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Carriers</h3>
            <div className="space-y-2.5">
              {topCarriers.slice(0, 8).map(([name, amount]) => (
                <BarRow key={name} label={name} value={formatCurrency(amount)} pct={amount / (topCarriers[0]?.[1] || 1)} />
              ))}
            </div>
          </div>

          {/* Top Agents */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Agents</h3>
            <div className="space-y-2.5">
              {topAgents.slice(0, 8).map(([name, amount]) => (
                <BarRow key={name} label={name} value={formatCurrency(amount)} pct={amount / (topAgents[0]?.[1] || 1)} />
              ))}
            </div>
          </div>

          {/* Revenue by Type */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revenue by Type</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byType.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">{type}</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'carriers' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            All Carriers by Revenue ({topCarriers.length})
          </h3>
          {topCarriers.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No carrier data.</p>
          ) : (
            <div className="space-y-2.5">
              {topCarriers.map(([name, amount], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-6 text-right text-xs text-[var(--text-muted)]">{i + 1}</span>
                  <div className="flex-1">
                    <BarRow label={name} value={formatCurrency(amount)} pct={amount / (topCarriers[0]?.[1] || 1)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            All Agents by Revenue ({topAgents.length})
          </h3>
          {topAgents.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No agent data.</p>
          ) : (
            <div className="space-y-2.5">
              {topAgents.map(([name, amount], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-6 text-right text-xs text-[var(--text-muted)]">{i + 1}</span>
                  <div className="flex-1">
                    <BarRow label={name} value={formatCurrency(amount)} pct={amount / (topAgents[0]?.[1] || 1)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'types' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revenue Breakdown by Type</h3>
          {byType.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No type data.</p>
          ) : (
            <>
              {/* Visual breakdown bars */}
              <div className="mb-6 flex h-4 overflow-hidden rounded-full">
                {byType.map(([type, amount]) => {
                  const pct = (amount / stats.totalAmount) * 100
                  if (pct < 1) return null
                  return (
                    <div
                      key={type}
                      className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${pct}%`, backgroundColor: 'var(--portal)', opacity: 1 - (byType.indexOf([type, amount] as never) * 0.1) }}
                      title={`${type}: ${formatCurrency(amount)} (${pct.toFixed(1)}%)`}
                    />
                  )
                })}
              </div>
              <div className="space-y-2">
                {byType.map(([type, amount]) => {
                  const pct = ((amount / stats.totalAmount) * 100).toFixed(1)
                  return (
                    <div key={type} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-4 py-3">
                      <span className="text-sm text-[var(--text-secondary)]">{type}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)]">{pct}%</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(amount)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'comp-grids' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Comp Grids</h3>
          {cgLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : compGrids.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">grid_on</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No comp grid data migrated yet.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Comp grids will appear here once the data is migrated from GAS.</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="pb-2 pr-4">Carrier</th>
                    <th className="pb-2 pr-4">Product Type</th>
                    <th className="pb-2 pr-4">Level</th>
                    <th className="pb-2 pr-4">Rate</th>
                    <th className="pb-2">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {compGrids.map((cg) => (
                    <tr key={cg._id} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2.5 pr-4 font-medium text-[var(--text-primary)]">{cg.carrier_name || cg.carrier_id || '-'}</td>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{cg.product_type || '-'}</td>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{cg.level || '-'}</td>
                      <td className="py-2.5 pr-4 text-[var(--text-primary)]">{cg.rate != null ? `${(cg.rate * 100).toFixed(1)}%` : '-'}</td>
                      <td className="py-2.5 text-[var(--text-muted)]">{cg.effective_date || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'projections' && projections && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Commission Projections</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Estimated commissions based on current total revenue ({formatCurrency(stats.totalAmount)}).
              FYC rate: 5% | Renewal rate: 2%
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-[var(--bg-surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">FYC Estimate</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{formatCurrency(projections.fycEstimate)}</p>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Renewal Year 1</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{formatCurrency(projections.renewalYear1)}</p>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Renewal Year 2</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{formatCurrency(projections.renewalYear2)}</p>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Renewal Year 3</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{formatCurrency(projections.renewalYear3)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revenue by Period</h3>
          {byPeriod.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No period data available.</p>
          ) : (
            <div className="space-y-2.5">
              {byPeriod.map(([period, amount]) => (
                <BarRow
                  key={period}
                  label={period}
                  value={formatCurrency(amount)}
                  pct={amount / (Math.max(...byPeriod.map(([, a]) => a)) || 1)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
