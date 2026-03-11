'use client'

import { useMemo } from 'react'
import { query, collection, where, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'

// ============================================================================
// Types
// ============================================================================

interface CommandCenterProps {
  portal: string
}

interface ClientRecord {
  _id: string
  client_status?: string
  created_at?: string
}

interface OpportunityRecord {
  _id: string
  stage?: string
  value?: number
  created_at?: string
  updated_at?: string
}

interface RevenueRecord {
  _id: string
  amount?: number
  commission_amount?: number
  revenue_amount?: number
  total_premium?: number
  premium?: number
  period?: string
  created_at?: string
}

interface CampaignRecord {
  _id: string
  status?: string
}

interface CaseTaskRecord {
  _id: string
  status?: string
  assigned_to?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
}

interface UserRecord {
  _id: string
  status?: string
}

interface AgentRecord {
  _id: string
  agent_status?: string
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num)
}

function parseAmount(r: RevenueRecord): number {
  const raw = r.amount ?? r.commission_amount ?? r.revenue_amount ?? r.total_premium ?? r.premium ?? 0
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  return isNaN(num) ? 0 : num
}

function daysSince(dateStr?: string): number {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return Infinity
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

// ============================================================================
// Sub-components
// ============================================================================

function MetricCard({ label, value, icon, loading, trend }: {
  label: string; value: string; icon: string; loading: boolean; trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[var(--border-medium)]">
      <div className="flex items-center gap-3">
        <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>{icon}</span>
        <div className="flex-1">
          {loading ? (
            <div className="h-7 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
              {trend && trend !== 'flat' && (
                <span
                  className="material-icons-outlined"
                  style={{
                    fontSize: '16px',
                    color: trend === 'up' ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {trend === 'up' ? 'trending_up' : 'trending_down'}
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CommandCenter({ portal }: CommandCenterProps) {
  // Queries — all lightweight collection loads
  const clientsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'clients')), [])
  const oppsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'opportunities')), [])
  const revenueQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'revenue')), [])
  const campaignsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'campaigns')), [])
  const tasksQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'case_tasks')), [])
  const usersQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'users')), [])
  const agentsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'agents')), [])

  const { data: clients, loading: cLoad } = useCollection<ClientRecord>(clientsQ, 'cc-clients')
  const { data: opps, loading: oLoad } = useCollection<OpportunityRecord>(oppsQ, 'cc-opps')
  const { data: revenue, loading: rLoad } = useCollection<RevenueRecord>(revenueQ, 'cc-revenue')
  const { data: campaigns, loading: campLoad } = useCollection<CampaignRecord>(campaignsQ, 'cc-campaigns')
  const { data: tasks, loading: tLoad } = useCollection<CaseTaskRecord>(tasksQ, 'cc-tasks')
  const { data: users, loading: uLoad } = useCollection<UserRecord>(usersQ, 'cc-users')
  const { data: agents, loading: aLoad } = useCollection<AgentRecord>(agentsQ, 'cc-agents')

  // Opportunity stats
  const oppStats = useMemo(() => {
    const open = opps.filter((o) => !['Won', 'Lost', 'Closed'].includes(o.stage || ''))
    const won = opps.filter((o) => o.stage === 'Won')
    const lost = opps.filter((o) => o.stage === 'Lost')
    const byStage: Record<string, number> = {}
    open.forEach((o) => {
      const stage = o.stage || 'Unknown'
      byStage[stage] = (byStage[stage] || 0) + 1
    })
    return { open: open.length, won: won.length, lost: lost.length, byStage }
  }, [opps])

  // Revenue total
  const totalRevenue = useMemo(() => {
    return revenue.reduce((sum, r) => sum + parseAmount(r), 0)
  }, [revenue])

  // Monthly revenue trend
  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, number> = {}
    revenue.forEach((r) => {
      const period = r.period || ''
      if (period) {
        byMonth[period] = (byMonth[period] || 0) + parseAmount(r)
      }
    })
    const sorted = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]))
    return sorted.slice(-6) // last 6 periods
  }, [revenue])

  // Active campaigns count
  const activeCampaigns = useMemo(() =>
    campaigns.filter((c) => c.status?.toLowerCase() === 'active').length,
    [campaigns]
  )

  // Open tasks
  const openTasks = useMemo(() =>
    tasks.filter((t) => !['Complete', 'Completed', 'Closed'].includes(t.status || '')).length,
    [tasks]
  )

  // Recent task completions
  const recentCompletions = useMemo(() => {
    return tasks
      .filter((t) => ['Complete', 'Completed'].includes(t.status || ''))
      .filter((t) => daysSince(t.updated_at || t.completed_at) <= 7)
      .slice(0, 5)
  }, [tasks])

  // Trend: compare items created in last 30d vs previous 30d
  function getTrend(items: Array<{ created_at?: string }>): 'up' | 'down' | 'flat' {
    const recent = items.filter((i) => daysSince(i.created_at) <= 30).length
    const older = items.filter((i) => { const d = daysSince(i.created_at); return d > 30 && d <= 60 }).length
    if (recent > older) return 'up'
    if (recent < older) return 'down'
    return 'flat'
  }

  const anyLoading = cLoad || oLoad || rLoad || campLoad || tLoad || uLoad || aLoad

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Command Center</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Cross-platform leadership visibility</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Clients" value={clients.length.toLocaleString()} icon="people" loading={cLoad} trend={!cLoad ? getTrend(clients) : undefined} />
        <MetricCard label="Open Opportunities" value={oppStats.open.toLocaleString()} icon="trending_up" loading={oLoad} />
        <MetricCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon="payments" loading={rLoad} />
        <MetricCard label="Active Campaigns" value={activeCampaigns.toLocaleString()} icon="campaign" loading={campLoad} />
        <MetricCard label="Open Tasks" value={openTasks.toLocaleString()} icon="task_alt" loading={tLoad} />
        <MetricCard label="Team Members" value={users.length.toLocaleString()} icon="groups" loading={uLoad} />
        <MetricCard label="Agents" value={agents.length.toLocaleString()} icon="badge" loading={aLoad} />
        <MetricCard label="Won/Lost" value={!oLoad ? `${oppStats.won}/${oppStats.lost}` : '-'} icon="emoji_events" loading={oLoad} />
      </div>

      {/* Pipeline Health + Team Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pipeline Health */}
        <SectionCard title="Pipeline Health" icon="funnel">
          {oLoad ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : Object.keys(oppStats.byStage).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No open deals.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(oppStats.byStage)
                .sort((a, b) => b[1] - a[1])
                .map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">{stage}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(5, (count / oppStats.open) * 100)}%`,
                            backgroundColor: 'var(--portal)',
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-medium text-[var(--text-primary)]">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>

        {/* Team Activity */}
        <SectionCard title="Recent Completions" icon="check_circle">
          {tLoad ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : recentCompletions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No tasks completed in the last 7 days.</p>
          ) : (
            <div className="space-y-2">
              {recentCompletions.map((t) => (
                <div key={t._id} className="flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                  <span className="material-icons-outlined text-[var(--success)]" style={{ fontSize: '16px' }}>check_circle</span>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">{t._id}</p>
                    {t.assigned_to && <p className="text-xs text-[var(--text-muted)]">{t.assigned_to}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Revenue Trend */}
      <SectionCard title="Revenue by Period" icon="show_chart">
        {rLoad ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          </div>
        ) : monthlyTrend.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No period data available.</p>
        ) : (
          <div className="space-y-2">
            {monthlyTrend.map(([period, amount]) => {
              const maxAmount = Math.max(...monthlyTrend.map(([, a]) => a))
              return (
                <div key={period} className="flex items-center gap-3">
                  <span className="w-20 text-right text-xs text-[var(--text-muted)]">{period}</span>
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded bg-[var(--bg-surface)]">
                      <div
                        className="flex h-full items-center rounded px-2 text-xs font-medium text-white"
                        style={{
                          width: `${Math.max(5, (amount / maxAmount) * 100)}%`,
                          backgroundColor: 'var(--portal)',
                        }}
                      >
                        {formatCurrency(amount)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Quick Actions */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: 'people', label: 'View Clients', href: '/clients' },
            { icon: 'trending_up', label: 'View Pipelines', href: '/pipelines' },
            { icon: 'payments', label: 'View Revenue', href: '/modules/cam' },
            { icon: 'task_alt', label: 'View Tasks', href: '/casework' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{action.icon}</span>
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* Platform Health */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center gap-2">
          {anyLoading ? (
            <>
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--warning)]" />
              <span className="text-sm text-[var(--warning)]">Loading collections...</span>
            </>
          ) : (
            <>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-sm text-emerald-400">All systems operational</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
