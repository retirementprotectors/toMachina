'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'

// ============================================================================
// SpecialistConfigEditor — Admin form for specialist configuration CRUD
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 'I' | 'II' | 'III' | 'IV'
type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'

interface TierMapEntry {
  zone_id: string
  tier: Tier
  drive_minutes: number
  slots_per_day: number
  first_slot: string
  last_slot: string
}

interface SlotTemplate {
  tier: Tier
  slots_per_day: number
  first_slot: string
  last_slot: string
  slot_duration_minutes: number
  departure_time?: string
  return_time?: string
}

interface MeetingCriteria {
  field: { active_la: boolean; intra_territory: boolean; max_age: number }
  office: { active_la: boolean; min_age?: number; outer_zone: boolean }
}

interface ZoneLeadCriteria {
  active_medicare_all: boolean
  active_la_80plus: boolean
  no_core_under_80: boolean
}

interface TeamMember {
  user_id: string
  name: string
  role: 'coordinator' | 'associate'
}

interface FullSpecialistConfig {
  config_id: string
  user_id: string
  specialist_name: string
  territory_id: string
  origin_zip: string
  tier_map: TierMapEntry[]
  office_days: DayOfWeek[]
  field_days: DayOfWeek[]
  slot_templates: SlotTemplate[]
  meeting_criteria: MeetingCriteria
  zone_lead_criteria: ZoneLeadCriteria
  calendar_booking_url?: string
  team: TeamMember[]
  config_status: 'Active' | 'Inactive'
  created_at: string
  updated_at: string
}

interface TerritoryOption {
  territory_id: string
  territory_name: string
  zones?: Array<{ zone_id: string; zone_name: string }>
}

// Summary shape for the list view (from GET /api/specialist-configs)
interface ConfigSummary {
  config_id: string
  specialist_name: string
  territory_id: string
  territory_name?: string
  origin_zip: string
  office_days?: DayOfWeek[]
  field_days?: DayOfWeek[]
  config_status: 'Active' | 'Inactive'
  tier_map?: TierMapEntry[]
}

interface SpecialistConfigEditorProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const ALL_TIERS: Tier[] = ['I', 'II', 'III', 'IV']

const EMPTY_MEETING_CRITERIA: MeetingCriteria = {
  field: { active_la: false, intra_territory: false, max_age: 85 },
  office: { active_la: false, min_age: undefined, outer_zone: false },
}

const EMPTY_ZONE_LEAD_CRITERIA: ZoneLeadCriteria = {
  active_medicare_all: false,
  active_la_80plus: false,
  no_core_under_80: false,
}

function emptySlotTemplates(): SlotTemplate[] {
  return ALL_TIERS.map((tier) => ({
    tier,
    slots_per_day: tier === 'IV' ? 2 : tier === 'III' ? 3 : tier === 'II' ? 4 : 6,
    first_slot: '09:00',
    last_slot: '16:00',
    slot_duration_minutes: 60,
    ...(tier === 'IV' ? { departure_time: '07:00', return_time: '18:00' } : {}),
  }))
}

function blankConfig(): Omit<FullSpecialistConfig, 'config_id' | 'created_at' | 'updated_at'> {
  return {
    user_id: '',
    specialist_name: '',
    territory_id: '',
    origin_zip: '',
    tier_map: [],
    office_days: [],
    field_days: [],
    slot_templates: emptySlotTemplates(),
    meeting_criteria: structuredClone(EMPTY_MEETING_CRITERIA),
    zone_lead_criteria: structuredClone(EMPTY_ZONE_LEAD_CRITERIA),
    calendar_booking_url: '',
    team: [],
    config_status: 'Active',
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: 'var(--app-prozone, #0ea5e9)', borderTopColor: 'transparent' }}
      />
      <span className="ml-3 text-sm text-[var(--text-muted)]">{label}</span>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <span
        className="material-icons-outlined"
        style={{ fontSize: '18px', color: 'var(--app-prozone, #0ea5e9)' }}
      >
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
    </div>
  )
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-[var(--text-secondary)]">
      {children}
    </label>
  )
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--app-prozone,#0ea5e9)] focus:outline-none focus:ring-1 focus:ring-[var(--app-prozone,#0ea5e9)]"
    />
  )
}

