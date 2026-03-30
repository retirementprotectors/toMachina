'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'
import ZoneAccordion from './ZoneAccordion'
import { InventoryBadge, ProductPill } from './InventoryBadge'
import type {
  ProspectWithInventory,
  ZoneWithProspects,
  InventoryFlags,
} from './types'

// ============================================================================
// TargetTab — Flat filterable/sortable grid + zone-accordion alternate view
// ============================================================================

interface TargetTabProps {
  portal: string
  specialistId: string | null
  onCallClick?: (prospect: ProspectWithInventory) => void
}

// ─── Flat prospect: zone info attached ───
interface FlatProspect extends ProspectWithInventory {
  zone_id: string
  zone_name: string
  zone_tier: string
}

// ─── Column definitions ───
type ColumnKey =
  | 'name'
  | 'county_city'
  | 'age'
  | 'products'
  | 'flags'
  | 'pipeline'
  | 'meeting_type'
  | 'phone'
  | 'zone'
  | 'source'

interface ColumnDef {
  key: ColumnKey
  label: string
  defaultVisible: boolean
  sortable: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', defaultVisible: true, sortable: true },
  { key: 'county_city', label: 'County / City', defaultVisible: true, sortable: false },
  { key: 'age', label: 'Age', defaultVisible: true, sortable: true },
  { key: 'products', label: 'Products', defaultVisible: true, sortable: false },
  { key: 'flags', label: 'Flags', defaultVisible: true, sortable: false },
  { key: 'pipeline', label: 'Pipeline', defaultVisible: true, sortable: false },
  { key: 'meeting_type', label: 'Meeting', defaultVisible: true, sortable: false },
  { key: 'phone', label: 'Phone', defaultVisible: true, sortable: false },
  { key: 'zone', label: 'Zone', defaultVisible: false, sortable: true },
  { key: 'source', label: 'Source', defaultVisible: false, sortable: false },
]

const DEFAULT_VISIBLE = new Set<ColumnKey>(
  ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
)

// ─── Sorting ───
type SortKey = 'name' | 'age' | 'zone'
type SortDir = 'asc' | 'desc'

// ─── Meeting type styles ───
const MEETING_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  field: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Field' },
  office: { bg: 'bg-sky-500/10', text: 'text-sky-400', label: 'Office' },
}

const BRAND = 'var(--app-prozone, #0ea5e9)'

// ─── Page sizes ───
const PAGE_SIZES = [25, 50, 100] as const

