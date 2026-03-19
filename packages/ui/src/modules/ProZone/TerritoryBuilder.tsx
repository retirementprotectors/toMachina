'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'

// ============================================================================
// TerritoryBuilder — Admin CRUD for territory definitions + county-zone mapping
// ============================================================================

// Iowa counties — hardcoded for now (99 counties)
const IOWA_COUNTIES = [
  'Adair', 'Adams', 'Allamakee', 'Appanoose', 'Audubon', 'Benton', 'Black Hawk',
  'Boone', 'Bremer', 'Buchanan', 'Buena Vista', 'Butler', 'Calhoun', 'Carroll',
  'Cass', 'Cedar', 'Cerro Gordo', 'Cherokee', 'Chickasaw', 'Clarke', 'Clay',
  'Clayton', 'Clinton', 'Crawford', 'Dallas', 'Davis', 'Decatur', 'Delaware',
  'Des Moines', 'Dickinson', 'Dubuque', 'Emmet', 'Fayette', 'Floyd', 'Franklin',
  'Fremont', 'Greene', 'Grundy', 'Guthrie', 'Hamilton', 'Hancock', 'Hardin',
  'Harrison', 'Henry', 'Howard', 'Humboldt', 'Ida', 'Iowa', 'Jackson', 'Jasper',
  'Jefferson', 'Johnson', 'Jones', 'Keokuk', 'Kossuth', 'Lee', 'Linn', 'Louisa',
  'Lucas', 'Lyon', 'Madison', 'Mahaska', 'Marion', 'Marshall', 'Mills', 'Mitchell',
  'Monona', 'Monroe', 'Montgomery', 'Muscatine', "O'Brien", 'Osceola', 'Page',
  'Palo Alto', 'Plymouth', 'Pocahontas', 'Polk', 'Pottawattamie', 'Poweshiek',
  'Ringgold', 'Sac', 'Scott', 'Shelby', 'Sioux', 'Story', 'Tama', 'Taylor',
  'Union', 'Van Buren', 'Wapello', 'Warren', 'Washington', 'Wayne', 'Webster',
  'Winnebago', 'Winneshiek', 'Woodbury', 'Worth', 'Wright',
]

// ---------------------------------------------------------------------------
// Local types for the builder (mirrors Firestore shape from API)
// ---------------------------------------------------------------------------

interface TerritoryZone {
  zone_id: string
  zone_name: string
  territory_id: string
  resolution_type: 'county' | 'zip'
  assignments: Array<{ county: string; zone_id: string }>
}

interface TerritoryRecord {
  territory_id: string
  territory_name: string
  state: string
  territory_status: 'Active' | 'Inactive'
  counties: Array<{ county: string; zone_id: string }>
  zones: TerritoryZone[]
  created_at: string
  updated_at: string
}

interface TerritoryListResponse {
  success: boolean
  data?: TerritoryRecord[]
  error?: string
}

interface TerritorySingleResponse {
  success: boolean
  data?: TerritoryRecord
  error?: string
}

// Draft zone used in the editor (no territory_id yet for new territories)
interface DraftZone {
  zone_id: string
  zone_name: string
  resolution_type: 'county' | 'zip'
  assignedCounties: string[]
  zipOverrides: string[] // ZIP codes that override county-level assignment into this zone
}

interface TerritoryBuilderProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
  initialTerritoryId?: string
}

