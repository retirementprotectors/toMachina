'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import ProZoneScorecard from './ProZoneScorecard'
import CallPanel from './CallPanel'
import type { CallDisposition } from './CallPanel'
import TeamTab from './TeamTab'
import MarketTab from './MarketTab'
import TargetTab from './TargetTab'
import FlowTab from './FlowTab'
import InventoryTab from './InventoryTab'
import type { SpecialistConfig, ProspectWithInventory, ProZoneTab } from './types'

// ============================================================================
// ProZONE — 5-Tab Layout (GUARDIAN pattern)
// ============================================================================

export interface ProZoneProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
}

const TABS: ReadonlyArray<{ key: ProZoneTab; label: string; icon: string }> = [
  { key: 'team', label: 'TEAM', icon: 'groups' },
  { key: 'market', label: 'MARKET', icon: 'map' },
  { key: 'target', label: 'TARGET', icon: 'target' },
  { key: 'flow', label: 'FLOW', icon: 'conversion_path' },
  { key: 'inventory', label: 'INVENTORY', icon: 'inventory_2' },
] as const

const BRAND_COLOR = 'var(--app-prozone, #0ea5e9)'

export default function ProZoneApp({ portal }: ProZoneProps) {
  // ─── Specialist state ───
  const [specialists, setSpecialists] = useState<SpecialistConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Tab state ───
  const [activeTab, setActiveTab] = useState<ProZoneTab>('target')

  // ─── Scorecard state ───
  const [timeline, setTimeline] = useState('week')
  const [teamFilter, setTeamFilter] = useState('ALL')

  // ─── Call panel state ───
  const [callTarget, setCallTarget] = useState<ProspectWithInventory | null>(null)

  // ─── Fetch specialist configs on mount ───
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
            const specs = Array.isArray(json.data) ? json.data : []
            setSpecialists(specs)
            if (specs.length === 1) {
              setSelectedId(specs[0].config_id)
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

  const handleSelectSpecialist = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleCallDispositioned = useCallback((_disposition: CallDisposition) => {
    setCallTarget(null)
  }, [])

  const selected = specialists.find((s) => s.config_id === selectedId) || null

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5">
        <span
          className="material-icons-outlined"
          style={{ fontSize: '20px', color: BRAND_COLOR }}
        >
          explore
        </span>
        <span className="text-sm font-bold text-[var(--text-primary)]">ProZONE</span>

        {/* Specialist Dropdown */}
        <select
          value={selectedId || ''}
          onChange={(e) => handleSelectSpecialist(e.target.value)}
          disabled={loading || specialists.length === 0}
          className="ml-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
        >
          {specialists.length === 0 && <option value="">No specialists</option>}
          {!selectedId && specialists.length > 0 && <option value="">Select specialist...</option>}
          {specialists.map((s) => (
            <option key={s.config_id} value={s.config_id}>
              {s.specialist_name} — {s.territory_name}
            </option>
          ))}
        </select>

        {/* Territory context */}
        {selected && (
          <span className="text-xs text-[var(--text-muted)]">
            {selected.zone_count} zones &middot; {selected.origin_zip}
          </span>
        )}

        <div className="flex-1" />

        {/* Gear icon → navigates to TEAM (config) tab */}
        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className="flex items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-surface)]"
          title="Specialist configuration"
        >
          <span
            className="material-icons-outlined"
            style={{
              fontSize: '18px',
              color: activeTab === 'team' ? BRAND_COLOR : 'var(--text-muted)',
            }}
          >
            settings
          </span>
        </button>

        {/* Loading spinner */}
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: BRAND_COLOR, borderTopColor: 'transparent' }} />
        )}
      </div>

      {/* ─── Error ─── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ─── Empty state — no specialist selected ─── */}
      {!loading && !error && !selectedId && specialists.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>person_search</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Select a specialist to view their prospecting zones.</p>
        </div>
      )}

      {/* ─── Main Content (only when specialist selected) ─── */}
      {selectedId && (
        <>
          {/* Scorecard — always visible */}
          <ProZoneScorecard
            specialistId={selectedId}
            timeline={timeline}
            onTimelineChange={setTimeline}
            teamFilter={teamFilter}
            onTeamFilterChange={setTeamFilter}
          />

          {/* Tab Bar */}
          <div
            className="flex gap-0.5 overflow-x-auto"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-xs font-medium transition-all"
                  style={{
                    background: isActive ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                    borderBottom: isActive ? `2px solid ${BRAND_COLOR}` : '2px solid transparent',
                    color: isActive ? BRAND_COLOR : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <span
                    className="material-icons-outlined"
                    style={{
                      fontSize: '16px',
                      color: isActive ? BRAND_COLOR : 'var(--text-muted)',
                    }}
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === 'team' && <TeamTab portal={portal} specialistId={selectedId} />}
            {activeTab === 'market' && <MarketTab portal={portal} territoryId={selected?.territory_id} />}
            {activeTab === 'target' && <TargetTab portal={portal} specialistId={selectedId} onCallClick={setCallTarget} />}
            {activeTab === 'flow' && <FlowTab portal={portal} specialistId={selectedId} />}
            {activeTab === 'inventory' && <InventoryTab portal={portal} specialists={specialists} selectedId={selectedId} />}
          </div>
        </>
      )}

      {/* ─── Call Panel ─── */}
      <CallPanel
        prospect={callTarget}
        onClose={() => setCallTarget(null)}
        onDispositioned={handleCallDispositioned}
      />
    </div>
  )
}