export default function TargetTab({ portal: _portal, specialistId, onCallClick }: TargetTabProps) {
  // ─── Data state ───
  const [zones, setZones] = useState<ZoneWithProspects[]>([])
  const [totalProspects, setTotalProspects] = useState(0)
  const [totalFlagged, setTotalFlagged] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Filter state ───
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [meetingFilter, setMeetingFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [ageMin, setAgeMin] = useState<string>('')
  const [ageMax, setAgeMax] = useState<string>('')

  // ─── View state ───
  const [viewMode, setViewMode] = useState<'grid' | 'zones'>('grid')

  // ─── Column visibility ───
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(DEFAULT_VISIBLE)
  )
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false)

  // ─── Sort state ───
  const [sortKey, setSortKey] = useState<SortKey | null>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // ─── Pagination state ───
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(25)

  // ─── Zone accordion open state ───
  const [openZones, setOpenZones] = useState<Set<string>>(new Set())

  // ─── Fetch data on specialist change ───
  useEffect(() => {
    if (!specialistId) {
      setZones([])
      setTotalProspects(0)
      setTotalFlagged(0)
      return
    }
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchValidated<{
          zones: ZoneWithProspects[]
          total_prospects: number
          total_flagged: number
        }>(`/api/prozone/prospects/${specialistId}`)
        if (!cancelled) {
          if (result.success && result.data) {
            setZones(result.data.zones || [])
            setTotalProspects(result.data.total_prospects)
            setTotalFlagged(result.data.total_flagged)
          } else {
            setError(result.error || 'Failed to load prospects')
          }
        }
      } catch {
        if (!cancelled) setError('Network error loading prospects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [specialistId])

  // ─── Flatten zones into a single prospect array ───
  const flatProspects = useMemo((): FlatProspect[] => {
    const result: FlatProspect[] = []
    for (const zone of zones) {
      for (const p of zone.prospects) {
        result.push({
          ...p,
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          zone_tier: zone.tier,
        })
      }
    }
    return result
  }, [zones])

  // ─── Extract zone list for filter dropdown ───
  const zoneOptions = useMemo(() => {
    return zones.map((z) => ({ id: z.zone_id, name: z.zone_name, tier: z.tier }))
  }, [zones])

  // ─── Extract distinct pipeline stages for filter dropdown ───
  const stageOptions = useMemo(() => {
    const stages = new Set<string>()
    for (const p of flatProspects) {
      if (p.pipeline?.stage) stages.add(p.pipeline.stage)
    }
    return Array.from(stages).sort()
  }, [flatProspects])

  // ─── Apply filters ───
  const filtered = useMemo(() => {
    let result = flatProspects

    // Search by name
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      )
    }

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter((p) => p.zone_tier === tierFilter)
    }

    // Zone filter
    if (zoneFilter !== 'all') {
      result = result.filter((p) => p.zone_id === zoneFilter)
    }

    // Flagged only
    if (flaggedOnly) {
      result = result.filter((p) => p.flags.length > 0)
    }

    // Meeting type
    if (meetingFilter !== 'all') {
      result = result.filter((p) => p.meeting_type === meetingFilter)
    }

    // Stage filter
    if (stageFilter !== 'all') {
      if (stageFilter === 'none') {
        result = result.filter((p) => !p.pipeline)
      } else {
        result = result.filter((p) => p.pipeline?.stage === stageFilter)
      }
    }

    // Age range filter
    const minAge = ageMin ? parseInt(ageMin) : null
    const maxAge = ageMax ? parseInt(ageMax) : null
    if (minAge !== null && !isNaN(minAge)) {
      result = result.filter((p) => p.age !== null && p.age >= minAge)
    }
    if (maxAge !== null && !isNaN(maxAge)) {
      result = result.filter((p) => p.age !== null && p.age <= maxAge)
    }

    return result
  }, [flatProspects, search, tierFilter, zoneFilter, flaggedOnly, meetingFilter, stageFilter, ageMin, ageMax])

  // ─── Apply sorting ───
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': {
          const an = `${a.last_name} ${a.first_name}`.toLowerCase()
          const bn = `${b.last_name} ${b.first_name}`.toLowerCase()
          cmp = an.localeCompare(bn)
          break
        }
        case 'age':
          cmp = (a.age ?? -1) - (b.age ?? -1)
          break
        case 'zone':
          cmp = a.zone_name.localeCompare(b.zone_name)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // ─── Pagination ───
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)
  const showingStart = sorted.length > 0 ? safePage * pageSize + 1 : 0
  const showingEnd = Math.min((safePage + 1) * pageSize, sorted.length)

  // ─── Filter zones for accordion view ───
  const filteredZones = useMemo((): ZoneWithProspects[] => {
    const minAge = ageMin ? parseInt(ageMin) : null
    const maxAge = ageMax ? parseInt(ageMax) : null
    const hasFilters = tierFilter !== 'all' || zoneFilter !== 'all' || flaggedOnly || meetingFilter !== 'all' || stageFilter !== 'all' || (minAge !== null && !isNaN(minAge)) || (maxAge !== null && !isNaN(maxAge))
    if (!hasFilters) return zones

    return zones
      .filter((z) => {
        if (tierFilter !== 'all' && z.tier !== tierFilter) return false
        if (zoneFilter !== 'all' && z.zone_id !== zoneFilter) return false
        return true
      })
      .map((z) => {
        let prospects = z.prospects
        if (flaggedOnly) prospects = prospects.filter((p) => p.flags.length > 0)
        if (meetingFilter !== 'all') prospects = prospects.filter((p) => p.meeting_type === meetingFilter)
        if (stageFilter !== 'all') {
          if (stageFilter === 'none') prospects = prospects.filter((p) => !p.pipeline)
          else prospects = prospects.filter((p) => p.pipeline?.stage === stageFilter)
        }
        if (minAge !== null && !isNaN(minAge)) prospects = prospects.filter((p) => p.age !== null && p.age >= minAge)
        if (maxAge !== null && !isNaN(maxAge)) prospects = prospects.filter((p) => p.age !== null && p.age <= maxAge)
        return { ...z, prospects, prospect_count: prospects.length }
      })
      .filter((z) => z.prospect_count > 0)
  }, [zones, tierFilter, zoneFilter, flaggedOnly, meetingFilter, stageFilter, ageMin, ageMax])

  // ─── Handlers ───
  const resetPage = useCallback(() => setPage(0), [])

  const handleSearch = useCallback(
    (v: string) => {
      setSearch(v)
      resetPage()
    },
    [resetPage]
  )

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey]
  )

  const handleRowClick = useCallback((prospect: FlatProspect) => {
    window.open(`/clients/${prospect.client_id}`, '_blank')
  }, [])

  const toggleColumn = useCallback((key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const toggleZone = useCallback((zoneId: string) => {
    setOpenZones((prev) => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }, [])

  const col = useCallback((key: ColumnKey) => visibleColumns.has(key), [visibleColumns])

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: BRAND, borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-[var(--text-muted)]">Loading prospects...</p>
        </div>
      </div>
    )
  }

  // ─── Error state ───
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-8 text-center">
        <span className="material-icons-outlined text-red-400" style={{ fontSize: '28px' }}>
          error_outline
        </span>
        <p className="mt-2 text-sm text-red-400">{error}</p>
      </div>
    )
  }

  // ─── No specialist ───
  if (!specialistId) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
          person_search
        </span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Select a specialist to view prospects.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ─── Filter Bar ─── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5">
        {/* Search */}
        <div className="relative">
          <span
            className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            style={{ fontSize: '16px' }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none"
            style={{ width: '200px' }}
          />
        </div>

        {/* Tier dropdown */}
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value)
            resetPage()
          }}
          className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] focus:border-sky-500 focus:outline-none"
        >
          <option value="all">All Tiers</option>
          <option value="I">Tier I</option>
          <option value="II">Tier II</option>
          <option value="III">Tier III</option>
          <option value="IV">Tier IV</option>
        </select>

        {/* Zone dropdown */}
        <select
          value={zoneFilter}
          onChange={(e) => {
            setZoneFilter(e.target.value)
            resetPage()
          }}
          className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] focus:border-sky-500 focus:outline-none"
        >
          <option value="all">All Zones</option>
          {zoneOptions.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} (Tier {z.tier})
            </option>
          ))}
        </select>

        {/* Flagged only toggle */}
        <button
          type="button"
          onClick={() => {
            setFlaggedOnly((f) => !f)
            resetPage()
          }}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
            flaggedOnly
              ? 'border-sky-500 bg-sky-500/10 text-sky-400'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-sky-500/50 hover:text-sky-400'
          }`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
            flag
          </span>
          Flagged
          {flaggedOnly && totalFlagged > 0 && (
            <span className="ml-0.5 tabular-nums">({totalFlagged})</span>
          )}
        </button>

        {/* Meeting type dropdown */}
        <select
          value={meetingFilter}
          onChange={(e) => {
            setMeetingFilter(e.target.value)
            resetPage()
          }}
          className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] focus:border-sky-500 focus:outline-none"
        >
          <option value="all">All Meetings</option>
          <option value="field">Field</option>
          <option value="office">Office</option>
          <option value="none">None</option>
        </select>

        {/* Stage filter dropdown */}
        <select
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value)
            resetPage()
          }}
          className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] focus:border-sky-500 focus:outline-none"
        >
          <option value="all">All Stages</option>
          <option value="none">No Pipeline</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Age range inputs */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-muted)]">Age</span>
          <input
            type="number"
            placeholder="Min"
            value={ageMin}
            onChange={(e) => { setAgeMin(e.target.value); resetPage() }}
            className="h-8 w-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none"
          />
          <span className="text-[10px] text-[var(--text-muted)]">&ndash;</span>
          <input
            type="number"
            placeholder="Max"
            value={ageMax}
            onChange={(e) => { setAgeMax(e.target.value); resetPage() }}
            className="h-8 w-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex-1" />

        {/* View toggle: Grid | Zones */}
        <div className="flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex h-8 w-8 items-center justify-center transition-colors ${
              viewMode === 'grid'
                ? 'bg-sky-500/15 text-sky-400'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            title="Grid view"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
              grid_view
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('zones')}
            className={`flex h-8 w-8 items-center justify-center border-l border-[var(--border-subtle)] transition-colors ${
              viewMode === 'zones'
                ? 'bg-sky-500/15 text-sky-400'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            title="Zone accordion view"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
              list
            </span>
          </button>
        </div>

        {/* Column selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setColumnDropdownOpen((o) => !o)}
            className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-muted)] transition-colors hover:border-sky-500/50 hover:text-sky-400"
            title="Toggle columns"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
              view_column
            </span>
            Columns
          </button>
          {columnDropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setColumnDropdownOpen(false)}
              />
              <div className="absolute right-0 top-9 z-50 w-48 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1.5 shadow-lg">
                {ALL_COLUMNS.map((colDef) => (
                  <label
                    key={colDef.key}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(colDef.key)}
                      onChange={() => toggleColumn(colDef.key)}
                      className="h-3.5 w-3.5 rounded border-[var(--border-subtle)] accent-sky-500"
                    />
                    {colDef.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Count badge */}
        <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
          {sorted.length.toLocaleString()} of {totalProspects.toLocaleString()}
        </span>
      </div>

      {/* ─── Grid View ─── */}
      {viewMode === 'grid' && (
        <>
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
              <span
                className="material-icons-outlined text-[var(--text-muted)]"
                style={{ fontSize: '28px' }}
              >
                search_off
              </span>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                No prospects match your filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface)]">
                  <tr>
                    {col('name') && (
                      <SortHeader
                        label="Name"
                        sortKey="name"
                        currentSort={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    )}
                    {col('county_city') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        County / City
                      </th>
                    )}
                    {col('age') && (
                      <SortHeader
                        label="Age"
                        sortKey="age"
                        currentSort={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        className="w-14 text-right"
                      />
                    )}
                    {col('products') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Products
                      </th>
                    )}
                    {col('flags') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Flags
                      </th>
                    )}
                    {col('pipeline') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Pipeline
                      </th>
                    )}
                    {col('meeting_type') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Meeting
                      </th>
                    )}
                    {col('phone') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Phone
                      </th>
                    )}
                    {col('zone') && (
                      <SortHeader
                        label="Zone"
                        sortKey="zone"
                        currentSort={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    )}
                    {col('source') && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Source
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((prospect) => {
                    const activeProducts = (
                      Object.keys(prospect.inventory) as Array<keyof InventoryFlags>
                    ).filter((key) => prospect.inventory[key])
                    const meetingStyle = MEETING_STYLES[prospect.meeting_type]

                    return (
                      <tr
                        key={prospect.client_id}
                        onClick={() => handleRowClick(prospect)}
                        className="cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]"
                      >
                        {/* Name */}
                        {col('name') && (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                                <span
                                  className="material-icons-outlined text-[var(--text-muted)]"
                                  style={{ fontSize: '14px' }}
                                >
                                  person
                                </span>
                              </span>
                              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                                {prospect.first_name} {prospect.last_name}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* County / City */}
                        {col('county_city') && (
                          <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] truncate max-w-[160px]">
                            {[prospect.county, prospect.city]
                              .filter(Boolean)
                              .join(', ') || '\u2014'}
                          </td>
                        )}

                        {/* Age */}
                        {col('age') && (
                          <td className="w-14 px-3 py-2.5 text-right text-xs tabular-nums text-[var(--text-secondary)]">
                            {prospect.age ?? '\u2014'}
                          </td>
                        )}

                        {/* Products */}
                        {col('products') && (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              {activeProducts.map((key) => (
                                <ProductPill key={key} productKey={key} />
                              ))}
                            </div>
                          </td>
                        )}

                        {/* Flags */}
                        {col('flags') && (
                          <td className="px-3 py-2.5">
                            {prospect.flags.length > 0 ? (
                              <div className="flex items-center gap-1">
                                {prospect.flags.map((flag) => (
                                  <InventoryBadge key={flag} flag={flag} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">
                                &mdash;
                              </span>
                            )}
                          </td>
                        )}

                        {/* Pipeline */}
                        {col('pipeline') && (
                          <td className="px-3 py-2.5">
                            {prospect.pipeline ? (
                              <span
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                                style={{
                                  background: 'rgba(14, 165, 233, 0.1)',
                                  color: BRAND,
                                }}
                              >
                                {prospect.pipeline.stage}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">
                                &mdash;
                              </span>
                            )}
                          </td>
                        )}

                        {/* Meeting type */}
                        {col('meeting_type') && (
                          <td className="px-3 py-2.5">
                            {meetingStyle ? (
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${meetingStyle.bg} ${meetingStyle.text}`}
                              >
                                {meetingStyle.label}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">
                                &mdash;
                              </span>
                            )}
                          </td>
                        )}

                        {/* Phone */}
                        {col('phone') && (
                          <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{prospect.phone || '\u2014'}</span>
                              {prospect.phone && onCallClick && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onCallClick(prospect) }}
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-emerald-500/10"
                                  title={`Call ${prospect.first_name} ${prospect.last_name}`}
                                >
                                  <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '14px' }}>call</span>
                                </button>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Zone */}
                        {col('zone') && (
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-[var(--text-secondary)]">
                              {prospect.zone_name}
                            </span>
                          </td>
                        )}

                        {/* Source */}
                        {col('source') && (
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-[var(--text-muted)]">
                              {prospect.source || '\u2014'}
                            </span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {sorted.length > 0 && (
            <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
              <div className="flex items-center gap-3">
                <span>
                  Showing {showingStart}&ndash;{showingEnd} of{' '}
                  {sorted.length.toLocaleString()}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    resetPage()
                  }}
                  className="h-7 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] focus:border-sky-500 focus:outline-none"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="rounded-lg border border-[var(--border-subtle)] px-3 py-1 text-xs transition-colors hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Prev
                </button>
                {totalPages > 1 && (
                  <span className="px-1 text-xs tabular-nums">
                    Page {safePage + 1} of {totalPages}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={safePage >= totalPages - 1}
                  className="rounded-lg border border-[var(--border-subtle)] px-3 py-1 text-xs transition-colors hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Zone Accordion View ─── */}
      {viewMode === 'zones' && (
        <div className="space-y-2">
          {filteredZones.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
              <span
                className="material-icons-outlined text-[var(--text-muted)]"
                style={{ fontSize: '28px' }}
              >
                search_off
              </span>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                No zones match your filters.
              </p>
            </div>
          ) : (
            filteredZones.map((zone) => (
              <ZoneAccordion
                key={zone.zone_id}
                zone={zone}
                isOpen={openZones.has(zone.zone_id)}
                onToggle={() => toggleZone(zone.zone_id)}
                searchQuery={search}
                onCallClick={onCallClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SortHeader — Reusable sortable column header
// ============================================================================

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey | null
  currentDir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = currentSort === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider transition-colors hover:text-sky-400 ${
        isActive ? 'text-sky-400' : 'text-[var(--text-muted)]'
      } ${className || ''}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive && (
          <span className="text-sky-400">{currentDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </span>
    </th>
  )
}