function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  id: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  placeholder?: string
}) {
  return (
    <input
      id={id}
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? undefined : Number(raw))
      }}
      min={min}
      max={max}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--app-prozone,#0ea5e9)] focus:outline-none focus:ring-1 focus:ring-[var(--app-prozone,#0ea5e9)]"
    />
  )
}

function TimeInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      id={id}
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--app-prozone,#0ea5e9)] focus:outline-none focus:ring-1 focus:ring-[var(--app-prozone,#0ea5e9)]"
    />
  )
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--app-prozone,#0ea5e9)]"
      />
      <span className="text-sm text-[var(--text-primary)]">{label}</span>
    </label>
  )
}

// Toast helper — inserted as a floating div, auto-removes
function showToast(message: string, type: 'success' | 'error') {
  const el = document.createElement('div')
  el.className = `fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition-all ${
    type === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-red-600 text-white'
  }`
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

// ============================================================================
// Main Component
// ============================================================================

export default function SpecialistConfigEditor({ portal }: SpecialistConfigEditorProps) {
  // ---- List view state ----
  const [configs, setConfigs] = useState<ConfigSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // ---- Editor state ----
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(blankConfig())
  const [territories, setTerritories] = useState<TerritoryOption[]>([])
  const [territoryZones, setTerritoryZones] = useState<Array<{ zone_id: string; zone_name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch config list
  // ---------------------------------------------------------------------------
  const loadConfigs = useCallback(async () => {
    try {
      setListLoading(true)
      setListError(null)
      const res = await fetchWithAuth('/api/specialist-configs')
      const json = (await res.json()) as { success: boolean; data?: ConfigSummary[]; error?: string }
      if (json.success && json.data) {
        setConfigs(json.data)
      } else {
        setListError(json.error || 'Failed to load configs')
      }
    } catch {
      setListError('Network error loading configs')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  // ---------------------------------------------------------------------------
  // Fetch territories (for dropdown) when entering editor
  // ---------------------------------------------------------------------------
  const loadTerritories = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/territories')
      const json = (await res.json()) as { success: boolean; data?: TerritoryOption[]; error?: string }
      if (json.success && json.data) {
        setTerritories(json.data)
      }
    } catch {
      // silent — territory list is supplementary
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Load zones for the selected territory
  // ---------------------------------------------------------------------------
  const loadTerritoryZones = useCallback(async (territoryId: string) => {
    if (!territoryId) {
      setTerritoryZones([])
      return
    }
    try {
      const res = await fetchWithAuth(`/api/territories/${territoryId}`)
      const json = (await res.json()) as {
        success: boolean
        data?: { zones?: Array<{ zone_id: string; zone_name: string }> }
        error?: string
      }
      if (json.success && json.data?.zones) {
        setTerritoryZones(json.data.zones)
      } else {
        setTerritoryZones([])
      }
    } catch {
      setTerritoryZones([])
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Enter create mode
  // ---------------------------------------------------------------------------
  const handleCreate = useCallback(async () => {
    setMode('create')
    setEditingId(null)
    setForm(blankConfig())
    setFormError(null)
    setTerritoryZones([])
    await loadTerritories()
  }, [loadTerritories])

  // ---------------------------------------------------------------------------
  // Enter edit mode — fetch full config
  // ---------------------------------------------------------------------------
  const handleEdit = useCallback(async (configId: string) => {
    setMode('edit')
    setEditingId(configId)
    setFormError(null)
    setFormLoading(true)

    await loadTerritories()

    try {
      const res = await fetchWithAuth(`/api/specialist-configs/${configId}`)
      const json = (await res.json()) as { success: boolean; data?: FullSpecialistConfig; error?: string }
      if (json.success && json.data) {
        const d = json.data
        setForm({
          user_id: d.user_id || '',
          specialist_name: d.specialist_name || '',
          territory_id: d.territory_id || '',
          origin_zip: d.origin_zip || '',
          tier_map: d.tier_map || [],
          office_days: d.office_days || [],
          field_days: d.field_days || [],
          slot_templates: d.slot_templates?.length ? d.slot_templates : emptySlotTemplates(),
          meeting_criteria: d.meeting_criteria || structuredClone(EMPTY_MEETING_CRITERIA),
          zone_lead_criteria: d.zone_lead_criteria || structuredClone(EMPTY_ZONE_LEAD_CRITERIA),
          calendar_booking_url: d.calendar_booking_url || '',
          team: d.team || [],
          config_status: d.config_status || 'Active',
        })
        if (d.territory_id) {
          await loadTerritoryZones(d.territory_id)
        }
      } else {
        setFormError(json.error || 'Failed to load config')
      }
    } catch {
      setFormError('Network error loading config')
    } finally {
      setFormLoading(false)
    }
  }, [loadTerritories, loadTerritoryZones])

  // ---------------------------------------------------------------------------
  // Back to list
  // ---------------------------------------------------------------------------
  const handleBack = useCallback(() => {
    setMode('list')
    setEditingId(null)
    setFormError(null)
    loadConfigs()
  }, [loadConfigs])

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    // Basic validation
    if (!form.specialist_name.trim()) {
      setFormError('Specialist name is required')
      return
    }
    if (!form.territory_id) {
      setFormError('Territory is required')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const url = mode === 'create' ? '/api/specialist-configs' : `/api/specialist-configs/${editingId}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(form),
      })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (json.success) {
        showToast(
          mode === 'create' ? 'Specialist config created' : 'Specialist config updated',
          'success',
        )
        handleBack()
      } else {
        setFormError(json.error || 'Save failed')
      }
    } catch {
      setFormError('Network error saving config')
    } finally {
      setSaving(false)
    }
  }, [form, mode, editingId, handleBack])

  // ---------------------------------------------------------------------------
  // Form field updaters
  // ---------------------------------------------------------------------------
  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleDay = useCallback((dayType: 'office_days' | 'field_days', day: DayOfWeek) => {
    setForm((prev) => {
      const oppositeKey = dayType === 'office_days' ? 'field_days' : 'office_days'
      const current = prev[dayType] as DayOfWeek[]
      const opposite = prev[oppositeKey] as DayOfWeek[]

      if (current.includes(day)) {
        // Remove from current list
        return { ...prev, [dayType]: current.filter((d) => d !== day) }
      }
      // Add to current, remove from opposite (a day can't be both)
      return {
        ...prev,
        [dayType]: [...current, day],
        [oppositeKey]: opposite.filter((d) => d !== day),
      }
    })
  }, [])

  const updateSlotTemplate = useCallback((tier: Tier, key: keyof SlotTemplate, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      slot_templates: prev.slot_templates.map((st) =>
        st.tier === tier ? { ...st, [key]: value } : st,
      ),
    }))
  }, [])

  const updateTierMapEntry = useCallback((zoneId: string, key: keyof TierMapEntry, value: string | number) => {
    setForm((prev) => {
      const existing = prev.tier_map.find((t) => t.zone_id === zoneId)
      if (existing) {
        return {
          ...prev,
          tier_map: prev.tier_map.map((t) =>
            t.zone_id === zoneId ? { ...t, [key]: value } : t,
          ),
        }
      }
      // Create new entry
      const entry: TierMapEntry = {
        zone_id: zoneId,
        tier: 'I',
        drive_minutes: 0,
        slots_per_day: 6,
        first_slot: '09:00',
        last_slot: '16:00',
        [key]: value,
      }
      return { ...prev, tier_map: [...prev.tier_map, entry] }
    })
  }, [])

  const addTeamMember = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      team: [...prev.team, { user_id: '', name: '', role: 'associate' as const }],
    }))
  }, [])

  const updateTeamMember = useCallback((idx: number, key: keyof TeamMember, value: string) => {
    setForm((prev) => ({
      ...prev,
      team: prev.team.map((m, i) => (i === idx ? { ...m, [key]: value } : m)),
    }))
  }, [])

  const removeTeamMember = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      team: prev.team.filter((_, i) => i !== idx),
    }))
  }, [])

  // Handle territory change — reload zones
  const handleTerritoryChange = useCallback(async (territoryId: string) => {
    updateField('territory_id', territoryId)
    updateField('tier_map', [])
    await loadTerritoryZones(territoryId)
  }, [updateField, loadTerritoryZones])

  // =========================================================================
  // RENDER — List View
  // =========================================================================
  if (mode === 'list') {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div
          className="rounded-xl border border-[var(--border-subtle)] px-6 py-4"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.03))' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(14,165,233,0.15)' }}
              >
                <span
                  className="material-icons-outlined"
                  style={{ fontSize: '22px', color: 'var(--app-prozone, #0ea5e9)' }}
                >
                  tune
                </span>
              </span>
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">Specialist Configs</h1>
                <p className="text-xs text-[var(--text-muted)]">ProZone Admin</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="btn btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
              Add Specialist
            </button>
          </div>
        </div>

        {/* Loading */}
        {listLoading && <Spinner label="Loading specialist configs..." />}

        {/* Error */}
        {listError && <ErrorBanner message={listError} />}

        {/* Config Grid */}
        {!listLoading && !listError && configs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {configs.map((cfg) => (
              <button
                key={cfg.config_id}
                onClick={() => handleEdit(cfg.config_id)}
                className="card-elevated rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-left transition-all hover:border-[var(--app-prozone,#0ea5e9)] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'rgba(14,165,233,0.1)' }}
                    >
                      <span
                        className="material-icons-outlined"
                        style={{ fontSize: '20px', color: 'var(--app-prozone, #0ea5e9)' }}
                      >
                        person
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {cfg.specialist_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                        {cfg.territory_name || cfg.territory_id}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cfg.config_status === 'Active' ? 'badge-active' : 'badge-inactive'}
                  >
                    {cfg.config_status}
                  </span>
                </div>

                {/* Meta row */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                  {cfg.origin_zip && (
                    <span className="flex items-center gap-1">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>pin_drop</span>
                      {cfg.origin_zip}
                    </span>
                  )}
                  {cfg.tier_map && cfg.tier_map.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>layers</span>
                      {cfg.tier_map.length} tiers
                    </span>
                  )}
                </div>

                {/* Day pills */}
                {(cfg.office_days?.length || cfg.field_days?.length) ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(cfg.office_days || []).map((d) => (
                      <span
                        key={`o-${d}`}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--app-prozone, #0ea5e9) 12%, transparent)',
                          color: 'var(--app-prozone, #0ea5e9)',
                        }}
                      >
                        {d.slice(0, 3)} (O)
                      </span>
                    ))}
                    {(cfg.field_days || []).map((d) => (
                      <span
                        key={`f-${d}`}
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
                      >
                        {d.slice(0, 3)} (F)
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!listLoading && !listError && configs.length === 0 && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-16 text-center">
            <span
              className="material-icons-outlined"
              style={{ fontSize: '48px', color: 'var(--text-muted)' }}
            >
              person_off
            </span>
            <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
              No Specialist Configs
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Add your first specialist to configure territories, schedules, and meeting criteria.
            </p>
            <button
              onClick={handleCreate}
              className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
              style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
              Add Specialist
            </button>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // RENDER — Create / Edit Form
  // =========================================================================
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3">
        <button
          onClick={handleBack}
          className="btn btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {mode === 'create' ? 'New Specialist Config' : 'Edit Specialist Config'}
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
        >
          {saving ? (
            <>
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: '#fff', borderTopColor: 'transparent' }}
              />
              Saving...
            </>
          ) : (
            <>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>save</span>
              Save
            </>
          )}
        </button>
      </div>

      {/* Form Error */}
      {formError && <ErrorBanner message={formError} />}

      {/* Form Loading */}
      {formLoading && <Spinner label="Loading config..." />}

      {!formLoading && (
        <div className="space-y-5">
          {/* ------------------------------------------------------------------ */}
          {/* Section 1: Basic Info */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="badge" title="Basic Info" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="specialist_name">Specialist Name *</FieldLabel>
                <TextInput
                  id="specialist_name"
                  value={form.specialist_name}
                  onChange={(v) => updateField('specialist_name', v)}
                  placeholder="e.g. Arch Shaner"
                />
              </div>
              <div>
                <FieldLabel htmlFor="user_id">User ID</FieldLabel>
                <TextInput
                  id="user_id"
                  value={form.user_id}
                  onChange={(v) => updateField('user_id', v)}
                  placeholder="Firestore user ID"
                />
              </div>
              <div>
                <FieldLabel htmlFor="territory_id">Territory *</FieldLabel>
                <select
                  id="territory_id"
                  value={form.territory_id}
                  onChange={(e) => handleTerritoryChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--app-prozone,#0ea5e9)] focus:outline-none focus:ring-1 focus:ring-[var(--app-prozone,#0ea5e9)]"
                >
                  <option value="">Select territory...</option>
                  {territories.map((t) => (
                    <option key={t.territory_id} value={t.territory_id}>
                      {t.territory_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="origin_zip">Origin ZIP</FieldLabel>
                <TextInput
                  id="origin_zip"
                  value={form.origin_zip}
                  onChange={(v) => updateField('origin_zip', v)}
                  placeholder="50265"
                />
              </div>
              <div>
                <FieldLabel htmlFor="calendar_booking_url">Calendar Booking URL</FieldLabel>
                <TextInput
                  id="calendar_booking_url"
                  value={form.calendar_booking_url || ''}
                  onChange={(v) => updateField('calendar_booking_url', v)}
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-3 py-2">
                  <FieldLabel>Status</FieldLabel>
                  <button
                    type="button"
                    onClick={() =>
                      updateField('config_status', form.config_status === 'Active' ? 'Inactive' : 'Active')
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      form.config_status === 'Active' ? '' : 'bg-[var(--bg-surface)]'
                    }`}
                    style={
                      form.config_status === 'Active'
                        ? { backgroundColor: 'var(--app-prozone, #0ea5e9)' }
                        : undefined
                    }
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                        form.config_status === 'Active' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-[var(--text-primary)]">{form.config_status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Section 2: Schedule */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="calendar_month" title="Schedule" />

            {/* Office Days */}
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Office Days</p>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const isOffice = form.office_days.includes(day)
                  return (
                    <button
                      key={`office-${day}`}
                      type="button"
                      onClick={() => toggleDay('office_days', day)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        isOffice
                          ? 'border-transparent text-white'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      style={
                        isOffice
                          ? { backgroundColor: 'var(--app-prozone, #0ea5e9)' }
                          : undefined
                      }
                    >
                      {day.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Field Days */}
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Field Days</p>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => {
                  const isField = form.field_days.includes(day)
                  return (
                    <button
                      key={`field-${day}`}
                      type="button"
                      onClick={() => toggleDay('field_days', day)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        isField
                          ? 'border-transparent text-white'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      style={
                        isField
                          ? { backgroundColor: 'rgb(245, 158, 11)' }
                          : undefined
                      }
                    >
                      {day.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                A day can only be Office or Field, not both. Selecting one automatically removes it from the other.
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Section 3: Tier Map */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="layers" title="Tier Map" />

            {territoryZones.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                {form.territory_id
                  ? 'No zones found for this territory.'
                  : 'Select a territory above to configure tier assignments.'}
              </p>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_100px_100px] gap-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Zone</span>
                  <span>Tier</span>
                  <span>Drive (min)</span>
                </div>
                {territoryZones.map((zone) => {
                  const entry = form.tier_map.find((t) => t.zone_id === zone.zone_id)
                  return (
                    <div
                      key={zone.zone_id}
                      className="grid grid-cols-[1fr_100px_100px] items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2"
                    >
                      <span className="truncate text-sm text-[var(--text-primary)]">{zone.zone_name}</span>
                      <select
                        value={entry?.tier || 'I'}
                        onChange={(e) => updateTierMapEntry(zone.zone_id, 'tier', e.target.value)}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                      >
                        {ALL_TIERS.map((t) => (
                          <option key={t} value={t}>Tier {t}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={entry?.drive_minutes ?? 0}
                        onChange={(e) => updateTierMapEntry(zone.zone_id, 'drive_minutes', Number(e.target.value))}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Section 4: Slot Templates */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="schedule" title="Slot Templates" />

            <div className="space-y-3">
              {form.slot_templates.map((st) => (
                <div
                  key={st.tier}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
                >
                  <p className="mb-3 text-xs font-semibold text-[var(--text-primary)]">Tier {st.tier}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <FieldLabel htmlFor={`slots-${st.tier}`}>Slots/Day</FieldLabel>
                      <NumberInput
                        id={`slots-${st.tier}`}
                        value={st.slots_per_day}
                        onChange={(v) => updateSlotTemplate(st.tier, 'slots_per_day', v ?? 0)}
                        min={0}
                        max={20}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`first-${st.tier}`}>First Slot</FieldLabel>
                      <TimeInput
                        id={`first-${st.tier}`}
                        value={st.first_slot}
                        onChange={(v) => updateSlotTemplate(st.tier, 'first_slot', v)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`last-${st.tier}`}>Last Slot</FieldLabel>
                      <TimeInput
                        id={`last-${st.tier}`}
                        value={st.last_slot}
                        onChange={(v) => updateSlotTemplate(st.tier, 'last_slot', v)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`dur-${st.tier}`}>Duration (min)</FieldLabel>
                      <NumberInput
                        id={`dur-${st.tier}`}
                        value={st.slot_duration_minutes}
                        onChange={(v) => updateSlotTemplate(st.tier, 'slot_duration_minutes', v ?? 60)}
                        min={15}
                        max={240}
                      />
                    </div>
                  </div>

                  {/* Tier IV extras */}
                  {st.tier === 'IV' && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel htmlFor="departure-IV">Departure Time</FieldLabel>
                        <TimeInput
                          id="departure-IV"
                          value={st.departure_time || ''}
                          onChange={(v) => updateSlotTemplate('IV', 'departure_time', v)}
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor="return-IV">Return Time</FieldLabel>
                        <TimeInput
                          id="return-IV"
                          value={st.return_time || ''}
                          onChange={(v) => updateSlotTemplate('IV', 'return_time', v)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Section 5: Meeting Criteria */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="checklist" title="Meeting Criteria" />

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Field criteria */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Field Meetings</p>
                <Checkbox
                  id="field-active-la"
                  checked={form.meeting_criteria.field.active_la}
                  onChange={(v) =>
                    updateField('meeting_criteria', {
                      ...form.meeting_criteria,
                      field: { ...form.meeting_criteria.field, active_la: v },
                    })
                  }
                  label="Active L&A required"
                />
                <Checkbox
                  id="field-intra-territory"
                  checked={form.meeting_criteria.field.intra_territory}
                  onChange={(v) =>
                    updateField('meeting_criteria', {
                      ...form.meeting_criteria,
                      field: { ...form.meeting_criteria.field, intra_territory: v },
                    })
                  }
                  label="Intra-territory only"
                />
                <div>
                  <FieldLabel htmlFor="field-max-age">Max Age</FieldLabel>
                  <NumberInput
                    id="field-max-age"
                    value={form.meeting_criteria.field.max_age}
                    onChange={(v) =>
                      updateField('meeting_criteria', {
                        ...form.meeting_criteria,
                        field: { ...form.meeting_criteria.field, max_age: v ?? 85 },
                      })
                    }
                    min={50}
                    max={120}
                  />
                </div>
              </div>

              {/* Office criteria */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Office Meetings</p>
                <Checkbox
                  id="office-active-la"
                  checked={form.meeting_criteria.office.active_la}
                  onChange={(v) =>
                    updateField('meeting_criteria', {
                      ...form.meeting_criteria,
                      office: { ...form.meeting_criteria.office, active_la: v },
                    })
                  }
                  label="Active L&A required"
                />
                <Checkbox
                  id="office-outer-zone"
                  checked={form.meeting_criteria.office.outer_zone}
                  onChange={(v) =>
                    updateField('meeting_criteria', {
                      ...form.meeting_criteria,
                      office: { ...form.meeting_criteria.office, outer_zone: v },
                    })
                  }
                  label="Outer zone eligible"
                />
                <div>
                  <FieldLabel htmlFor="office-min-age">Min Age (optional)</FieldLabel>
                  <NumberInput
                    id="office-min-age"
                    value={form.meeting_criteria.office.min_age}
                    onChange={(v) =>
                      updateField('meeting_criteria', {
                        ...form.meeting_criteria,
                        office: { ...form.meeting_criteria.office, min_age: v },
                      })
                    }
                    min={50}
                    max={120}
                    placeholder="No minimum"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Section 6: Zone Lead Criteria */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="leaderboard" title="Zone Lead Criteria" />

            <div className="space-y-3">
              <Checkbox
                id="zlc-medicare-all"
                checked={form.zone_lead_criteria.active_medicare_all}
                onChange={(v) =>
                  updateField('zone_lead_criteria', {
                    ...form.zone_lead_criteria,
                    active_medicare_all: v,
                  })
                }
                label="Active Medicare (all ages)"
              />
              <Checkbox
                id="zlc-la-80plus"
                checked={form.zone_lead_criteria.active_la_80plus}
                onChange={(v) =>
                  updateField('zone_lead_criteria', {
                    ...form.zone_lead_criteria,
                    active_la_80plus: v,
                  })
                }
                label="Active L&A (80+)"
              />
              <Checkbox
                id="zlc-no-core-under-80"
                checked={form.zone_lead_criteria.no_core_under_80}
                onChange={(v) =>
                  updateField('zone_lead_criteria', {
                    ...form.zone_lead_criteria,
                    no_core_under_80: v,
                  })
                }
                label="No core product (under 80)"
              />
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Section 7: Team */}
          {/* ------------------------------------------------------------------ */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <SectionHeader icon="group" title="Team" />

            {form.team.length === 0 && (
              <p className="py-2 text-center text-sm text-[var(--text-muted)]">
                No team members added yet.
              </p>
            )}

            <div className="space-y-2">
              {form.team.map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2"
                >
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateTeamMember(idx, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                  <select
                    value={member.role}
                    onChange={(e) => updateTeamMember(idx, 'role', e.target.value)}
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="coordinator">Coordinator</option>
                    <option value="associate">Associate</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeTeamMember(idx)}
                    className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addTeamMember}
              className="btn btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>person_add</span>
              Add Team Member
            </button>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Bottom Save Bar */}
          {/* ------------------------------------------------------------------ */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3">
            <button onClick={handleBack} className="btn btn-secondary rounded-lg px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-1.5 rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--app-prozone, #0ea5e9)' }}
            >
              {saving ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: '#fff', borderTopColor: 'transparent' }}
                  />
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>save</span>
                  {mode === 'create' ? 'Create Config' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
