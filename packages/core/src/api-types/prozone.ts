/**
 * API DTOs — Group 7: ProZone / Specialist / Territory / Unit Defaults
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/prozone.ts
 *   services/api/src/routes/specialist-configs.ts
 *   services/api/src/routes/territories.ts
 *   services/api/src/routes/unit-defaults.ts
 */

import type {
  Territory,
  SpecialistConfig,
} from '../types'

import type { UnitModuleDefaultDef } from '../users'

// ============================================================================
// TERRITORIES — services/api/src/routes/territories.ts
// ============================================================================

/** GET /api/territories — paginated list */
export type TerritoryListDTO = TerritoryDTO[]

/** GET /api/territories/:id — single territory with zones */
/** POST /api/territories — created territory echoed back */
/** PATCH /api/territories/:id — updated territory echoed back */
export type TerritoryDTO = Territory & { id: string }

// ============================================================================
// SPECIALIST CONFIGS — services/api/src/routes/specialist-configs.ts
// ============================================================================

/** GET /api/specialist-configs — paginated list */
export type SpecialistConfigListDTO = SpecialistConfigDTO[]

/** GET /api/specialist-configs/:id — single specialist config */
/** POST /api/specialist-configs — created config echoed back */
/** PATCH /api/specialist-configs/:id — updated config echoed back */
export type SpecialistConfigDTO = SpecialistConfig & { id: string }

// ============================================================================
// UNIT DEFAULTS — services/api/src/routes/unit-defaults.ts
// ============================================================================

/** GET /api/unit-defaults — list all unit module defaults */
export type UnitDefaultListDTO = UnitDefaultDTO[]

/** GET /api/unit-defaults item / PUT /api/unit-defaults/:unitKey result */
export type UnitDefaultDTO = UnitModuleDefaultDef & {
  id: string
  updated_at?: string
}

// ============================================================================
// PROZONE — services/api/src/routes/prozone.ts
// ============================================================================

// ─── Prospects ─────────────────────────────────────────────────────────────

/** Product inventory flags for a single prospect */
export interface ProspectInventory {
  has_medicare: boolean
  has_life: boolean
  has_annuity: boolean
  has_ria: boolean
  has_bd: boolean
}

/** Active pipeline data attached to a prospect (if any) */
export interface ProspectPipelineRef {
  pipeline_key: string
  stage: string
  priority: string
}

/** Single prospect within a zone group */
export interface ProspectDTO {
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
  inventory: ProspectInventory
  flags: string[]
  meeting_type: 'field' | 'office' | 'none'
  pipeline?: ProspectPipelineRef
  /** Present on cross-sell prospects only */
  cross_sell_from?: string
}

/** Age distribution within a zone */
export interface AgeBuckets {
  under_60: number
  '60_64': number
  '65_80': number
  '80_plus': number
}

/** A zone group with its prospects and summary stats */
export interface ProspectZoneDTO {
  zone_id: string
  zone_name: string
  tier: string
  prospects: ProspectDTO[]
  prospect_count: number
  flagged_count: number
  flag_summary: Record<string, number>
  age_buckets: AgeBuckets
  bob_breakdown: Record<string, number>
}

/** Flat-mode prospect (includes zone metadata per-row) */
export type FlatProspectDTO = ProspectDTO & {
  zone_id: string
  zone_name: string
  zone_tier: string
}

/** Pagination / offset metadata */
export interface ProspectMeta {
  offset: number
  limit: number
  total: number
}

/** GET /api/prozone/prospects/:specialist_id — zone-grouped mode (default) */
export interface ProspectsByZoneData {
  specialist: string
  territory: string
  zones: ProspectZoneDTO[]
  total_prospects: number
  total_flagged: number
  total_in_pipeline: number
  meta: ProspectMeta
}

/** GET /api/prozone/prospects/:specialist_id?flat=true — flat mode */
export interface ProspectsFlatData {
  specialist: string
  territory: string
  prospects: FlatProspectDTO[]
  total_prospects: number
  total_flagged: number
  total_in_pipeline: number
  meta: ProspectMeta
}

// ─── Schedule ──────────────────────────────────────────────────────────────

/** A single time slot on a schedule day */
export interface ScheduleSlot {
  time: string
  duration_minutes: number
  status: 'available' | 'booked'
  /** Field-day slots include tier and zone list */
  tier?: string
  zones?: string[]
  departure_time?: string
  return_time?: string
}

/** A single day in the weekly schedule */
export interface ScheduleDay {
  date: string
  day: string
  type: 'office' | 'field' | 'off'
  slots: ScheduleSlot[]
}

/** GET /api/prozone/schedule/:specialist_id/:week */
export interface ScheduleData {
  specialist: string
  week: string
  week_start: string
  week_end: string
  schedule: ScheduleDay[]
}

// ─── Zone Leads (deprecated) ───────────────────────────────────────────────

/** A single zone lead entry */
export interface ZoneLeadDTO {
  client_id: string
  first_name: string
  last_name: string
  county: string
  city: string
  zip: string
  age: number | null
  reasons: string[]
}

/**
 * GET /api/prozone/zone-leads/:specialist_id/:zone_id
 * @deprecated Superseded by /prospects/:specialist_id with inline flags.
 */
export interface ZoneLeadsData {
  zone_id: string
  specialist: string
  territory: string
  leads: ZoneLeadDTO[]
  total: number
}

// ─── Scorecard ─────────────────────────────────────────────────────────────

/** GET /api/prozone/scorecard */
export interface ScorecardData {
  attempts: number
  connected: number
  booked: number
  percentages: {
    connected: number
    booked: number
  }
  filters: {
    specialist_id: string
    timeline: string
    team: string
    pipeline: string
  }
}

// ─── Enroll ────────────────────────────────────────────────────────────────

/** POST /api/prozone/enroll */
export interface EnrollResult {
  enrolled: number
  already_enrolled: number
  total: number
}
