'use client'

import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const agentsQuery: Query<DocumentData> = query(collections.agents())
const oppsQuery: Query<DocumentData> = query(collections.opportunities())
const revenueQuery: Query<DocumentData> = query(collections.revenue())

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
  const { data: agents, loading: aLoad } = useCollection(agentsQuery, 'sentinel-cc-agents')
  const { data: opps, loading: oLoad } = useCollection(oppsQuery, 'sentinel-cc-opps')
  const { data: revenue, loading: rLoad } = useCollection(revenueQuery, 'sentinel-cc-revenue')

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Command Center</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">DAVID operations leadership dashboard</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Producers" value={agents.length.toLocaleString()} icon="people" loading={aLoad} />
        <MetricCard label="Opportunities" value={opps.length.toLocaleString()} icon="trending_up" loading={oLoad} />
        <MetricCard label="Revenue Records" value={revenue.length.toLocaleString()} icon="payments" loading={rLoad} />
      </div>

      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-12">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">speed</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Advanced DAVID analytics, deal pipeline KPIs, and partnership performance tracking — coming soon.
        </p>
      </div>
    </div>
  )
}
