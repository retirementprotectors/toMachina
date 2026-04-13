// ProZone view types — derived from @tomachina/core where fields overlap.
// Uses Pick<CoreType, ...> & { local fields } to stay in sync with core
// while adding UI-specific properties the core entity doesn't carry.

import type {
  Territory as CoreTerritory,
  Zone as CoreZone,
  SpecialistConfig as CoreSpecialistConfig,
} from '@tomachina/core'

// ─── TierMapEntry ───
// Core TierMapEntry is a scheduling config (zone_id, slots_per_day, first_slot, last_slot).
// ProZone's TierMapEntry is a geographic lookup row (county, fips, state).
// These are structurally different view models — no Pick<> relationship.
export interface TierMapEntry {
  county: string
  fips: string
  state: string
  tier: 'I' | 'II' | 'III' | 'IV'
}

// ─── Zone ───
// Core Zone is a territory subdivision (territory_id, resolution_type, assignments).
// ProZone Zone is a UI view with tier, origin_zip, drive_minutes, and nested counties.
export type Zone = Pick<CoreZone, 'zone_id' | 'zone_name'> & {
  tier: 'I' | 'II' | 'III' | 'IV'
  origin_zip: string
  counties: TierMapEntry[]
  drive_minutes?: number
}

// ─── Territory ───
// Core Territory has state/region/territory_status/counties(TerritoryCounty[]).
// ProZone Territory is an origin-centric view with origin_zip/county/state + Zone[].
export type Territory = Pick<CoreTerritory, 'territory_id' | 'territory_name' | 'created_at' | 'updated_at'> & {
  origin_zip: string
  origin_county: string
  origin_state: string
  zones: Zone[]
  total_counties: number
}

// ─── SpecialistConfig ───
// Subset of core SpecialistConfig + UI summary fields (territory_name, zone_count, email).
export type SpecialistConfig = Pick<CoreSpecialistConfig, 'config_id' | 'specialist_name' | 'territory_id' | 'origin_zip' | 'created_at' | 'updated_at'> & {
  specialist_email: string
  territory_name: string
  zone_count: number
  status: 'active' | 'inactive'
}

// ─── ProZone-specific view models (no core equivalent) ───

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
  status: string
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
