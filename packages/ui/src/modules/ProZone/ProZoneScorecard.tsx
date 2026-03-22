'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'
import type { ScorecardData } from './types'

// ============================================================================
// ProZoneScorecard — Metric cards + segmented selectors
// ============================================================================

export interface ProZoneScorecardProps {
  specialistId: string
  timeline: string
  onTimelineChange: (t: string) => void
  teamFilter: string
  onTeamFilterChange: (t: string) => void
}

const TIMELINE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'Year' },
  { key: 'r12', label: 'R12' },
  { key: 'all', label: 'ALL' },
] as const

const TEAM_OPTIONS = [
  { key: 'COR', label: 'COR' },
  { key: 'AST', label: 'AST' },
  { key: 'SPC', label: 'SPC' },
  { key: 'ALL', label: 'ALL' },
] as const

const PIPELINE_OPTIONS = [
  { key: 'retirement', label: 'Retirement' },
  { key: 'medicare', label: 'Medicare' },
  { key: 'legacy', label: 'Legacy' },
  { key: 'ALL_PIPELINE', label: 'ALL' },
] as const

// ─── Segmented Button Group ───
function SegmentedGroup({
  options,
  activeKey,
  onSelect,
  brandColor,
}: {
  options: ReadonlyArray<{ key: string; label: string }>
  activeKey: string
  onSelect: (key: string) => void
  brandColor: string
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden"
      role="radiogroup"
    >
      {options.map((opt) => {
        const isActive = activeKey === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(opt.key)}
            className="px-3 py-1.5 text-xs font-medium transition-colors border-r border-[var(--border-subtle)] last:border-r-0"
            style={{
              background: isActive ? brandColor : 'var(--bg-surface)',
              color: isActive ? '#fff' : 'var(--text-muted)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Metric Card ───
function MetricCard({
  label,
  value,
  percentage,
  brandColor,
}: {
  label: string
  value: number
  percentage: number
  brandColor: string
}) {
  return (
    <div className="flex-1 min-w-[100px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      <p className="text-xs font-medium" style={{ color: brandColor }}>
        {percentage}%
      </p>
    </div>
  )
}

export default function ProZoneScorecard({
  specialistId,
  timeline,
  onTimelineChange,
  teamFilter,
  onTeamFilterChange,
}: ProZoneScorecardProps) {
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(false)

  const brandColor = 'var(--app-prozone, #0ea5e9)'

  // Determine if the current filter is a pipeline filter or team filter
  const isPipelineFilter = ['retirement', 'medicare', 'legacy', 'ALL_PIPELINE'].includes(teamFilter)
  const activeTeamKey = isPipelineFilter ? '' : teamFilter
  const activePipelineKey = isPipelineFilter ? teamFilter : ''

  const handleTeamSelect = useCallback((key: string) => {
    onTeamFilterChange(key)
  }, [onTeamFilterChange])

  const handlePipelineSelect = useCallback((key: string) => {
    onTeamFilterChange(key)
  }, [onTeamFilterChange])

  // Fetch scorecard data
  useEffect(() => {
    if (!specialistId) return
    let cancelled = false

    async function fetchScorecard() {
      try {
        setLoading(true)
        // Map pipeline filters to team=ALL for API, pass pipeline separately
        const apiTeam = isPipelineFilter ? 'ALL' : teamFilter
        const params = new URLSearchParams({
          specialist_id: specialistId,
          timeline,
          team: apiTeam,
        })
        if (isPipelineFilter && teamFilter !== 'ALL_PIPELINE') {
          params.set('pipeline', teamFilter)
        }
        const result = await fetchValidated<ScorecardData>(`/api/prozone/scorecard?${params.toString()}`)
        if (!cancelled && result.success && result.data) {
          setData(result.data)
        }
      } catch {
        // Silently fail — metrics are supplementary
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchScorecard()
    return () => { cancelled = true }
  }, [specialistId, timeline, teamFilter, isPipelineFilter])

  const attempts = data?.attempts ?? 0
  const connected = data?.connected ?? 0
  const booked = data?.booked ?? 0
  const pctConnected = data?.percentages?.connected ?? 0
  const pctBooked = data?.percentages?.booked ?? 0

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      {/* Metric Cards Row */}
      <div className="flex items-stretch gap-3 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/60 rounded-xl z-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: brandColor, borderTopColor: 'transparent' }} />
          </div>
        )}
        <MetricCard label="Attempts" value={attempts} percentage={100} brandColor={brandColor} />
        <MetricCard label="Connected" value={connected} percentage={pctConnected} brandColor={brandColor} />
        <MetricCard label="Booked" value={booked} percentage={pctBooked} brandColor={brandColor} />
      </div>

      {/* Selector Row 1: Timeline */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] w-16 shrink-0">Timeline</span>
        <SegmentedGroup
          options={TIMELINE_OPTIONS}
          activeKey={timeline}
          onSelect={onTimelineChange}
          brandColor={brandColor}
        />
      </div>

      {/* Selector Row 2: Team / Pipeline (mutually exclusive groups) */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] w-16 shrink-0">Filter</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[var(--text-muted)]">Team:</span>
          <SegmentedGroup
            options={TEAM_OPTIONS}
            activeKey={activeTeamKey}
            onSelect={handleTeamSelect}
            brandColor={brandColor}
          />
          <span className="text-[10px] text-[var(--text-muted)] ml-2">Pipeline:</span>
          <SegmentedGroup
            options={PIPELINE_OPTIONS}
            activeKey={activePipelineKey}
            onSelect={handlePipelineSelect}
            brandColor={brandColor}
          />
        </div>
      </div>
    </div>
  )
}
