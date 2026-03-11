'use client'

import { useEffect, useState } from 'react'
import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore'
import { getDb } from '@tomachina/db'

function formatCurrency(raw: unknown): string {
  if (raw == null || raw === '') return '$0'
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  if (isNaN(num)) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
}

function str(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

interface RevenueSummary {
  totalRecords: number
  totalAmount: number
  byCarrier: Record<string, number>
  byAgent: Record<string, number>
  byType: Record<string, number>
}

export default function CamPage() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRevenue() {
      try {
        const db = getDb()
        const snap = await getDocs(query(collection(db, 'revenue'), limit(2500)))

        const result: RevenueSummary = {
          totalRecords: snap.size,
          totalAmount: 0,
          byCarrier: {},
          byAgent: {},
          byType: {},
        }

        snap.docs.forEach((doc) => {
          const d = doc.data()
          const amount = parseFloat(String(d.amount || d.commission_amount || d.revenue_amount || 0)) || 0
          result.totalAmount += amount

          const carrier = str(d.carrier_name || d.carrier || 'Unknown')
          result.byCarrier[carrier] = (result.byCarrier[carrier] || 0) + amount

          const agent = str(d.agent_name || d.writing_agent || 'Unknown')
          result.byAgent[agent] = (result.byAgent[agent] || 0) + amount

          const type = str(d.revenue_type || d.commission_type || d.product_type || 'Other')
          result.byType[type] = (result.byType[type] || 0) + amount
        })

        setSummary(result)
      } catch (err) {
        console.error('Failed to load revenue:', err)
      } finally {
        setLoading(false)
      }
    }
    loadRevenue()
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4">
        <div className="h-8 w-32 rounded bg-[var(--bg-surface)]" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--bg-card)]" />
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">payments</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">No revenue data available.</p>
        </div>
      </div>
    )
  }

  const topCarriers = Object.entries(summary.byCarrier).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topAgents = Object.entries(summary.byAgent).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const byType = Object.entries(summary.byType).sort((a, b) => b[1] - a[1])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Commission Accounting — Revenue intelligence from Firestore</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Revenue" value={formatCurrency(summary.totalAmount)} icon="payments" color="#10b981" />
        <StatCard label="Revenue Records" value={summary.totalRecords.toLocaleString()} icon="receipt_long" color="#3b82f6" />
        <StatCard label="Carriers" value={Object.keys(summary.byCarrier).length.toString()} icon="business" color="#a78bfa" />
      </div>

      {/* Top Carriers + Top Agents side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Carriers by Revenue</h3>
          <div className="space-y-2">
            {topCarriers.map(([name, amount]) => (
              <BarRow key={name} label={name} value={formatCurrency(amount)} pct={amount / (topCarriers[0]?.[1] || 1)} color="#3d8a8f" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top Agents by Revenue</h3>
          <div className="space-y-2">
            {topAgents.map(([name, amount]) => (
              <BarRow key={name} label={name} value={formatCurrency(amount)} pct={amount / (topAgents[0]?.[1] || 1)} color="#f59e0b" />
            ))}
          </div>
        </div>
      </div>

      {/* Revenue by Type */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
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
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <span className="material-icons-outlined" style={{ color, fontSize: '20px' }}>{icon}</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

function BarRow({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-[var(--text-secondary)]">{label}</span>
        <span className="ml-2 font-medium text-[var(--text-primary)]">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
