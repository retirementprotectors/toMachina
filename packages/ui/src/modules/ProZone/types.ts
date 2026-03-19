// ProZone local types — mirrors @tomachina/core ProZone types when available.
// Defined here to avoid blocking on core package changes.

export interface TierMapEntry {
  county: string
  fips: string
  state: string
  tier: 'I' | 'II' | 'III' | 'IV'
}

export interface Zone {
  zone_id: string
  zone_name: string
  tier: 'I' | 'II' | 'III' | 'IV'
  origin_zip: string
  counties: TierMapEntry[]
  drive_minutes?: number
}

export interface Territory {
  territory_id: string
  territory_name: string
  origin_zip: string
  origin_county: string
  origin_state: string
  zones: Zone[]
  total_counties: number
  created_at: string
  updated_at: string
}

export interface SpecialistConfig {
  config_id: string
  specialist_name: string
  specialist_email: string
  territory_id: string
  territory_name: string
  origin_zip: string
  zone_count: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface InventoryFlags {
  has_medicare: boolean
  has_life: boolean
  has_annuity: boolean
  has_ria: boolean
  has_bd: boolean
}

export interface ProspectWithInventory {
  client_id: string
  first_name: string
  last_name: string
  county: string
  city: string
  zip: string
  phone: string
  age: number | null
  client_status: string
  source: string
  inventory: InventoryFlags
  flags: string[]
  meeting_type: 'field' | 'office' | 'none'
  pipeline?: { pipeline_key: string; stage: string; priority: string }
  cross_sell_from?: string
}

export interface ZoneWithProspects {
  zone_id: string
  zone_name: string
  tier: 'I' | 'II' | 'III' | 'IV'
  prospects: ProspectWithInventory[]
  prospect_count: number
  flagged_count: number
  flag_summary: Record<string, number>
  age_buckets: { under_60: number; '60_64': number; '65_80': number; '80_plus': number }
  bob_breakdown: Record<string, number>
}

// Legacy types — retained for ScheduleView + admin components
export interface Prospect {
  prospect_id: string
  first_name: string
  last_name: string
  county: string
  city: string
  state: string
  zip: string
  age: number
  zone_id: string
  zone_name: string
  tier: 'I' | 'II' | 'III' | 'IV'
  tags?: string[]
}

export interface ScheduleSlot {
  slot_id: string
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
  start_time: string
  end_time: string
  duration_minutes: number
  slot_type: 'office' | 'field'
  zone_id?: string
  zone_name?: string
  tier?: 'I' | 'II' | 'III' | 'IV'
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
}

export interface WeekSchedule {
  week_label: string
  year: number
  week_number: number
  slots: ScheduleSlot[]
}

export interface ScheduleDay {
  date: string
  day: string
  type: 'office' | 'field' | 'off'
  slots: Array<{
    time: string
    duration_minutes: number
    tier?: string
    zones?: string[]
    status: string
  }>
}

export interface ZoneLead {
  lead_id: string
  first_name: string
  last_name: string
  age: number
  county: string
  city: string
  reason: string
  zone_id: string
  zone_name: string
}

export interface CountyRow {
  county: string
  zone_id: string
  zone_name: string
  tier: 'I' | 'II' | 'III' | 'IV'
  client_count: number
}

// ─── Scorecard types ───
export interface ScorecardData {
  attempts: number
  connected: number
  booked: number
  percentages: {
    connected: number
    booked: number
  }
}

// ─── Tab types ───
export type ProZoneTab = 'team' | 'market' | 'target' | 'flow' | 'inventory'
