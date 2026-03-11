'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const revenueQuery: Query<DocumentData> = query(collections.revenue())

interface RevenueRecord {
  _id: string
  revenue_id?: string
  agent_name?: string
  agent_id?: string
  carrier_name?: string
  product_type?: string
  premium?: number
  total_premium?: number
  amount?: number
  commission_type?: string
  period?: string
  status?: string
}

export default function CamPage() {
  const { data: revenue, loading, error } = useCollection<RevenueRecord>(revenueQuery, 'cam-revenue')

  const stats = useMemo(() => {
    if (loading) return { total: 0, byType: {} as Record<string, number>, byAgent: {} as Record<string, number> }

    let total = 0
    const byType: Record<string, number> = {}
    const byAgent: Record<string, number> = {}

    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (!isNaN(amount)) {
        total += amount
        const type = r.commission_type || r.product_type || 'Unknown'
        byType[type] = (byType[type] || 0) + amount
        const agent = r.agent_name || 'Unassigned'
        byAgent[agent] = (byAgent[agent] || 0) + amount
      }
    })

    return { total, byType, byAgent }
  }, [revenue, loading])

  const topAgents = useMemo(() => {
    return Object.entries(stats.byAgent)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
  }, [stats.byAgent])

  const topTypes = useMemo(() => {
    return Object.entries(stats.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
  }, [stats.byType])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM — Commission Accounting</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM — Commission Accounting</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load revenue: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM — Commission Accounting</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Revenue tracking and commission reconciliation</p>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Revenue Records</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{revenue.length.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Premium</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">${stats.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Unique Agents</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{Object.keys(stats.byAgent).length}</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Agents */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Top Agents by Premium</h2>
          <div className="mt-3 space-y-2">
            {topAgents.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No agent revenue data.</p>
            ) : (
              topAgents.map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)] truncate">{name}</span>
                  <span className="font-medium text-[var(--text-primary)]">${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By Type */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Revenue by Type</h2>
          <div className="mt-3 space-y-2">
            {topTypes.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No revenue type data.</p>
            ) : (
              topTypes.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)] truncate">{type}</span>
                  <span className="font-medium text-[var(--text-primary)]">${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
