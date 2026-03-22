'use client'

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import TerritoryBuilder from './TerritoryBuilder'
import type { SpecialistConfig } from './types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MarketTabProps {
  portal: string
  territoryId?: string
}

interface TerritoryOverview {
  territory_id: string
  territory_name: string
  state: string
  status: string
  counties?: Array<{ county: string }>
  zones?: Array<{ zone_id: string }>
}

// ---------------------------------------------------------------------------
// MarketTab — Specialist-to-territory assignment view + TerritoryBuilder
// ---------------------------------------------------------------------------

export default function MarketTab({ portal, territoryId }: MarketTabProps) {
  const [configs, setConfigs] = useState<SpecialistConfig[]>([])
  const [territories, setTerritories] = useState<TerritoryOverview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [cRes, tRes] = await Promise.all([
          fetchWithAuth('/api/specialist-configs'),
          fetchWithAuth('/api/territories'),
        ])
        const cJson = await cRes.json() as { success: boolean; data?: SpecialistConfig[] }
        const tJson = await tRes.json() as { success: boolean; data?: TerritoryOverview[] }
        if (!cancelled) {
          if (cJson.success && cJson.data) setConfigs(cJson.data)
          if (tJson.success && tJson.data) setTerritories(tJson.data)
        }
      } catch {
        // Non-blocking — assignment view is supplementary
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Build territory lookup
  const territoryMap = new Map<string, TerritoryOverview>()
  for (const t of territories) territoryMap.set(t.territory_id, t)

  return (
    <div className="space-y-6">
      {/* Specialist → Territory Assignment Overview */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
          <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--app-prozone, #0ea5e9)' }}>
            assignment_ind
          </span>
          Specialist Assignments
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--app-prozone, #0ea5e9)', borderTopColor: 'transparent' }}
            />
            <span className="text-xs text-[var(--text-muted)]">Loading assignments...</span>
          </div>
        ) : configs.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No specialists configured yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {configs.map((config) => {
              const territory = territoryMap.get(config.territory_id)
              const countyCount = territory?.counties?.length ?? 0
              const zoneCount = territory?.zones?.length ?? 0
              return (
                <div
                  key={config.config_id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'rgba(14,165,233,0.12)' }}
                  >
                    <span
                      className="material-icons-outlined"
                      style={{ fontSize: '18px', color: 'var(--app-prozone, #0ea5e9)' }}
                    >
                      person
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {config.specialist_name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
                      {territory ? territory.territory_name : 'No territory'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      <span>{countyCount} counties</span>
                      <span>&middot;</span>
                      <span>{zoneCount} zones</span>
                      <span>&middot;</span>
                      <span className={config.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>
                        {config.status}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Territory Builder */}
      <TerritoryBuilder portal={portal as 'prodashx' | 'riimo' | 'sentinel'} initialTerritoryId={territoryId} />
    </div>
  )
}
