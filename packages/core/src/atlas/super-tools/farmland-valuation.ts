// ---------------------------------------------------------------------------
// Super Tool: SUPER_FARMLAND_VALUATION
//
// Ensemble valuation of a single farm parcel. Reads cache-first from the
// `farmland_values` collection (populated by WIRE_FARMLAND_VALUE_SEED
// annually), combines ISU Extension (Iowa) + USDA NASS (national) into a
// single estimate with an explicit confidence band.
//
// Sprint: SPR-FARMLAND-VALUATION-001 (FV-004)
// ZRD: ZRD-PLATFORM-FARMLAND-VALUATION-API
//
// Contract (per MEGAZORD CIO rulings, 2026-04-14) — primary_source values:
//
//   'ENSEMBLE_ISU_NASS'
//     Both ISU + NASS rows cached for (state, county, year). ISU is the
//     reported value; NASS is the cross-check. `delta` = |ISU − NASS| /
//     max(ISU, NASS). Confidence by delta band:
//       HIGH   when delta < 0.10
//       MEDIUM when 0.10 ≤ delta ≤ 0.20
//       LOW    when delta > 0.20
//
//   'ISU_EXTENSION'  (Iowa, ISU-only — current state pre-NASS wire)
//     Iowa county with ISU cached but no NASS row. Confidence capped at
//     MEDIUM. When NASS data lands later (seed wire runs with NASS tool
//     present), the same request automatically upgrades to ENSEMBLE_ISU_NASS
//     with no super-tool code changes.
//
//   'USDA_NASS'      (non-Iowa, NASS-only)
//     Non-Iowa county with NASS row but no ISU row (ISU is Iowa-only).
//     Confidence capped at MEDIUM per GAP 3 ruling.
//
// Cache-miss path (MEGAZORD GAP 2):
//   Returns `success: true` with an `InsufficientFarmlandDataPayload`
//   (discriminated-union member of FarmlandValuationResponse). Explicit
//   `insufficient_data: true` flag; reason + echoed request. Surface
//   renders a casework override affordance; NOT an error state.
//
// Tier resolution (MEGAZORD GAP 3):
//   - tier = HIGH | MEDIUM | LOW  → USER_SPECIFIED; reads single ISU row
//   - tier = null                  → BLEND_DEFAULT; reads all 3 tiers,
//                                    blends 0.35 HIGH / 0.45 MEDIUM /
//                                    0.20 LOW, records `tier_method`.
//   - non-Iowa (ISU absent)        → NASS_ONLY_NO_TIER
//
// I/O posture:
//   The super tool is a pure function over the injected `loadRow`
//   callback; no direct Firestore import. The API route (FV-006) and the
//   casework `force_refresh` path both inject the appropriate loader.
//   `force_refresh` semantics are the CALLER's responsibility — by the
//   time the super tool runs, the loader already reflects whatever
//   cache-hit-or-miss policy the caller elected.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolResult,
} from '../types'
import type {
  FarmlandValueRow,
  FarmlandValuationResponse,
  FarmlandValuationSuccess,
  InsufficientFarmlandDataPayload,
  QualityTier,
  TierMethod,
  ValueConfidence,
} from '../../types/farm-holdings'

/* ─── Tool definition ────────────────────────────────────────────────── */

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_FARMLAND_VALUATION',
  name: 'Farmland Valuation — Ensemble',
  description:
    'Ensemble valuation of a single farm parcel. Reads cache-first from farmland_values; combines ISU Extension (Iowa) + USDA NASS (national) with explicit confidence bands. Returns a discriminated FarmlandValuationResponse (success with primary/cross-check, or insufficient_data on cache-miss).',
  tools: ['isu-land-value-parse', 'nass-lookup'],
}

/* ─── Constants — ensemble weights + confidence thresholds ────────────── */

/**
 * Weights applied when `quality_tier` is null (user did not specify tier).
 * MEGAZORD GAP 3 ruling: center on MEDIUM since that's the statistical
 * mode for Iowa ag land per ISU historical data.
 */
export const TIER_BLEND_WEIGHTS: Record<QualityTier, number> = {
  HIGH: 0.35,
  MEDIUM: 0.45,
  LOW: 0.20,
}

/** Confidence-band thresholds for ensemble delta. */
export const CONFIDENCE_DELTA_THRESHOLDS = {
  HIGH_MAX: 0.10, // delta < 0.10 → HIGH
  MEDIUM_MAX: 0.20, // 0.10 ≤ delta ≤ 0.20 → MEDIUM; > 0.20 → LOW
} as const

