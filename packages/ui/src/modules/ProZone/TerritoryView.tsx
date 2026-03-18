'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import type { CountyRow, Territory } from './types'

// ============================================================================
// TerritoryView — Data grid of counties, grouped by zone, color-coded by tier
// ============================================================================

interface TerritoryViewProps {
  specialistId: string
  territoryId: string
  portal: string
}

// Tier visual styles using CSS variable-friendly backgrounds
const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  I:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Tier I' },
  II:  { bg: 'bg-sky-500/10',     text: 'text-sky-400',     label: 'Tier II' },
  III: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Tier III' },
  IV:  { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Tier IV' },
}

export default function TerritoryView({ specialistId, territoryId }: TerritoryViewProps) {
  const [rows, setRows] = useState<CountyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)

        // Fetch territory structure and prospect counts in parallel
        const [territoryRes, prospectsRes] = await Promise.all([
          fetchWithAuth(`/api/territories/${territoryId}`),
          fetchWithAuth(`/api/prozone/prospects/${specialistId}`),
        ])

        const territoryJson = await territoryRes.json() as { success: boolean; data?: Territory; error?: string }
        const prospectsJson = await prospectsRes.json() as { success: boolean; data?: { zones: Array<{ zone_id: string; prospects: Array<{ county?: string }>; prospect_count: number }> }; error?: string }

        if (cancelled) return

        // Build county rows from territory zones
        const countyRows: CountyRow[] = []

        if (territoryJson.success && territoryJson.data?.zones) {
          // Count prospects per county from zone-grouped response
          const prospectCountByCounty: Record<string, number> = {}
          if (prospectsJson.success && prospectsJson.data?.zones) {
            for (const zone of prospectsJson.data.zones) {
              for (const p of zone.prospects || []) {
                if (p.county) {
                  const key = String(p.county).toLowerCase()
                  prospectCountByCounty[key] = (prospectCountByCounty[key] || 0) + 1
                }
              }
            }
          }

          for (const zone of territoryJson.data.zones) {
            for (const county of zone.counties) {
              countyRows.push({
                county: county.county,
                zone_id: zone.zone_id,
                zone_name: zone.zone_name,
                tier: zone.tier,
                client_count: prospectCountByCounty[county.county.toLowerCase()] || 0,
              })
            }
          }
        }

        setRows(countyRows)
      } catch {
        if (!cancelled) setError('Failed to load territory data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [specialistId, territoryId])

  // Group by zone
  const zoneGroups = useMemo(() => {
    const groups: Record<string, { zone_name: string; tier: string; counties: CountyRow[] }> = {}
    for (const row of rows) {
      if (!groups[row.zone_id]) {
        groups[row.zone_id] = { zone_name: row.zone_name, tier: row.tier, counties: [] }
      }
      groups[row.zone_id].counties.push(row)
    }
    // Sort by tier
    const tierOrder: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }
    return Object.entries(groups).sort(
      (a, b) => (tierOrder[a[1].tier] || 99) - (tierOrder[b[1].tier] || 99)
    )
  }, [rows])

  // Summary stats
  const stats = useMemo(() => ({
    totalCounties: rows.length,
    totalClients: rows.reduce((sum, r) => sum + r.client_count, 0),
    zoneCount: zoneGroups.length,
  }), [rows, zoneGroups])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading territory...</span>
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
      {/* Summary Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">Total Counties</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{stats.totalCounties}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">Total Clients</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{stats.totalClients.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">Zones</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{stats.zoneCount}</p>
        </div>
      </div>

      {/* Zone Groups */}
      {zoneGroups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>map</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">No territory data available.</p>
        </div>
      ) : (
        zoneGroups.map(([zoneId, group]) => {
          const tierStyle = TIER_STYLES[group.tier] || TIER_STYLES.IV
          return (
            <div key={zoneId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
              {/* Zone Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)' }}>grid_view</span>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{group.zone_name}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierStyle.bg} ${tierStyle.text}`}>
                  {tierStyle.label}
                </span>
              </div>

              {/* County Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]">County</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]">Zone</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]">Tier</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--text-muted)]">Clients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.counties.map((county, idx) => (
                      <tr
                        key={`${county.county}-${idx}`}
                        className={`border-b border-[var(--border-subtle)] last:border-0 transition-colors hover:bg-[var(--bg-hover)] ${tierStyle.bg}`}
                      >
                        <td className="px-4 py-2 text-sm text-[var(--text-primary)]">{county.county}</td>
                        <td className="px-4 py-2 text-sm text-[var(--text-secondary)]">{county.zone_name}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-medium ${tierStyle.text}`}>{county.tier}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-[var(--text-primary)]">
                          {county.client_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
