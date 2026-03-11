'use client'

import { useMemo, useState } from 'react'
import { query, orderBy, limit, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

/* ─── Stable query references ─── */
const clientsQuery: Query<DocumentData> = query(collections.clients())
const opportunitiesQuery: Query<DocumentData> = query(collections.opportunities())
const revenueQuery: Query<DocumentData> = query(collections.revenue())
const campaignsQuery: Query<DocumentData> = query(collections.campaigns())
const caseTasksQuery: Query<DocumentData> = query(collections.caseTasks())
const usersQuery: Query<DocumentData> = query(collections.users())
const pipelinesQuery: Query<DocumentData> = query(collections.pipelines())
const agentsQuery: Query<DocumentData> = query(collections.agents())
const activitiesQuery: Query<DocumentData> = query(collections.activities(), orderBy('created_at', 'desc'), limit(20))

interface ClientRecord { _id: string; account_types?: string[]; created_at?: string; status?: string }
interface OppRecord { _id: string; stage?: string; status?: string; deal_value?: number; estimated_value?: number; created_at?: string }
interface RevenueRecord { _id: string; total_premium?: number; premium?: number; amount?: number; created_at?: string }
interface CampaignRecord { _id: string; status?: string; created_at?: string }
interface TaskRecord { _id: string; status?: string; due_date?: string; priority?: string }
interface UserRecord { _id: string; display_name?: string; status?: string }
interface PipelineRecord { _id: string; status?: string; created_at?: string }
interface AgentRecord { _id: string; status?: string; created_at?: string }
interface ActivityRecord { _id: string; action?: string; entity_type?: string; entity_id?: string; user_name?: string; created_at?: string; description?: string }

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function getThisMonthCount(items: Array<{ created_at?: string }>): number {
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  return items.filter((item) => {
    if (!item.created_at) return false
    const d = new Date(item.created_at)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }).length
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default function DashboardPage() {
  const { data: clients, loading: clientsLoading } = useCollection<ClientRecord>(clientsQuery, 'dash-clients')
  const { data: opportunities, loading: oppsLoading } = useCollection<OppRecord>(opportunitiesQuery, 'dash-opps')
  const { data: revenue, loading: revLoading } = useCollection<RevenueRecord>(revenueQuery, 'dash-revenue')
  const { data: campaigns, loading: campLoading } = useCollection<CampaignRecord>(campaignsQuery, 'dash-campaigns')
  const { data: tasks, loading: tasksLoading } = useCollection<TaskRecord>(caseTasksQuery, 'dash-tasks')
  const { data: users, loading: usersLoading } = useCollection<UserRecord>(usersQuery, 'dash-users')
  const { data: pipelineInstances, loading: pipLoading } = useCollection<PipelineRecord>(pipelinesQuery, 'dash-pipelines')
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'dash-agents')
  const { data: activities, loading: activitiesLoading } = useCollection<ActivityRecord>(activitiesQuery, 'dash-activities')

  const stats = useMemo(() => {
    const totalRevenue = revenue.reduce((sum, r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      return sum + (isNaN(amount) ? 0 : amount)
    }, 0)

    const accountCount = clients.reduce((sum, c) => sum + (c.account_types?.length || 0), 0)

    const newClientsThisMonth = getThisMonthCount(clients)
    const newAgentsThisMonth = getThisMonthCount(agents)
    const revenueThisMonth = revenue
      .filter((r) => {
        if (!r.created_at) return false
        const d = new Date(r.created_at)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, r) => sum + Number(r.total_premium || r.premium || r.amount || 0), 0)

    const openOpps = opportunities.filter((o) => {
      const s = (o.stage || o.status || '').toLowerCase()
      return !s.includes('closed') && !s.includes('won') && !s.includes('lost')
    }).length

    const wonThisMonth = opportunities.filter((o) => {
      const s = (o.stage || o.status || '').toLowerCase()
      if (!s.includes('won')) return false
      if (!o.created_at) return false
      const d = new Date(o.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    const conversionRate = opportunities.length > 0
      ? Math.round((opportunities.filter((o) => (o.stage || o.status || '').toLowerCase().includes('won')).length / opportunities.length) * 100)
      : 0

    const activeCampaigns = campaigns.filter((c) => (c.status || '').toLowerCase() === 'active').length

    const openTasks = tasks.filter((t) => t.status !== 'completed').length
    const overdueTasks = tasks.filter((t) => {
      if (!t.due_date || t.status === 'completed') return false
      return new Date(t.due_date) < new Date()
    }).length
    const completedTasks = tasks.filter((t) => t.status === 'completed').length
    const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

    const activePipelines = pipelineInstances.filter((p) => (p.status || '').toLowerCase() === 'active').length
    const completedPipelinesThisMonth = pipelineInstances.filter((p) => {
      if ((p.status || '').toLowerCase() !== 'completed') return false
      if (!p.created_at) return false
      const d = new Date(p.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    const activeAgents = agents.filter((a) => (a.status || '').toLowerCase() === 'active').length

    return {
      totalRevenue, accountCount, newClientsThisMonth, newAgentsThisMonth,
      revenueThisMonth, openOpps, wonThisMonth, conversionRate,
      activeCampaigns, openTasks, overdueTasks, completionRate,
      activePipelines, completedPipelinesThisMonth, activeAgents,
    }
  }, [clients, opportunities, revenue, campaigns, tasks, pipelineInstances, agents])

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Cross-platform view of all RPI operations</p>
      </div>

      {/* Widget Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard
          icon="people" label="Clients" href="/dashboard"
          value={clients.length} loading={clientsLoading}
          detail={`+${stats.newClientsThisMonth} this month`}
          sub={`${stats.accountCount.toLocaleString()} accounts`}
          trend={stats.newClientsThisMonth > 0 ? 'up' : 'flat'}
        />
        <WidgetCard
          icon="trending_up" label="Opportunities" href="/dashboard"
          value={stats.openOpps} loading={oppsLoading}
          detail={`${stats.wonThisMonth} won this month`}
          sub={`${stats.conversionRate}% conversion`}
          trend={stats.wonThisMonth > 0 ? 'up' : 'flat'}
        />
        <WidgetCard
          icon="payments" label="Revenue" href="/modules/cam"
          value={formatCurrency(stats.totalRevenue)} loading={revLoading}
          detail={`+${formatCurrency(stats.revenueThisMonth)} this month`}
          sub={`${revenue.length.toLocaleString()} records`}
          trend={stats.revenueThisMonth > 0 ? 'up' : 'flat'}
          isText
        />
        <WidgetCard
          icon="campaign" label="Campaigns" href="/modules/c3"
          value={campaigns.length} loading={campLoading}
          detail={`${stats.activeCampaigns} active`}
          trend="flat"
        />
        <WidgetCard
          icon="task_alt" label="Tasks" href="/tasks"
          value={stats.openTasks} loading={tasksLoading}
          detail={stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : 'None overdue'}
          sub={`${stats.completionRate}% completed`}
          trend={stats.overdueTasks > 0 ? 'down' : 'up'}
        />
        <WidgetCard
          icon="groups" label="Team" href="/org-admin"
          value={users.length} loading={usersLoading}
          detail="Active members"
          trend="flat"
        />
        <WidgetCard
          icon="route" label="Pipelines" href="/pipelines"
          value={stats.activePipelines} loading={pipLoading}
          detail={`${stats.completedPipelinesThisMonth} completed this month`}
          sub={`${pipelineInstances.length} total instances`}
          trend={stats.completedPipelinesThisMonth > 0 ? 'up' : 'flat'}
        />
        <WidgetCard
          icon="support_agent" label="Agents" href="/dashboard"
          value={stats.activeAgents} loading={agentsLoading}
          detail={`+${stats.newAgentsThisMonth} this month`}
          sub={`${agents.length} total`}
          trend={stats.newAgentsThisMonth > 0 ? 'up' : 'flat'}
        />
      </div>

      {/* Quick Actions Row */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'New Task', icon: 'add_task', href: '/tasks' },
            { label: 'View Approvals', icon: 'approval', href: '/pipelines' },
            { label: 'Commission Dashboard', icon: 'payments', href: '/modules/cam' },
            { label: 'Check Intake Queue', icon: 'inbox', href: '/modules/atlas' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>{action.icon}</span>
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* Bottom Section: Platform Health + Activity Feed */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Health */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Platform Health</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Data source status indicators</p>
          <div className="mt-4 space-y-3">
            <HealthIndicator label="Clients" status={clientsLoading ? 'loading' : clients.length > 0 ? 'green' : 'yellow'} detail={`${clients.length} records`} />
            <HealthIndicator label="Revenue" status={revLoading ? 'loading' : revenue.length > 0 ? 'green' : 'yellow'} detail={`${revenue.length} records`} />
            <HealthIndicator label="Opportunities" status={oppsLoading ? 'loading' : opportunities.length > 0 ? 'green' : 'yellow'} detail={`${opportunities.length} records`} />
            <HealthIndicator label="Agents" status={agentsLoading ? 'loading' : agents.length > 0 ? 'green' : 'yellow'} detail={`${agents.length} records`} />
            <HealthIndicator label="Tasks" status={tasksLoading ? 'loading' : 'green'} detail={`${tasks.length} tasks`} />
            <HealthIndicator label="Pipelines" status={pipLoading ? 'loading' : 'green'} detail={`${pipelineInstances.length} instances`} />
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Latest actions across the platform</p>
          <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto">
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">history</span>
                <p className="mt-2 text-xs text-[var(--text-muted)]">No recent activity</p>
              </div>
            ) : (
              activities.map((a) => (
                <div key={a._id} className="flex items-start gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                  <span className="material-icons-outlined mt-0.5" style={{ fontSize: '16px', color: 'var(--portal)' }}>
                    {a.entity_type === 'client' ? 'person' : a.entity_type === 'task' ? 'task_alt' : 'bolt'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {a.description || `${a.action || 'Action'} on ${a.entity_type || 'record'}`}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {a.user_name && `${a.user_name} · `}{relativeTime(a.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function WidgetCard({ icon, label, href, value, loading, detail, sub, trend, isText }: {
  icon: string; label: string; href: string; value: number | string; loading: boolean
  detail?: string; sub?: string; trend?: 'up' | 'down' | 'flat'; isText?: boolean
}) {
  const trendIcon = trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat'
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : 'var(--text-muted)'

  return (
    <a
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--portal-glow)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>{icon}</span>
        </span>
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: trendColor }}>{trendIcon}</span>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-[var(--bg-surface)]" />
        ) : (
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {isText ? value : typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{label}</p>
      </div>
      {detail && (
        <p className="text-xs text-[var(--text-muted)]">{detail}</p>
      )}
      {sub && (
        <p className="-mt-1 text-[10px] text-[var(--text-muted)]">{sub}</p>
      )}
    </a>
  )
}

function HealthIndicator({ label, status, detail }: {
  label: string; status: 'green' | 'yellow' | 'red' | 'loading'; detail: string
}) {
  const colors = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    loading: 'var(--text-muted)',
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {status === 'loading' ? (
          <div className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: colors.loading }} />
        ) : (
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[status] }} />
        )}
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-xs text-[var(--text-muted)]">{detail}</span>
    </div>
  )
}
