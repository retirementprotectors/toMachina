'use client'

import { useState, useEffect, useCallback } from 'react'

// Types matching API response shapes
interface WireAnalytics {
  wire_id: string
  wire_name: string
  total_runs: number
  success_count: number
  failure_count: number
  avg_duration_ms: number
  last_run_at: string | null
  last_error: string | null
  weekly_counts: number[]
}

interface SourceHealthSummary {
  total: number
  green: number
  yellow: number
  red: number
  gray: number
  health_pct: number
}

interface GapItem {
  type: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  suggested_action: string
  related_entity?: string
}

interface DashboardData {
  wires: WireAnalytics[]
  sources: SourceHealthSummary
  gaps: GapItem[]
  total_runs: number
  total_success: number
  total_failures: number
  checked_at: string
}

/**
 * MEGAZORD CIO Dashboard — Wire Execution Analytics
 * ZRD-D11: Real-time view of wire frequency, success rates, error trends,
 * source health, and gap identification.
 */
export function MegazordDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<string>('')

  const fetchData = useCallback(async () => {
    try {
      // Fetch from multiple API endpoints in parallel
      const [healthRes, analyticsRes, gapsRes] = await Promise.allSettled([
        fetch('/api/atlas/health'),
        fetch('/api/atlas/execution-analytics'),
        fetch('/api/atlas/gaps'),
      ])

      const healthData = healthRes.status === 'fulfilled' ? await healthRes.value.json() : null
      const analyticsData = analyticsRes.status === 'fulfilled' ? await analyticsRes.value.json() : null
      const gapsData = gapsRes.status === 'fulfilled' ? await gapsRes.value.json() : null

      // Build dashboard data from whatever succeeded
      const wires: WireAnalytics[] = analyticsData?.data?.wires || []
      const sources: SourceHealthSummary = healthData?.data?.sources
        ? {
            total: healthData.data.sources.total ?? 0,
            green: healthData.data.sources.green ?? 0,
            yellow: healthData.data.sources.yellow ?? 0,
            red: healthData.data.sources.red ?? 0,
            gray: healthData.data.sources.gray ?? 0,
            health_pct: healthData.data.source_health_pct ?? 0,
          }
        : { total: 0, green: 0, yellow: 0, red: 0, gray: 0, health_pct: 0 }
      const gaps: GapItem[] = gapsData?.data?.gaps || []

      setData({
        wires,
        sources,
        gaps,
        total_runs: analyticsData?.data?.total_runs || 0,
        total_success: analyticsData?.data?.total_success || 0,
        total_failures: analyticsData?.data?.total_failures || 0,
        checked_at: new Date().toISOString(),
      })
      setLastRefresh(new Date().toLocaleTimeString())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Auto-refresh every 60s
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground">Loading MEGAZORD dashboard...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const successRate = data.total_runs > 0
    ? Math.round((data.total_success / data.total_runs) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">MEGAZORD — CIO Dashboard</h2>
          <p className="text-sm text-muted-foreground">Wire execution analytics &amp; source health</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Last refresh: {lastRefresh}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Runs" value={data.total_runs} />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          color={successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red'}
        />
        <StatCard
          label="Source Health"
          value={`${data.sources.health_pct}%`}
          color={data.sources.health_pct >= 80 ? 'green' : data.sources.health_pct >= 50 ? 'yellow' : 'red'}
        />
        <StatCard
          label="Active Gaps"
          value={data.gaps.filter(g => g.severity === 'critical').length}
          color={data.gaps.filter(g => g.severity === 'critical').length === 0 ? 'green' : 'red'}
        />
      </div>

      {/* Source Health Breakdown */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Source Registry Health</h3>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            GREEN: {data.sources.green}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            YELLOW: {data.sources.yellow}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            RED: {data.sources.red}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            GRAY: {data.sources.gray}
          </span>
          <span className="ml-auto font-medium">Total: {data.sources.total}</span>
        </div>
      </div>

      {/* Wire Execution Table */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Wire Execution Summary</h3>
        {data.wires.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wire execution data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Wire</th>
                  <th className="pb-2 pr-4 font-medium text-right">Runs</th>
                  <th className="pb-2 pr-4 font-medium text-right">Success</th>
                  <th className="pb-2 pr-4 font-medium text-right">Failed</th>
                  <th className="pb-2 pr-4 font-medium text-right">Avg Duration</th>
                  <th className="pb-2 pr-4 font-medium">Last Run</th>
                  <th className="pb-2 font-medium">Last Error</th>
                </tr>
              </thead>
              <tbody>
                {data.wires.map((wire) => (
                  <tr key={wire.wire_id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium">{wire.wire_name}</td>
                    <td className="py-2 pr-4 text-right">{wire.total_runs}</td>
                    <td className="py-2 pr-4 text-right text-green-600">{wire.success_count}</td>
                    <td className="py-2 pr-4 text-right text-red-600">{wire.failure_count}</td>
                    <td className="py-2 pr-4 text-right">{formatDuration(wire.avg_duration_ms)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {wire.last_run_at ? formatRelativeTime(wire.last_run_at) : '—'}
                    </td>
                    <td className="py-2 text-red-500 text-xs max-w-[200px] truncate">
                      {wire.last_error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gap Report */}
      {data.gaps.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Active Gaps</h3>
          <div className="space-y-2">
            {data.gaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-3 text-sm p-2 rounded bg-muted/50">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  gap.severity === 'critical' ? 'bg-red-500' :
                  gap.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div className="min-w-0">
                  <div className="font-medium">{gap.type.replace(/_/g, ' ')}</div>
                  <div className="text-muted-foreground">{gap.description}</div>
                  <div className="text-xs mt-1 text-muted-foreground">Action: {gap.suggested_action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: 'green' | 'yellow' | 'red'
}) {
  const colorClass =
    color === 'green' ? 'text-green-600' :
    color === 'yellow' ? 'text-yellow-600' :
    color === 'red' ? 'text-red-600' : ''
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default MegazordDashboard
