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
