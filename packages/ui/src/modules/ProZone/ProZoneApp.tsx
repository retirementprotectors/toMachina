'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import StatsBar from './StatsBar'
import WeekStrip from './WeekStrip'
import ZoneAccordion from './ZoneAccordion'
import CallPanel from './CallPanel'
import type { CallDisposition } from './CallPanel'
import type {
  SpecialistConfig,
  ZoneWithProspects,
  ProspectWithInventory,
  ScheduleDay,
} from './types'

// ============================================================================
// ProZONE — Prospecting Logic Engine + Pipeline
// ============================================================================

export interface ProZoneProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
}

export default function ProZoneApp({ portal }: ProZoneProps) {
  const [specialists, setSpecialists] = useState<SpecialistConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zones, setZones] = useState<ZoneWithProspects[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  // Accordion state
  const [openZones, setOpenZones] = useState<Set<string>>(new Set())

  // Call panel state
  const [callTarget, setCallTarget] = useState<ProspectWithInventory | null>(null)

  // Schedule context — zone_ids with scheduled field meetings
  const [scheduledZones, setScheduledZones] = useState<Map<string, { count: number; day: string }>>(new Map())

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

  // Fetch prospects when specialist changes
  useEffect(() => {
    if (!selectedId) {
      setZones([])
      return
    }
    const spec = specialists.find((s) => s.config_id === selectedId)
    if (!spec) return

    let cancelled = false
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const [territoryRes, prospectsRes] = await Promise.all([
          fetchWithAuth(`/api/territories/${spec!.territory_id}`),
          fetchWithAuth(`/api/prozone/prospects/${selectedId}`),
        ])

        const tJson = await territoryRes.json() as {
          success: boolean
          data?: { zones?: Array<{ zone_id: string; zone_name: string }> }
          error?: string
        }
        const pJson = await prospectsRes.json() as {
          success: boolean
          data?: { zones: Array<Record<string, unknown>>; total_prospects: number; total_flagged: number }
          error?: string
        }

        if (cancelled) return

        if (!pJson.success || !pJson.data) {
          setError(pJson.error || 'Failed to load prospects')
          setZones([])
          return
        }

        // Build zone name lookup from territory data
        const zoneNames = new Map<string, string>()
        if (tJson.success && tJson.data?.zones) {
          for (const z of tJson.data.zones) {
            zoneNames.set(z.zone_id, z.zone_name)
          }
        }

        // Map API zones to typed ZoneWithProspects
        const mapped: ZoneWithProspects[] = pJson.data.zones.map((z) => ({
          zone_id: String(z.zone_id || ''),
          zone_name: zoneNames.get(String(z.zone_id || '')) || String(z.zone_name || z.zone_id || ''),
          tier: (String(z.tier || 'I')) as ZoneWithProspects['tier'],
          prospects: (z.prospects as ProspectWithInventory[]) || [],
          prospect_count: Number(z.prospect_count) || 0,
          flagged_count: Number(z.flagged_count) || 0,
          flag_summary: (z.flag_summary as Record<string, number>) || {},
          age_buckets: (z.age_buckets as ZoneWithProspects['age_buckets']) || { under_60: 0, '60_64': 0, '65_80': 0, '80_plus': 0 },
          bob_breakdown: (z.bob_breakdown as Record<string, number>) || {},
        }))

        setZones(mapped)
      } catch {
        if (!cancelled) setError('Failed to load prospect data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [selectedId, specialists])

  const handleSelectSpecialist = useCallback((id: string) => {
    setSelectedId(id)
    setZones([])
    setOpenZones(new Set())
    setSearchQuery('')
    setTierFilter('all')
    setFlaggedOnly(false)
  }, [])

  const toggleZone = useCallback((zoneId: string) => {
    setOpenZones((prev) => {
      const next = new Set(prev)
      if (next.has(zoneId)) {
        next.delete(zoneId)
      } else {
        next.add(zoneId)
      }
      return next
    })
  }, [])

  // When WeekStrip loads a schedule, extract zone context for meeting indicators
  const handleScheduleLoaded = useCallback((schedule: ScheduleDay[]) => {
    const zoneMap = new Map<string, { count: number; day: string }>()
    for (const day of schedule) {
      if (day.type !== 'field') continue
      const abbrev = day.day.slice(0, 3)
      for (const slot of day.slots) {
        if (slot.zones) {
          for (const zoneId of slot.zones) {
            const existing = zoneMap.get(zoneId)
            if (existing) {
              existing.count++
            } else {
              zoneMap.set(zoneId, { count: 1, day: abbrev })
            }
          }
        }
      }
    }
    setScheduledZones(zoneMap)
  }, [])

  // Filtering
  const filteredZones = useMemo(() => {
    let filtered = zones
    if (tierFilter !== 'all') {
      filtered = filtered.filter((z) => z.tier === tierFilter)
    }
    if (flaggedOnly) {
      filtered = filtered.filter((z) => z.flagged_count > 0)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.map((z) => ({
        ...z,
        prospects: z.prospects.filter((p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
        ),
      })).filter((z) => z.prospects.length > 0)
    }
    return filtered
  }, [zones, tierFilter, flaggedOnly, searchQuery])

  const totalClients = useMemo(
    () => filteredZones.reduce((s, z) => s + z.prospects.length, 0),
    [filteredZones]
  )
  const totalFlagged = useMemo(
    () => filteredZones.reduce((s, z) => s + z.flagged_count, 0),
    [filteredZones]
  )

  const handleCallClick = useCallback((prospect: ProspectWithInventory) => {
    setCallTarget(prospect)
  }, [])

  const handleCallDispositioned = useCallback((_disposition: CallDisposition) => {
    setCallTarget(null)
  }, [])

  const handleFieldDayClick = useCallback((tier: string) => {
    const zone = filteredZones.find((z) => z.tier === tier)
    if (zone) {
      setOpenZones((prev) => new Set(prev).add(zone.zone_id))
    }
  }, [filteredZones])

  const selected = specialists.find((s) => s.config_id === selectedId) || null

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Compact Top Bar — specialist dropdown + app identity */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5">
        <span
          className="material-icons-outlined"
          style={{ fontSize: '20px', color: 'var(--app-prozone, #0ea5e9)' }}
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

        {/* Territory + zone count context */}
        {selected && (
          <span className="text-xs text-[var(--text-muted)]">
            {selected.zone_count} zones &middot; {selected.origin_zip}
          </span>
        )}

        <div className="flex-1" />

        {/* Loading spinner */}
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Single-Pane Content */}
      {selectedId && (
        <>
          <StatsBar
            zoneCount={filteredZones.length}
            clientCount={totalClients}
            flaggedCount={totalFlagged}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            tierFilter={tierFilter}
            onTierFilterChange={setTierFilter}
            flaggedOnly={flaggedOnly}
            onFlaggedOnlyChange={setFlaggedOnly}
          />

          <WeekStrip
            specialistId={selectedId}
            onFieldDayClick={handleFieldDayClick}
            onScheduleLoaded={handleScheduleLoaded}
          />

          {/* Loading prospects */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              <span className="ml-3 text-sm text-[var(--text-muted)]">Loading prospects...</span>
            </div>
          )}

          {/* Zone Accordions */}
          {!loading && filteredZones.length === 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>people_outline</span>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {searchQuery || tierFilter !== 'all' || flaggedOnly
                  ? 'No zones match your filters.'
                  : 'No prospect data available.'}
              </p>
            </div>
          )}

          {!loading && filteredZones.map((zone) => {
            const meetingCtx = scheduledZones.get(zone.zone_id)
            return (
              <ZoneAccordion
                key={zone.zone_id}
                zone={zone}
                isOpen={openZones.has(zone.zone_id)}
                onToggle={() => toggleZone(zone.zone_id)}
                searchQuery={searchQuery}
                scheduledMeetings={meetingCtx?.count}
                scheduledDay={meetingCtx?.day}
                onCallClick={handleCallClick}
              />
            )
          })}
        </>
      )}

      {/* Call Panel */}
      <CallPanel
        prospect={callTarget}
        onClose={() => setCallTarget(null)}
        onDispositioned={handleCallDispositioned}
      />

      {/* Empty state — no specialist selected */}
      {!loading && !error && !selectedId && specialists.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>person_search</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Select a specialist to view their prospecting zones.</p>
        </div>
      )}
    </div>
  )
}