/* ─── Input / output shapes ─────────────────────────────────────────── */

/**
 * `loadRow` is the only external-IO dependency — injected by the caller
 * (API route, wire executor, or unit test). Implementation typically
 * maps to a Firestore `collection('farmland_values').doc(id).get()` but
 * can be any cache source the caller elects.
 */
export type FarmlandRowLoader = (rowId: string) => Promise<FarmlandValueRow | null>

export interface FarmlandValuationInput {
  /** US county name (title case, e.g. "Johnson"). */
  county: string
  /** Two-letter US state code (e.g. "IA"). */
  state: string
  /**
   * Survey year to look up. Defaults to `currentYear - 1` — matches the
   * annual Jan 15 cron cadence (seeds prior-year data in mid-Nov to
   * mid-Dec of year N).
   */
  year?: number
  /**
   * User-specified tier (Iowa only; ignored for non-Iowa lookups). When
   * null, the super tool blends all three ISU tiers per GAP 3 weights.
   */
  quality_tier?: QualityTier | null
  /**
   * Callback that returns the cached FarmlandValueRow for a given
   * composite id (or `null` when not present). Injected by the caller.
   * See the IDs constants below for the composition pattern.
   */
  loadRow: FarmlandRowLoader
  /**
   * Casework bypass flag. NOT ACTIONED by the super tool itself —
   * `loadRow` is expected to reflect force-refresh semantics already
   * (the FV-006 API route handles the cache skip). Persisted in the
   * success response so downstream surfaces can render provenance.
   */
  force_refresh?: boolean
}

/* ─── Firestore id helpers ─────────────────────────────────────────── */

/**
 * Compose the canonical `farmland_values` doc id for an ISU row.
 * Spaces in county names are replaced with underscores so the id is
 * URL-safe and Firestore-friendly (matches FV-003 emitter).
 */
export function buildIsuRowId(
  state: string,
  county: string,
  year: number,
  tier: QualityTier
): string {
  return `ISU_${state}_${county.replace(/\s+/g, '_')}_${year}_${tier}`
}

/** Compose the canonical `farmland_values` doc id for a NASS row. */
export function buildNassRowId(
  state: string,
  county: string,
  year: number
): string {
  return `NASS_${state}_${county.replace(/\s+/g, '_')}_${year}`
}

/* ─── execute — main entry ───────────────────────────────────────────── */

