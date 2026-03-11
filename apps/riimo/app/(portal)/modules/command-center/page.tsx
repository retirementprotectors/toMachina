'use client'

import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const clientsQuery: Query<DocumentData> = query(collections.clients())
const oppsQuery: Query<DocumentData> = query(collections.opportunities())
const revenueQuery: Query<DocumentData> = query(collections.revenue())
const tasksQuery: Query<DocumentData> = query(collections.caseTasks())
const usersQuery: Query<DocumentData> = query(collections.users())

interface MetricCardProps {
  label: string
  value: string
  icon: string
  loading: boolean
}

function MetricCard({ label, value, icon, loading }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-3">
        <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>{icon}</span>
        <div>
          {loading ? (
            <div className="h-7 w-12 animate-pulse rounded bg-[var(--bg-surface)]" />
          ) : (
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
          )}
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default function CommandCenterPage() {
  const { data: clients, loading: cLoad } = useCollection(clientsQuery, 'cc-clients')
  const { data: opps, loading: oLoad } = useCollection(oppsQuery, 'cc-opps')
  const { data: revenue, loading: rLoad } = useCollection(revenueQuery, 'cc-revenue')
  const { data: tasks, loading: tLoad } = useCollection(tasksQuery, 'cc-tasks')
  const { data: users, loading: uLoad } = useCollection(usersQuery, 'cc-users')

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Command Center</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Leadership visibility dashboard</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total Clients" value={clients.length.toLocaleString()} icon="people" loading={cLoad} />
        <MetricCard label="Open Opportunities" value={opps.length.toLocaleString()} icon="trending_up" loading={oLoad} />
        <MetricCard label="Revenue Records" value={revenue.length.toLocaleString()} icon="payments" loading={rLoad} />
        <MetricCard label="Active Tasks" value={tasks.length.toLocaleString()} icon="task_alt" loading={tLoad} />
        <MetricCard label="Team Size" value={users.length.toLocaleString()} icon="groups" loading={uLoad} />
      </div>

      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-12">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">speed</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Advanced leadership analytics, KPI tracking, and team performance dashboards — coming soon.
        </p>
      </div>
    </div>
  )
}
