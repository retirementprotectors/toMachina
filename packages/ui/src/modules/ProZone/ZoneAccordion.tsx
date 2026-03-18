'use client'

import { useMemo } from 'react'
import type { ZoneWithProspects, ProspectWithInventory } from './types'
import { InventoryBadge } from './InventoryBadge'
import ProspectRow from './ProspectRow'

// ============================================================================
// ZoneAccordion — Collapsible zone card with prospect list
// ============================================================================

const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  I:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  II:  { bg: 'bg-sky-500/10',     text: 'text-sky-400' },
  III: { bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  IV:  { bg: 'bg-red-500/10',     text: 'text-red-400' },
}

const AGE_BAR_COLORS: Record<string, string> = {
  under_60: 'bg-neutral-500',
  '60_64':  'bg-sky-500',
  '65_80':  'bg-emerald-500',
  '80_plus': 'bg-amber-500',
}

interface ZoneAccordionProps {
  zone: ZoneWithProspects
  isOpen: boolean
  onToggle: () => void
  searchQuery: string
  scheduledMeetings?: number
  scheduledDay?: string
  onCallClick?: (prospect: ProspectWithInventory) => void
}

export default function ZoneAccordion({
  zone,
  isOpen,
  onToggle,
  searchQuery,
  scheduledMeetings,
  scheduledDay,
  onCallClick,
}: ZoneAccordionProps) {
  const tierStyle = TIER_STYLES[zone.tier] ?? TIER_STYLES.IV

  // Filter prospects by search query
  const filteredProspects = useMemo(() => {
    if (!searchQuery.trim()) return zone.prospects
    const q = searchQuery.toLowerCase()
    return zone.prospects.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)
    )
  }, [zone.prospects, searchQuery])

  // Top 3 BoB sources sorted by count
  const topSources = useMemo(() => {
    const entries = Object.entries(zone.bob_breakdown)
    entries.sort((a, b) => b[1] - a[1])
    return entries.slice(0, 3)
  }, [zone.bob_breakdown])

  // Age bar segments
  const ageBuckets = zone.age_buckets
  const totalAge = ageBuckets.under_60 + ageBuckets['60_64'] + ageBuckets['65_80'] + ageBuckets['80_plus']
  const ageSegments = useMemo(() => {
    if (totalAge === 0) return []
    const keys: Array<keyof typeof ageBuckets> = ['under_60', '60_64', '65_80', '80_plus']
    return keys
      .filter((k) => ageBuckets[k] > 0)
      .map((k) => ({
        key: k,
        pct: (ageBuckets[k] / totalAge) * 100,
        color: AGE_BAR_COLORS[k],
      }))
  }, [ageBuckets, totalAge])

  // Flag summary entries
  const flagEntries = useMemo(() => Object.entries(zone.flag_summary), [zone.flag_summary])

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        {/* Chevron */}
        <span className="material-icons-outlined shrink-0 text-[var(--text-muted)] transition-transform duration-200" style={{ fontSize: '20px' }}>
          {isOpen ? 'expand_more' : 'chevron_right'}
        </span>

        {/* Zone name */}
        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {zone.zone_name}
        </span>

        {/* Tier badge */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tierStyle.bg} ${tierStyle.text}`}>
          Tier {zone.tier}
        </span>

        {/* Flag summary badges */}
        {flagEntries.length > 0 && (
          <div className="hidden items-center gap-1 lg:flex">
            {flagEntries.map(([flag, count]) => (
              <InventoryBadge key={flag} flag={flag} count={count} />
            ))}
          </div>
        )}

        {/* Age bar */}
        {ageSegments.length > 0 && (
          <div className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--bg-surface)] xl:flex">
            {ageSegments.map((seg) => (
              <div
                key={seg.key}
                className={`h-full ${seg.color}`}
                style={{ width: `${seg.pct}%` }}
              />
            ))}
          </div>
        )}

        {/* BoB breakdown pills */}
        {topSources.length > 0 && (
          <div className="hidden items-center gap-1 xl:flex">
            {topSources.map(([source, count]) => (
              <span
                key={source}
                className="rounded-full bg-neutral-500/10 px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
              >
                {source} ({count})
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Scheduled meetings indicator */}
        {scheduledMeetings != null && scheduledMeetings > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-medium text-sky-400">
            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>calendar_today</span>
            {scheduledMeetings} meeting{scheduledMeetings !== 1 ? 's' : ''}{scheduledDay ? ` ${scheduledDay}` : ''}
          </span>
        )}

        {/* Client count */}
        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
          {zone.prospect_count} client{zone.prospect_count !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Expanded Body */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[5000px]' : 'max-h-0'
        }`}
      >
        <div className="border-t border-[var(--border-subtle)]">
          {/* Table header */}
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="w-8" />
            <span className="min-w-[140px]">Name</span>
            <span className="min-w-[120px]">Location</span>
            <span className="w-10 text-right">Age</span>
            <span className="min-w-[100px]">Products</span>
            <span className="flex-1">Flags</span>
          </div>

          {/* Prospect rows */}
          {filteredProspects.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
              {searchQuery.trim()
                ? 'No prospects match the current search.'
                : 'No prospects in this zone.'}
            </div>
          ) : (
            filteredProspects.map((prospect) => (
              <ProspectRow
                key={prospect.client_id}
                prospect={prospect}
                onCallClick={onCallClick}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