type View = 'list' | 'editor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateZoneId(): string {
  return `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// Main Component
// ============================================================================

export default function TerritoryBuilder({ portal, initialTerritoryId }: TerritoryBuilderProps) {
  const [view, setView] = useState<View>(initialTerritoryId ? 'editor' : 'list')
  const [territories, setTerritories] = useState<TerritoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(initialTerritoryId || null)

  // ------------------------------------------------------------------
  // Fetch territory list
  // ------------------------------------------------------------------
  const loadTerritories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchWithAuth('/api/territories')
      const json = (await res.json()) as TerritoryListResponse
      if (json.success && json.data) {
        setTerritories(json.data)
      } else {
        setError(json.error || 'Failed to load territories')
      }
    } catch {
      setError('Network error loading territories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTerritories()
  }, [loadTerritories])

  // ------------------------------------------------------------------
  // Navigation handlers
  // ------------------------------------------------------------------
  const handleCreate = useCallback(() => {
    setEditingId(null)
    setView('editor')
  }, [])

  const handleEdit = useCallback((id: string) => {
    setEditingId(id)
    setView('editor')
  }, [])

  const handleBack = useCallback(() => {
    setView('list')
    setEditingId(null)
    loadTerritories()
  }, [loadTerritories])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (view === 'editor') {
    return (
      <TerritoryEditor
        territoryId={editingId}
        portal={portal}
        onBack={handleBack}
      />
    )
  }

  return (
    <TerritoryList
      territories={territories}
      loading={loading}
      error={error}
      portal={portal}
      onEdit={handleEdit}
      onCreate={handleCreate}
    />
  )
}

// ============================================================================
// TerritoryList — Card grid of territories
// ============================================================================

interface TerritoryListProps {
  territories: TerritoryRecord[]
  loading: boolean
  error: string | null
  portal: string
  onEdit: (id: string) => void
  onCreate: () => void
}

function TerritoryList({ territories, loading, error, onEdit, onCreate }: TerritoryListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--app-prozone, #0ea5e9)', borderTopColor: 'transparent' }}
        />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading territories...</span>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
          Territories ({territories.length})
        </h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
          Add Territory
        </button>
      </div>

      {/* Cards */}
      {territories.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-16 text-center">
          <span
            className="material-icons-outlined"
            style={{ fontSize: '48px', color: 'var(--text-muted)' }}
          >
            map
          </span>
          <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">No Territories</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create your first territory to start defining zones and county assignments.
          </p>
          <button
            onClick={onCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
            Add Territory
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {territories.map((territory) => {
            const countyCount = territory.counties?.length ?? 0
            const zoneCount = territory.zones?.length ?? 0
            const isActive = territory.territory_status === 'Active'

            return (
              <button
                key={territory.territory_id}
                onClick={() => onEdit(territory.territory_id)}
                className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-left transition-all hover:border-[var(--border-medium)] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'rgba(14,165,233,0.15)' }}
                    >
                      <span
                        className="material-icons-outlined"
                        style={{ fontSize: '20px', color: 'var(--app-prozone, #0ea5e9)' }}
                      >
                        map
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {territory.territory_name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {territory.state}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {territory.territory_status}
                  </span>
                </div>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>pin_drop</span>
                    {countyCount} counties
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>grid_view</span>
                    {zoneCount} zones
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// TerritoryEditor — Create/Edit territory with zone builder + county assignment
// ============================================================================

interface TerritoryEditorProps {
  territoryId: string | null
  portal: string
  onBack: () => void
}

function TerritoryEditor({ territoryId, onBack }: TerritoryEditorProps) {
  const isNew = !territoryId

  // Form fields
  const [territoryName, setTerritoryName] = useState('')
  const [state, setState] = useState('Iowa')
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active')
  const [zones, setZones] = useState<DraftZone[]>([])

  // UI state
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [expandedZone, setExpandedZone] = useState<string | null>(null)
  const [countySearch, setCountySearch] = useState('')

  // ------------------------------------------------------------------
  // Load existing territory for editing
  // ------------------------------------------------------------------
  useEffect(() => {
    if (isNew || !territoryId) return

    let cancelled = false
    async function loadTerritory() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth(`/api/territories/${territoryId}`)
        const json = (await res.json()) as TerritorySingleResponse
        if (cancelled) return
        if (json.success && json.data) {
          const t = json.data
          setTerritoryName(t.territory_name)
          setState(t.state)
          setStatus(t.territory_status)

          // Rebuild draft zones from API data
          const draftZones: DraftZone[] = (t.zones || []).map((z) => {
            const raw = z as TerritoryZone & { zip_assignments?: Array<{ zip: string }> }
            return {
              zone_id: z.zone_id,
              zone_name: z.zone_name,
              resolution_type: z.resolution_type || 'county',
              assignedCounties: (z.assignments || []).map((a) => a.county),
              zipOverrides: (raw.zip_assignments || []).map((za) => za.zip),
            }
          })
          setZones(draftZones)
          if (draftZones.length > 0) {
            setExpandedZone(draftZones[0].zone_id)
          }
        } else {
          setError(json.error || 'Failed to load territory')
        }
      } catch {
        if (!cancelled) setError('Network error loading territory')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTerritory()
    return () => { cancelled = true }
  }, [isNew, territoryId])

  // ------------------------------------------------------------------
  // County assignment helpers
  // ------------------------------------------------------------------

  // Map of county → zone_id for all assigned counties
  const countyAssignments = useMemo(() => {
    const map = new Map<string, string>()
    for (const zone of zones) {
      for (const county of zone.assignedCounties) {
        map.set(county, zone.zone_id)
      }
    }
    return map
  }, [zones])

  // Unassigned counties
  const unassignedCounties = useMemo(() => {
    return IOWA_COUNTIES.filter((c) => !countyAssignments.has(c))
  }, [countyAssignments])

  // Filtered counties for search
  const filteredCounties = useMemo(() => {
    if (!countySearch.trim()) return IOWA_COUNTIES
    const q = countySearch.toLowerCase()
    return IOWA_COUNTIES.filter((c) => c.toLowerCase().includes(q))
  }, [countySearch])

  // ------------------------------------------------------------------
  // Zone CRUD
  // ------------------------------------------------------------------
  const handleAddZone = useCallback(() => {
    const newZone: DraftZone = {
      zone_id: generateZoneId(),
      zone_name: `Zone ${zones.length + 1}`,
      resolution_type: 'county',
      assignedCounties: [],
      zipOverrides: [],
    }
    setZones((prev) => [...prev, newZone])
    setExpandedZone(newZone.zone_id)
  }, [zones.length])

  const handleRemoveZone = useCallback((zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.zone_id !== zoneId))
    setExpandedZone((prev) => (prev === zoneId ? null : prev))
  }, [])

  const handleRenameZone = useCallback((zoneId: string, name: string) => {
    setZones((prev) =>
      prev.map((z) => (z.zone_id === zoneId ? { ...z, zone_name: name } : z))
    )
  }, [])

  // Toggle county assignment to a zone
  const handleToggleCounty = useCallback((county: string, zoneId: string) => {
    setZones((prev) => {
      return prev.map((z) => {
        if (z.zone_id === zoneId) {
          // Toggle: if already assigned, remove; otherwise add
          const has = z.assignedCounties.includes(county)
          return {
            ...z,
            assignedCounties: has
              ? z.assignedCounties.filter((c) => c !== county)
              : [...z.assignedCounties, county],
          }
        }
        // If the county is in another zone, remove it from there
        if (z.assignedCounties.includes(county)) {
          return {
            ...z,
            assignedCounties: z.assignedCounties.filter((c) => c !== county),
          }
        }
        return z
      })
    })
  }, [])

  // Add a ZIP override to a zone
  const handleAddZipOverride = useCallback((zoneId: string, zip: string) => {
    const trimmed = zip.trim()
    if (!trimmed || !/^\d{5}$/.test(trimmed)) return
    setZones((prev) =>
      prev.map((z) =>
        z.zone_id === zoneId && !z.zipOverrides.includes(trimmed)
          ? { ...z, zipOverrides: [...z.zipOverrides, trimmed] }
          : z
      )
    )
  }, [])

  // Remove a ZIP override from a zone
  const handleRemoveZipOverride = useCallback((zoneId: string, zip: string) => {
    setZones((prev) =>
      prev.map((z) =>
        z.zone_id === zoneId
          ? { ...z, zipOverrides: z.zipOverrides.filter((zp) => zp !== zip) }
          : z
      )
    )
  }, [])

  // Move all unassigned to a zone
  const handleAssignAllUnassigned = useCallback((zoneId: string) => {
    setZones((prev) => {
      const assigned = new Set<string>()
      for (const z of prev) {
        for (const c of z.assignedCounties) assigned.add(c)
      }
      const remaining = IOWA_COUNTIES.filter((c) => !assigned.has(c))
      return prev.map((z) =>
        z.zone_id === zoneId
          ? { ...z, assignedCounties: [...z.assignedCounties, ...remaining] }
          : z
      )
    })
  }, [])

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!territoryName.trim()) {
      setError('Territory name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSaveMessage(null)

      // Build the payload
      const counties = zones.flatMap((z) =>
        z.assignedCounties.map((county) => ({ county, zone_id: z.zone_id }))
      )

      const zonesPayload = zones.map((z) => ({
        zone_id: z.zone_id,
        zone_name: z.zone_name,
        resolution_type: z.resolution_type,
        assignments: z.assignedCounties.map((county) => ({ county, zone_id: z.zone_id })),
        zip_assignments: z.zipOverrides.map((zip) => ({ zip, zone_id: z.zone_id })),
      }))

      const payload = {
        territory_name: territoryName.trim(),
        state: state.trim(),
        territory_status: status,
        counties,
        zones: zonesPayload,
      }

      const url = isNew ? '/api/territories' : `/api/territories/${territoryId}`
      const method = isNew ? 'POST' : 'PATCH'

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { success: boolean; error?: string }

      if (json.success) {
        setSaveMessage(isNew ? 'Territory created successfully' : 'Territory updated successfully')
        if (isNew) {
          // Go back to list after creating
          setTimeout(() => onBack(), 1200)
        }
      } else {
        setError(json.error || 'Failed to save territory')
      }
    } catch {
      setError('Network error saving territory')
    } finally {
      setSaving(false)
    }
  }, [territoryName, state, status, zones, isNew, territoryId, onBack])

  // ------------------------------------------------------------------
  // Deactivate
  // ------------------------------------------------------------------
  const handleDeactivate = useCallback(async () => {
    if (!territoryId) return
    const newStatus = status === 'Active' ? 'Inactive' : 'Active'
    try {
      setSaving(true)
      setError(null)
      const res = await fetchWithAuth(`/api/territories/${territoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ territory_status: newStatus }),
      })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (json.success) {
        setStatus(newStatus)
        setSaveMessage(`Territory ${newStatus === 'Active' ? 'activated' : 'deactivated'}`)
      } else {
        setError(json.error || 'Failed to update status')
      }
    } catch {
      setError('Network error updating status')
    } finally {
      setSaving(false)
    }
  }, [territoryId, status])

  // ------------------------------------------------------------------
  // Render: Loading
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--app-prozone, #0ea5e9)', borderTopColor: 'transparent' }}
        />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading territory...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {isNew ? 'New Territory' : 'Edit Territory'}
        </h2>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {saveMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3">
          <p className="text-sm text-emerald-400">{saveMessage}</p>
        </div>
      )}

      {/* Territory Details Card */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-secondary)]">Territory Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Territory Name
            </label>
            <input
              type="text"
              value={territoryName}
              onChange={(e) => setTerritoryName(e.target.value)}
              placeholder="e.g. Central Iowa"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              style={{ borderColor: territoryName.trim() ? undefined : undefined }}
            />
          </div>

          {/* State */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. Iowa"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>

          {/* Status Toggle */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Status
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStatus('Active')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  status === 'Active'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                Active
              </button>
              <button
                onClick={() => setStatus('Inactive')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  status === 'Inactive'
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>cancel</span>
                Inactive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Builder */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
            Zones ({zones.length})
          </h3>
          <button
            onClick={handleAddZone}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
            Add Zone
          </button>
        </div>

        {zones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-5 py-8 text-center">
            <span
              className="material-icons-outlined text-[var(--text-muted)]"
              style={{ fontSize: '32px' }}
            >
              grid_view
            </span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No zones defined. Add a zone to start assigning counties.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => {
              const isExpanded = expandedZone === zone.zone_id
              return (
                <div
                  key={zone.zone_id}
                  className="overflow-hidden rounded-lg border border-[var(--border-subtle)]"
                >
                  {/* Zone Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)]"
                    style={isExpanded ? { backgroundColor: 'var(--bg-surface)' } : undefined}
                  >
                    <button
                      onClick={() => setExpandedZone(isExpanded ? null : zone.zone_id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                        {isExpanded ? 'expand_more' : 'chevron_right'}
                      </span>
                    </button>

                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: 'rgba(14,165,233,0.15)' }}
                    >
                      <span
                        className="material-icons-outlined"
                        style={{ fontSize: '16px', color: 'var(--app-prozone, #0ea5e9)' }}
                      >
                        grid_view
                      </span>
                    </span>

                    <input
                      type="text"
                      value={zone.zone_name}
                      onChange={(e) => handleRenameZone(zone.zone_id, e.target.value)}
                      className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--border-subtle)] focus:bg-[var(--bg-surface)] focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />

                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
                      {zone.assignedCounties.length} counties
                    </span>

                    <button
                      onClick={() => handleRemoveZone(zone.zone_id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:text-red-400"
                      title="Remove zone"
                    >
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete_outline</span>
                    </button>
                  </div>

                  {/* County Assignment Panel */}
                  {isExpanded && (
                    <CountyAssignmentPanel
                      zone={zone}
                      countyAssignments={countyAssignments}
                      filteredCounties={filteredCounties}
                      unassignedCount={unassignedCounties.length}
                      countySearch={countySearch}
                      onSearchChange={setCountySearch}
                      onToggleCounty={handleToggleCounty}
                      onAssignAllUnassigned={handleAssignAllUnassigned}
                      onAddZipOverride={handleAddZipOverride}
                      onRemoveZipOverride={handleRemoveZipOverride}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Assignment Summary */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Assignment Summary</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)]">Assigned</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {IOWA_COUNTIES.length - unassignedCounties.length}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)]">Unassigned</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {unassignedCounties.length}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)]">Total Counties</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {IOWA_COUNTIES.length}
            </p>
          </div>
        </div>

        {/* Unassigned list */}
        {unassignedCounties.length > 0 && unassignedCounties.length <= 20 && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-[var(--text-muted)]">Unassigned counties:</p>
            <div className="flex flex-wrap gap-1">
              {unassignedCounties.map((county) => (
                <span
                  key={county}
                  className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
                >
                  {county}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {!isNew && (
            <button
              onClick={handleDeactivate}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                {status === 'Active' ? 'block' : 'check_circle'}
              </span>
              {status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !territoryName.trim()}
            className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
          >
            {saving && (
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'white', borderTopColor: 'transparent' }}
              />
            )}
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span>
            {isNew ? 'Create Territory' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CountyAssignmentPanel — Checklist UI for assigning counties to a zone
// ============================================================================

interface CountyAssignmentPanelProps {
  zone: DraftZone
  countyAssignments: Map<string, string>
  filteredCounties: string[]
  unassignedCount: number
  countySearch: string
  onSearchChange: (q: string) => void
  onToggleCounty: (county: string, zoneId: string) => void
  onAssignAllUnassigned: (zoneId: string) => void
  onAddZipOverride: (zoneId: string, zip: string) => void
  onRemoveZipOverride: (zoneId: string, zip: string) => void
}

function CountyAssignmentPanel({
  zone,
  countyAssignments,
  filteredCounties,
  unassignedCount,
  countySearch,
  onSearchChange,
  onToggleCounty,
  onAssignAllUnassigned,
  onAddZipOverride,
  onRemoveZipOverride,
}: CountyAssignmentPanelProps) {
  const [zipInput, setZipInput] = useState('')
  return (
    <div className="border-t border-[var(--border-subtle)] p-4">
      {/* Search + Bulk Actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <span
            className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            style={{ fontSize: '16px' }}
          >
            search
          </span>
          <input
            type="text"
            value={countySearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter counties..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </div>

        {unassignedCount > 0 && (
          <button
            onClick={() => onAssignAllUnassigned(zone.zone_id)}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>select_all</span>
            Assign all unassigned ({unassignedCount})
          </button>
        )}
      </div>

      {/* County Checklist */}
      <div className="grid max-h-64 grid-cols-2 gap-x-4 gap-y-0.5 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {filteredCounties.map((county) => {
          const assignedTo = countyAssignments.get(county)
          const isInThisZone = assignedTo === zone.zone_id
          const isInOtherZone = assignedTo != null && assignedTo !== zone.zone_id

          return (
            <label
              key={county}
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
                isInOtherZone
                  ? 'cursor-not-allowed opacity-40'
                  : 'hover:bg-[var(--bg-surface)]'
              }`}
              title={
                isInOtherZone
                  ? `Assigned to another zone`
                  : isInThisZone
                    ? `Click to unassign from ${zone.zone_name}`
                    : `Click to assign to ${zone.zone_name}`
              }
            >
              <input
                type="checkbox"
                checked={isInThisZone}
                disabled={isInOtherZone}
                onChange={() => {
                  if (!isInOtherZone) {
                    onToggleCounty(county, zone.zone_id)
                  }
                }}
                className="h-3.5 w-3.5 rounded border-[var(--border-subtle)] accent-[var(--app-prozone,#0ea5e9)]"
              />
              <span
                className={`truncate ${
                  isInThisZone
                    ? 'font-medium text-[var(--text-primary)]'
                    : isInOtherZone
                      ? 'text-[var(--text-muted)] line-through'
                      : 'text-[var(--text-secondary)]'
                }`}
              >
                {county}
              </span>
            </label>
          )
        })}
      </div>

      {/* Currently assigned count */}
      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check_circle</span>
        {zone.assignedCounties.length} of {IOWA_COUNTIES.length} counties assigned to {zone.zone_name}
      </div>

      {/* ZIP Override Section */}
      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>pin_drop</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">ZIP Overrides</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            (ZIP-level assignments take priority over county)
          </span>
        </div>

        {/* Add ZIP input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && zipInput.length === 5) {
                onAddZipOverride(zone.zone_id, zipInput)
                setZipInput('')
              }
            }}
            placeholder="Enter 5-digit ZIP..."
            maxLength={5}
            className="h-8 w-32 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (zipInput.length === 5) {
                onAddZipOverride(zone.zone_id, zipInput)
                setZipInput('')
              }
            }}
            disabled={zipInput.length !== 5}
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
            Add
          </button>
        </div>

        {/* ZIP pill list */}
        {zone.zipOverrides.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {zone.zipOverrides.map((zip) => (
              <span
                key={zip}
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-sky-400"
              >
                {zip}
                <button
                  type="button"
                  onClick={() => onRemoveZipOverride(zone.zone_id, zip)}
                  className="ml-0.5 rounded-full transition-colors hover:text-red-400"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>close</span>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
