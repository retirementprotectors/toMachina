'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import type { Prospect } from './types'

// ============================================================================
// ProspectQueue — Grouped by zone, sorted by tier, with search/filter
// ============================================================================

interface ProspectQueueProps {
  specialistId: string
  portal: string
}

const TIER_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  I:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  II:  { bg: 'bg-sky-500/10',     text: 'text-sky-400' },
  III: { bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  IV:  { bg: 'bg-red-500/10',     text: 'text-red-400' },
}

export default function ProspectQueue({ specialistId }: ProspectQueueProps) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  // Fetch prospects
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth(`/api/prozone/prospects/${specialistId}`)
        const json = await res.json() as { success: boolean; data?: Prospect[]; error?: string }
        if (!cancelled) {
          if (json.success && json.data) {
            setProspects(json.data)
          } else {
            setError(json.error || 'Failed to load prospects')
          }
        }
      } catch {
        if (!cancelled) setError('Network error loading prospects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [specialistId])

  // Available zones for filter
  const availableZones = useMemo(() => {
    const zoneMap = new Map<string, string>()
    for (const p of prospects) {
      if (!zoneMap.has(p.zone_id)) {
        zoneMap.set(p.zone_id, p.zone_name)
      }
    }
    return Array.from(zoneMap.entries()).map(([id, name]) => ({ id, name }))
  }, [prospects])

  // Filtered and grouped prospects
  const filteredGroups = useMemo(() => {
    let filtered = prospects

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      )
    }

    // Zone filter
    if (zoneFilter !== 'all') {
      filtered = filtered.filter((p) => p.zone_id === zoneFilter)
    }

    // Group by zone
    const groups: Record<string, { zone_name: string; tier: string; prospects: Prospect[] }> = {}
    for (const p of filtered) {
      if (!groups[p.zone_id]) {
        groups[p.zone_id] = { zone_name: p.zone_name, tier: p.tier, prospects: [] }
      }
      groups[p.zone_id].prospects.push(p)
    }

    // Sort groups by tier (I first)
    const tierOrder: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }
    return Object.entries(groups).sort(
      (a, b) => (tierOrder[a[1].tier] || 99) - (tierOrder[b[1].tier] || 99)
    )
  }, [prospects, searchQuery, zoneFilter])

  const totalFiltered = useMemo(
    () => filteredGroups.reduce((sum, [, g]) => sum + g.prospects.length, 0),
    [filteredGroups]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading prospects...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span
            className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            style={{ fontSize: '18px' }}
          >
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
          />
        </div>

        {/* Zone Filter */}
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
        >
          <option value="all">All Zones</option>
          {availableZones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>

        {/* Count */}
        <span className="text-xs text-[var(--text-muted)]">
          {totalFiltered} prospect{totalFiltered !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Zone Groups */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>people_outline</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {searchQuery || zoneFilter !== 'all' ? 'No prospects match your filters.' : 'No prospects available.'}
          </p>
        </div>
      ) : (
        filteredGroups.map(([zoneId, group]) => {
          const tierBadge = TIER_BADGE_STYLES[group.tier] || TIER_BADGE_STYLES.IV
          return (
            <div key={zoneId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
              {/* Zone Section Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)' }}>location_on</span>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{group.zone_name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tierBadge.bg} ${tierBadge.text}`}>
                    Tier {group.tier}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {group.prospects.length} prospect{group.prospects.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Prospect Cards */}
              <div className="divide-y divide-[var(--border-subtle)]">
                {group.prospects.map((prospect) => (
                  <div
                    key={prospect.prospect_id}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    {/* Avatar placeholder */}
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]"
                    >
                      <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>person</span>
                    </span>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {prospect.first_name} {prospect.last_name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {prospect.city}, {prospect.county} County
                      </p>
                    </div>

                    {/* Age */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{prospect.age}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">years</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
