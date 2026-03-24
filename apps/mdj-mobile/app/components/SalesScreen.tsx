'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuth } from 'firebase/auth'

interface PipelineItem {
  id: string
  client_name: string
  pipeline_name: string
  stage_name: string
  stage_index: number
  total_stages: number
  updated_at: string
  value?: number
}

interface SalesStats {
  active_cases: number
  pending_quotes: number
  closing_soon: number
  monthly_revenue: number
}

export function SalesScreen() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    const auth = getAuth()
    if (!auth.currentUser) return
    setLoading(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const headers = { Authorization: `Bearer ${token}` }

      const [pipelineRes, statsRes] = await Promise.all([
        fetch('/api/flow?view=my-active', { headers }),
        fetch('/api/dashboard/sales-stats', { headers }),
      ])

      if (pipelineRes.ok) {
        const pipelineData = await pipelineRes.json()
        if (pipelineData.success && Array.isArray(pipelineData.data)) {
          setPipeline(pipelineData.data)
        }
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        if (statsData.success && statsData.data) {
          setStats(statsData.data)
        }
      }
    } catch {
      // API not available yet — show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filters = ['all', 'nbx', 'sales', 'prospect']
  const filtered = activeFilter === 'all'
    ? pipeline
    : pipeline.filter((p) => p.pipeline_name.toLowerCase().includes(activeFilter))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 safe-top bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <h1 className="text-lg font-bold">Sales Dashboard</h1>
        <p className="text-[var(--text-muted)] text-xs">Your pipeline at a glance</p>
      </header>

      <div className="flex-1 overflow-y-auto scroll-smooth">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <StatCard
            label="Active Cases"
            value={stats?.active_cases ?? '—'}
            color="var(--info)"
            loading={loading}
          />
          <StatCard
            label="Pending Quotes"
            value={stats?.pending_quotes ?? '—'}
            color="var(--warning)"
            loading={loading}
          />
          <StatCard
            label="Closing Soon"
            value={stats?.closing_soon ?? '—'}
            color="var(--success)"
            loading={loading}
          />
          <StatCard
            label="Monthly Rev"
            value={stats?.monthly_revenue ? `$${(stats.monthly_revenue / 1000).toFixed(0)}K` : '—'}
            color="var(--mdj-purple)"
            loading={loading}
          />
        </div>

        {/* Pipeline Filters */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-colors
                ${activeFilter === f
                  ? 'bg-[var(--mdj-purple-glow)] text-[var(--mdj-purple)] border border-[var(--mdj-purple)]/30'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Pipeline Items */}
        <div className="px-4 py-2 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--bg-card)] animate-pulse border border-[var(--border)]" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--text-muted)] text-sm">No pipeline items yet.</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">
                Ask MDJ to check your pipeline status.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <PipelineCard key={item.id} item={item} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, loading }: {
  label: string
  value: string | number
  color: string
  loading: boolean
}) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
      <p className="text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-12 rounded bg-[var(--bg-surface)] animate-pulse" />
      ) : (
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      )}
    </div>
  )
}

function PipelineCard({ item }: { item: PipelineItem }) {
  const progress = ((item.stage_index + 1) / item.total_stages) * 100

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]
      active:bg-[var(--bg-card-hover)] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{item.client_name}</p>
          <p className="text-[var(--text-muted)] text-[11px]">{item.pipeline_name}</p>
        </div>
        {item.value && (
          <span className="text-xs font-semibold text-[var(--success)] shrink-0 ml-2">
            ${item.value.toLocaleString()}
          </span>
        )}
      </div>

      {/* Stage progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--mdj-purple)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-medium shrink-0">
          {item.stage_name}
        </span>
      </div>
    </div>
  )
}