export async function execute(
  input: FarmlandValuationInput
): Promise<SuperToolResult<FarmlandValuationResponse>> {
  const year = input.year ?? new Date().getUTCFullYear() - 1
  const { county, state, quality_tier, loadRow, force_refresh } = input

  // ── Load ISU rows (Iowa only; tier-specific or 3-tier blend) ─────────
  let isuValue: number | null = null
  let isuTier: QualityTier | null = null
  let isuTierMethod: TierMethod = 'NASS_ONLY_NO_TIER'
  let isuAsOf: string | null = null

  if (state === 'IA') {
    if (quality_tier) {
      // Single-tier lookup
      const row = await loadRow(buildIsuRowId(state, county, year, quality_tier))
      if (row) {
        isuValue = row.value_per_acre
        isuTier = row.tier
        isuTierMethod = 'USER_SPECIFIED'
        isuAsOf = row.fetched_at
      }
    } else {
      // Blend lookup — fetch all three tiers in parallel, apply weighted
      // average over whichever subset returns. If fewer than 3 rows are
      // cached for this (state, county, year), re-normalize the weights
      // over the present tiers so the blend still sums to 1.
      const results = await Promise.all(
        (Object.keys(TIER_BLEND_WEIGHTS) as QualityTier[]).map(async (tier) => {
          const row = await loadRow(buildIsuRowId(state, county, year, tier))
          return { tier, row }
        })
      )
      const present = results.filter((r) => r.row !== null) as Array<{
        tier: QualityTier
        row: FarmlandValueRow
      }>
      if (present.length > 0) {
        const weightSum = present.reduce((s, p) => s + TIER_BLEND_WEIGHTS[p.tier], 0)
        const blended =
          present.reduce(
            (s, p) => s + p.row.value_per_acre * TIER_BLEND_WEIGHTS[p.tier],
            0
          ) / (weightSum || 1)
        isuValue = Math.round(blended)
        isuTierMethod = 'BLEND_DEFAULT'
        // Prefer MEDIUM as the representative as-of, fall back to any
        // present tier's fetched_at (they should be within seconds of
        // each other since the seed wire writes them in one batch).
        const medium = present.find((p) => p.tier === 'MEDIUM')
        isuAsOf = (medium ?? present[0]).row.fetched_at
      }
    }
  }

  // ── Load NASS row (single, no tier) ────────────────────────────────
  const nassRow = await loadRow(buildNassRowId(state, county, year))
  const nassValue = nassRow ? nassRow.value_per_acre : null
  const nassAsOf = nassRow ? nassRow.fetched_at : null

  // ── Branch on availability ───────────────────────────────────────────
  // Case 1: both sources → ensemble with delta + real confidence
  if (isuValue != null && nassValue != null) {
    const delta = computeDelta(isuValue, nassValue)
    const confidence = confidenceFromDelta(delta)
    const payload: FarmlandValuationSuccess = {
      estimated_value: isuValue,
      value_per_acre: isuValue,
      primary_source: 'ISU_EXTENSION',
      cross_check_source: 'USDA_NASS',
      cross_check_value_per_acre: nassValue,
      delta,
      confidence,
      year,
      as_of: isuAsOf ?? new Date().toISOString(),
      tier_method: isuTierMethod,
      ...(force_refresh ? { force_refreshed: true } : {}),
    }
    return { success: true, data: payload }
  }

  // Case 2: ISU only (Iowa, pre-NASS seed) → MEDIUM cap
  if (isuValue != null) {
    const payload: FarmlandValuationSuccess = {
      estimated_value: isuValue,
      value_per_acre: isuValue,
      primary_source: 'ISU_EXTENSION',
      cross_check_source: null,
      cross_check_value_per_acre: null,
      delta: null,
      confidence: 'MEDIUM',
      year,
      as_of: isuAsOf ?? new Date().toISOString(),
      tier_method: isuTierMethod,
      ...(force_refresh ? { force_refreshed: true } : {}),
    }
    return { success: true, data: payload }
  }

  // Case 3: NASS only (non-Iowa, or Iowa with no ISU cache) → MEDIUM cap
  if (nassValue != null) {
    const payload: FarmlandValuationSuccess = {
      estimated_value: nassValue,
      value_per_acre: nassValue,
      primary_source: 'USDA_NASS',
      cross_check_source: null,
      cross_check_value_per_acre: null,
      delta: null,
      confidence: 'MEDIUM',
      year,
      as_of: nassAsOf ?? new Date().toISOString(),
      tier_method: 'NASS_ONLY_NO_TIER',
      ...(force_refresh ? { force_refreshed: true } : {}),
    }
    return { success: true, data: payload }
  }

  // Case 4: neither — insufficient_data (NOT an error)
  const insufficient: InsufficientFarmlandDataPayload = {
    insufficient_data: true,
    reason: resolveInsufficientReason(state, quality_tier ?? null, year),
    requested: {
      county,
      state,
      year,
      quality_tier: quality_tier ?? null,
    },
  }
  return { success: true, data: insufficient }
}

/* ─── Pure helpers (exported for tests) ───────────────────────────────── */

export function computeDelta(isu: number, nass: number): number {
  if (isu <= 0 && nass <= 0) return 0
  return Math.abs(isu - nass) / Math.max(isu, nass)
}

export function confidenceFromDelta(delta: number): ValueConfidence {
  if (delta < CONFIDENCE_DELTA_THRESHOLDS.HIGH_MAX) return 'HIGH'
  if (delta <= CONFIDENCE_DELTA_THRESHOLDS.MEDIUM_MAX) return 'MEDIUM'
  return 'LOW'
}

/**
 * Pick the most useful insufficient_data reason for the caller. Preference:
 *   - Iowa + a user-specified tier that's missing → no_iowa_tier_survey_for_county
 *   - Non-Iowa → no_nass_data_for_county_year
 *   - Iowa without any ISU row → no_cache_entry_for_county_year
 *   - year ahead of prior-year default → year_ahead_of_latest_release
 */
export function resolveInsufficientReason(
  state: string,
  tier: QualityTier | null,
  year: number
): InsufficientFarmlandDataPayload['reason'] {
  const currentYear = new Date().getUTCFullYear()
  if (year >= currentYear) return 'year_ahead_of_latest_release'
  if (state !== 'IA') return 'no_nass_data_for_county_year'
  if (tier !== null) return 'no_iowa_tier_survey_for_county'
  return 'no_cache_entry_for_county_year'
}

/* ─── Test-only exports (stable for fixture-based tests) ──────────────── */

export const __testonly = {
  TIER_BLEND_WEIGHTS,
  CONFIDENCE_DELTA_THRESHOLDS,
  buildIsuRowId,
  buildNassRowId,
  computeDelta,
  confidenceFromDelta,
  resolveInsufficientReason,
}
