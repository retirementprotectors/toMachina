'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@tomachina/core'

/**
 * Learning Loop Admin Dashboard — TRK-14179
 * JDM-only admin view for session intelligence pipeline health.
 *
 * 6 sections: Pipeline Health, Knowledge Entries, Warriors,
 * VOLTRON Gaps, Recent Entries, Confidence Distribution.
 */

interface KnowledgeStats {
  total: number
  by_type: Record<string, number>
  by_confidence: { high: number; medium: number; low: number }
  promoted_count: number
  recent_entries: Array<{ id: string; type: string; content: string; confidence: number; created_at: string }>
}

interface VoltronGap {
  content: string
  question_count: number
  detected_topics: string[]
  created_at: string
}

interface WarriorSummary {
  name: string
  status: string
  type: string
  last_brain_update: string | null
}

interface DashboardData {
  knowledge_entries: KnowledgeStats
  voltron_gaps: VoltronGap[]
  warriors: WarriorSummary[]
  pipeline_health: Record<string, string>
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-green-500' : status === 'dormant' ? 'bg-yellow-500' : 'bg-gray-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-2`} />
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 0.85 ? 'text-green-400' : value >= 0.7 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`font-mono text-xs ${color}`}>{value.toFixed(2)}</span>
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    decision: 'bg-blue-500/20 text-blue-400',
    pattern: 'bg-purple-500/20 text-purple-400',
    insight: 'bg-yellow-500/20 text-yellow-400',
    violation: 'bg-red-500/20 text-red-400',
    architecture: 'bg-cyan-500/20 text-cyan-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${colors[type] || 'bg-gray-500/20 text-gray-400'}`}>
      {type}
    </span>
  )
}

export default function LearningLoopPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiFetch('/api/admin/learning-loop')
      if (result.success && result.data) {
        setData(result.data as DashboardData)
      } else {
        setError(result.error || 'Failed to load dashboard')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-4xl text-[var(--portal)]">progress_activity</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error || 'No data available'}
        </div>
      </div>
    )
  }

  const { knowledge_entries: ke, voltron_gaps, warriors, pipeline_health } = data

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="material-symbols-outlined text-3xl text-[var(--portal)]">neurology</span>
        <div>
          <h1 className="text-2xl font-bold">Learning Loop</h1>
          <p className="text-sm text-muted-foreground">Session Intelligence Pipeline Dashboard</p>
        </div>
      </div>

      {/* Row 1: Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Entries</div>
          <div className="text-3xl font-bold">{ke.total}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Promoted</div>
          <div className="text-3xl font-bold text-green-400">{ke.promoted_count}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">High Confidence</div>
          <div className="text-3xl font-bold text-blue-400">{ke.by_confidence.high}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">VOLTRON Gaps</div>
          <div className="text-3xl font-bold text-yellow-400">{voltron_gaps.length}</div>
        </div>
      </div>

      {/* Row 2: Pipeline Health + Warriors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline Health */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-400">monitoring</span>
            Pipeline Health
          </h2>
          <div className="space-y-2">
            {Object.entries(pipeline_health).map(([name, schedule]) => (
              <div key={name} className="flex justify-between items-center py-1 border-b border-border last:border-0">
                <span className="text-sm font-mono">{name.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground">{schedule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warriors */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400">group</span>
            Warrior Registry
          </h2>
          <div className="space-y-2">
            {warriors.map((w) => (
              <div key={w.name} className="flex justify-between items-center py-1 border-b border-border last:border-0">
                <span className="text-sm font-medium">
                  <StatusDot status={w.status} />
                  {w.name}
                </span>
                <span className="text-xs text-muted-foreground">{w.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Entry Types + VOLTRON Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Entry Distribution */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">analytics</span>
            Entry Distribution
          </h2>
          <div className="space-y-2">
            {Object.entries(ke.by_type).sort(([,a], [,b]) => b - a).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center py-1">
                <TypeBadge type={type} />
                <span className="text-sm font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* VOLTRON Gaps */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-400">lightbulb</span>
            VOLTRON Knowledge Gaps
          </h2>
          {voltron_gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gaps detected</p>
          ) : (
            <div className="space-y-3">
              {voltron_gaps.map((gap, i) => (
                <div key={i} className="border-l-2 border-yellow-500/50 pl-3">
                  <div className="text-sm">{gap.content}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {gap.question_count} questions &middot; {gap.detected_topics.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent Entries */}
      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400">history</span>
          Recent Knowledge Entries
        </h2>
        <div className="space-y-2">
          {ke.recent_entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <TypeBadge type={entry.type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{entry.content}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(entry.created_at).toLocaleDateString()}
                </div>
              </div>
              <ConfidenceBadge value={entry.confidence} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
