'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
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

interface SummaryCardProps {
  label: string
  count: number
  icon: string
  loading: boolean
  href: string
  subtitle?: string
}

function SummaryCard({ label, count, icon, loading, href, subtitle }: SummaryCardProps) {
  return (
    <a
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: 'var(--portal-glow)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '22px', color: 'var(--portal)' }}>
            {icon}
          </span>
        </span>
        <span className="material-icons-outlined text-sm text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5">
          arrow_forward
        </span>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
        ) : (
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {count.toLocaleString()}
          </p>
        )}
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{label}</p>
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
    </a>
  )
}

export default function DashboardPage() {
  const { data: clients, loading: clientsLoading } = useCollection(clientsQuery, 'dash-clients')
  const { data: opportunities, loading: oppsLoading } = useCollection(opportunitiesQuery, 'dash-opps')
  const { data: revenue, loading: revLoading } = useCollection(revenueQuery, 'dash-revenue')
  const { data: campaigns, loading: campLoading } = useCollection(campaignsQuery, 'dash-campaigns')
  const { data: tasks, loading: tasksLoading } = useCollection(caseTasksQuery, 'dash-tasks')
  const { data: users, loading: usersLoading } = useCollection(usersQuery, 'dash-users')
  const { data: pipelineInstances, loading: pipLoading } = useCollection(pipelinesQuery, 'dash-pipelines')
  const { data: agents, loading: agentsLoading } = useCollection(agentsQuery, 'dash-agents')

  /* Compute total revenue from revenue documents */
  const totalRevenue = useMemo(() => {
    if (revLoading) return 0
    return revenue.reduce((sum: number, r: Record<string, unknown>) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      return sum + (isNaN(amount) ? 0 : amount)
    }, 0)
  }, [revenue, revLoading])

  /* Count accounts from client data */
  const accountCount = useMemo(() => {
    return clients.reduce((sum: number, c: Record<string, unknown>) => {
      const types = c.account_types as string[] | undefined
      return sum + (types?.length || 0)
    }, 0)
  }, [clients])

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Cross-platform view of all RPI operations
        </p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Clients"
          count={clients.length}
          icon="people"
          loading={clientsLoading}
          href="/dashboard"
          subtitle={`${accountCount.toLocaleString()} accounts`}
        />
        <SummaryCard
          label="Opportunities"
          count={opportunities.length}
          icon="trending_up"
          loading={oppsLoading}
          href="/dashboard"
        />
        <SummaryCard
          label="Revenue Records"
          count={revenue.length}
          icon="payments"
          loading={revLoading}
          href="/modules/cam"
          subtitle={totalRevenue > 0 ? `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total` : undefined}
        />
        <SummaryCard
          label="Campaigns"
          count={campaigns.length}
          icon="campaign"
          loading={campLoading}
          href="/modules/c3"
        />
        <SummaryCard
          label="Tasks"
          count={tasks.length}
          icon="task_alt"
          loading={tasksLoading}
          href="/tasks"
        />
        <SummaryCard
          label="Team Members"
          count={users.length}
          icon="groups"
          loading={usersLoading}
          href="/org-admin"
        />
        <SummaryCard
          label="Pipeline Instances"
          count={pipelineInstances.length}
          icon="route"
          loading={pipLoading}
          href="/pipelines"
        />
        <SummaryCard
          label="Agents"
          count={agents.length}
          icon="support_agent"
          loading={agentsLoading}
          href="/dashboard"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'View Tasks', icon: 'task_alt', href: '/tasks' },
            { label: 'Team Structure', icon: 'account_tree', href: '/org-admin' },
            { label: 'Commission Dashboard', icon: 'payments', href: '/modules/cam' },
            { label: 'Campaign Manager', icon: 'campaign', href: '/modules/c3' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-secondary)] transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
                {action.icon}
              </span>
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
