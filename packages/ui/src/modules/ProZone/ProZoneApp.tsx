'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import SpecialistSelector from './SpecialistSelector'
import TerritoryView from './TerritoryView'
import ScheduleView from './ScheduleView'
import ProspectQueue from './ProspectQueue'
import ZoneLeadPanel from './ZoneLeadPanel'
import type { SpecialistConfig, Zone } from './types'

// ============================================================================
// ProZoneApp — Prospecting hub app shell
// ============================================================================

export interface ProZoneProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
}

type ProZoneTab = 'territory' | 'schedule' | 'prospects' | 'zone-leads'

const TABS: Array<{ key: ProZoneTab; label: string; icon: string }> = [
  { key: 'territory', label: 'Territory', icon: 'map' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar_month' },
  { key: 'prospects', label: 'Prospects', icon: 'people' },
  { key: 'zone-leads', label: 'Zone Leads', icon: 'leaderboard' },
]

export default function ProZoneApp({ portal }: ProZoneProps) {
  const [specialists, setSpecialists] = useState<SpecialistConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ProZoneTab>('territory')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<Zone[]>([])

  // Fetch specialist configs on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth('/api/specialist-configs')
        const json = await res.json() as { success: boolean; data?: SpecialistConfig[]; error?: string }
        if (!cancelled) {
          if (json.success && json.data) {
            setSpecialists(json.data)
            // Auto-select first if only one
            if (json.data.length === 1) {
              setSelectedId(json.data[0].config_id)
            }
          } else {
            setError(json.error || 'Failed to load specialist configs')
          }
        }
      } catch {
        if (!cancelled) setError('Network error loading specialists')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Fetch zones when specialist changes
  useEffect(() => {
    if (!selectedId) {
      setZones([])
      return
    }
    const spec = specialists.find((s) => s.config_id === selectedId)
    if (!spec) return

    let cancelled = false
    async function loadZones() {
      try {
        const res = await fetchWithAuth(`/api/territories/${spec!.territory_id}`)
        const json = await res.json() as { success: boolean; data?: { zones?: Zone[] }; error?: string }
        if (!cancelled && json.success && json.data?.zones) {
          setZones(json.data.zones)
        }
      } catch {
        // Zone data will load in sub-views too
      }
    }
    loadZones()
    return () => { cancelled = true }
  }, [selectedId, specialists])

  const handleSelectSpecialist = useCallback((id: string) => {
    setSelectedId(id)
    setActiveTab('territory')
  }, [])

  const selected = specialists.find((s) => s.config_id === selectedId) || null

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* App Header */}
      <div
        className="rounded-xl border border-[var(--border-subtle)] px-6 py-4"
        style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.03))' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(14,165,233,0.15)' }}
          >
            <span
              className="material-icons-outlined"
              style={{ fontSize: '22px', color: 'var(--app-prozone, #0ea5e9)' }}
            >
              explore
            </span>
          </span>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">ProZone</h1>
            <p className="text-xs text-[var(--text-muted)]">Prospecting Hub</p>
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--app-prozone, #0ea5e9)', borderTopColor: 'transparent' }} />
          <span className="ml-3 text-sm text-[var(--text-muted)]">Loading specialists...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Specialist Selector */}
      {!loading && !error && (
        <SpecialistSelector
          specialists={specialists}
          selected={selectedId}
          onSelect={handleSelectSpecialist}
        />
      )}

      {/* Tab Navigation + Content */}
      {selectedId && selected && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                style={
                  activeTab === tab.key
                    ? { backgroundColor: 'var(--bg-surface)' }
                    : undefined
                }
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'territory' && (
              <TerritoryView specialistId={selectedId} territoryId={selected.territory_id} portal={portal} />
            )}
            {activeTab === 'schedule' && (
              <ScheduleView specialistId={selectedId} portal={portal} />
            )}
            {activeTab === 'prospects' && (
              <ProspectQueue specialistId={selectedId} portal={portal} />
            )}
            {activeTab === 'zone-leads' && (
              <ZoneLeadPanel
                specialistId={selectedId}
                zones={zones.map((z) => ({ zone_id: z.zone_id, zone_name: z.zone_name }))}
                portal={portal}
              />
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && specialists.length === 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <span
            className="material-icons-outlined"
            style={{ fontSize: '48px', color: 'var(--text-muted)' }}
          >
            explore_off
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">No Specialist Configs</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Configure specialists in ProZone Admin to get started.
          </p>
        </div>
      )}
    </div>
  )
}
