'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const revenueQuery: Query<DocumentData> = query(collections.revenue())

interface RevenueRecord {
  _id: string
  agent_name?: string
  carrier_name?: string
  product_type?: string
  premium?: number
  total_premium?: number
  amount?: number
  commission_type?: string
  source?: string
}

export default function CamPage() {
  const { data: revenue, loading, error } = useCollection<RevenueRecord>(revenueQuery, 'sentinel-cam-revenue')

  const stats = useMemo(() => {
    if (loading) return { total: 0, count: 0, carriers: new Set<string>() }
    let total = 0
    const carriers = new Set<string>()
    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (!isNaN(amount)) total += amount
      if (r.carrier_name) carriers.add(r.carrier_name)
    })
    return { total, count: revenue.length, carriers }
  }, [revenue, loading])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM — DAVID Suite</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM — DAVID Suite</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load revenue data: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM — DAVID Suite</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Commission accounting filtered to DAVID operations</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Revenue Records</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stats.count.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Premium</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">${stats.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Unique Carriers</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stats.carriers.size}</p>
        </div>
      </div>
    </div>
  )
}
