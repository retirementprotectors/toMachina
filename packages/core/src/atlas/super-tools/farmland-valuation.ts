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
import { synthesizeCountyTier } from '../tools/isu-land-value-parse'

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

/**
 * Thresholds for the DISTRICT_RATIO_SYNTHESIZED upgrade path. Synthesized
 * per-county-tier values start at MEDIUM; both checks must pass to promote
 * to HIGH. Either failing leaves the value at MEDIUM. MEGAZORD Guardrail 2
 * ruling (2026-04-15).
 */
export const SYNTHESIS_CONFIDENCE_THRESHOLDS = {
  /** County baseline agreement: |ISU county_avg − NASS county_value| / max ≤ 0.10. */
  COUNTY_BASELINE_MAX: 0.10,
  /** Synthesized tier agreement vs NASS-derived tier estimate: ≤ 0.15. */
  SYNTHESIZED_TIER_MAX: 0.15,
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

/* ─── v2 ID helpers (FV-003 v2 CARD xlsx schema) ───────────────────── */

/** county-average row id: `ISU_{state}_{county}_{year}`. */
export function buildIsuCountyAvgRowId(
  state: string,
  county: string,
  year: number,
): string {
  return `ISU_${state}_${county.replace(/\s+/g, '_')}_${year}`
}

/** district tier row id: `ISU_{state}_DIST_{district}_{year}_{tier}`. */
export function buildIsuDistrictTierRowId(
  state: string,
  district: string,
  year: number,
  tier: QualityTier,
): string {
  return `ISU_${state}_DIST_${district.replace(/\s+/g, '_')}_${year}_${tier}`
}

/** district weighted-avg row id: `ISU_{state}_DIST_{district}_{year}_WAVG`. */
export function buildIsuDistrictWavgRowId(
  state: string,
  district: string,
  year: number,
): string {
  return `ISU_${state}_DIST_${district.replace(/\s+/g, '_')}_${year}_WAVG`
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
  // Synthesis-path state (populated when DISTRICT_RATIO_SYNTHESIZED fires).
  // Carried into the confidence branches so Guardrails 2 + 3 can apply.
  let countyAvgForSynth: number | null = null
  let districtWavgForSynth: number | null = null
  let districtTierForSynth: number | null = null
  let synthesisFormula: string | undefined
  let outlierFromDistrict = false

  if (state === 'IA') {
    if (quality_tier) {
      // Legacy single-tier lookup (v1 schema: per-county-tier rows).
      const row = await loadRow(buildIsuRowId(state, county, year, quality_tier))
      if (row) {
        isuValue = row.value_per_acre
        isuTier = row.tier
        isuTierMethod = 'USER_SPECIFIED'
        isuAsOf = row.fetched_at
      }
    } else {
      // Legacy 3-tier blend — same v1 schema path.
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
        const medium = present.find((p) => p.tier === 'MEDIUM')
        isuAsOf = (medium ?? present[0]).row.fetched_at
      }
    }

    // ── v2 synthesis fallback (DISTRICT_RATIO_SYNTHESIZED) ────────────
    // v2 schema (FV-003 v2 / CARD xlsx) publishes county averages + district
    // tiers — no per-county-tier rows. If the legacy lookups returned null,
    // try the county_avg + district_tier + district_wavg triple and synth.
    if (isuValue == null) {
      const countyRow = await loadRow(buildIsuCountyAvgRowId(state, county, year))
      if (countyRow) {
        countyAvgForSynth = countyRow.value_per_acre
        outlierFromDistrict = countyRow.outlier_from_district === true
        isuAsOf = countyRow.fetched_at
        if (quality_tier && countyRow.district_id) {
          // Tier-specific synthesis: county_tier = district_tier ×
          //                          (county_avg / district_weighted_avg)
          const [distTierRow, distWavgRow] = await Promise.all([
            loadRow(
              buildIsuDistrictTierRowId(state, countyRow.district_id, year, quality_tier),
            ),
            loadRow(buildIsuDistrictWavgRowId(state, countyRow.district_id, year)),
          ])
          const distWavg = distWavgRow?.value_per_acre ?? countyRow.district_weighted_avg
          if (distTierRow && distWavg) {
            districtTierForSynth = distTierRow.value_per_acre
            districtWavgForSynth = distWavg
            const synth = synthesizeCountyTier({
              county_avg: countyAvgForSynth,
              district_tier: distTierRow.value_per_acre,
              district_weighted_avg: distWavg,
            })
            isuValue = synth.value_per_acre
            isuTier = quality_tier
            isuTierMethod = 'DISTRICT_RATIO_SYNTHESIZED'
            synthesisFormula = synth.synthesis_formula
          } else {
            // Missing district-tier or district-wavg row — fall back to
            // county_avg with BLEND_DEFAULT so the caller still gets a
            // sensible number rather than insufficient_data.
            isuValue = countyAvgForSynth
            isuTierMethod = 'BLEND_DEFAULT'
          }
        } else {
          // No tier specified — county_avg IS the blended default.
          isuValue = countyAvgForSynth
          isuTierMethod = 'BLEND_DEFAULT'
        }
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
    // Default confidence from delta; then apply synthesis guardrails.
    let confidence: ValueConfidence = confidenceFromDelta(delta)
    if (isuTierMethod === 'DISTRICT_RATIO_SYNTHESIZED') {
      // Guardrail 3: outlier_from_district forces LOW regardless of delta.
      if (outlierFromDistrict) {
        confidence = 'LOW'
      } else {
        // Guardrail 2: upgrade to HIGH only on dual agreement.
        confidence = confidenceForSynthesizedTier({
          county_avg: countyAvgForSynth,
          nass_county_value: nassValue,
          district_tier: districtTierForSynth,
          district_weighted_avg: districtWavgForSynth,
          synthesized_tier: isuValue,
        })
      }
    }
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
      ...(synthesisFormula ? { synthesis_formula: synthesisFormula } : {}),
      ...(isuTierMethod === 'DISTRICT_RATIO_SYNTHESIZED'
        ? { outlier_from_district: outlierFromDistrict }
        : {}),
      ...(force_refresh ? { force_refreshed: true } : {}),
    }
    return { success: true, data: payload }
  }

  // Case 2: ISU only (Iowa, pre-NASS seed) → MEDIUM cap, LOW if outlier synth
  if (isuValue != null) {
    const confidence: ValueConfidence =
      isuTierMethod === 'DISTRICT_RATIO_SYNTHESIZED' && outlierFromDistrict
        ? 'LOW'
        : 'MEDIUM'
    const payload: FarmlandValuationSuccess = {
      estimated_value: isuValue,
      value_per_acre: isuValue,
      primary_source: 'ISU_EXTENSION',
      cross_check_source: null,
      cross_check_value_per_acre: null,
      delta: null,
      confidence,
      year,
      as_of: isuAsOf ?? new Date().toISOString(),
      tier_method: isuTierMethod,
      ...(synthesisFormula ? { synthesis_formula: synthesisFormula } : {}),
      ...(isuTierMethod === 'DISTRICT_RATIO_SYNTHESIZED'
        ? { outlier_from_district: outlierFromDistrict }
        : {}),
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
 * Confidence for a DISTRICT_RATIO_SYNTHESIZED value with NASS cross-check
 * available. Per MEGAZORD Guardrail 2 (2026-04-15):
 *   start MEDIUM, upgrade to HIGH only when BOTH
 *     |ISU county_avg − NASS county_value| / max  ≤ 0.10   (baseline)
 *     |synthesized_tier − NASS-derived tier|  / max ≤ 0.15   (tier fidelity)
 * Either failing holds at MEDIUM. Outlier-from-district is handled by the
 * caller (forces LOW regardless of this result).
 *
 * NASS-derived tier uses the same district ratio applied to the NASS
 * county value: `district_tier × (nass_county / district_weighted_avg)`.
 * Missing inputs (any of `district_tier`, `district_weighted_avg`,
 * `county_avg`) collapse to MEDIUM — we can't prove agreement without the
 * full inputs.
 */
export function confidenceForSynthesizedTier(args: {
  county_avg: number | null
  nass_county_value: number
  district_tier: number | null
  district_weighted_avg: number | null
  synthesized_tier: number
}): ValueConfidence {
  const { county_avg, nass_county_value, district_tier, district_weighted_avg, synthesized_tier } = args
  if (county_avg == null || district_tier == null || !district_weighted_avg) return 'MEDIUM'
  const baselineDelta = computeDelta(county_avg, nass_county_value)
  if (baselineDelta > SYNTHESIS_CONFIDENCE_THRESHOLDS.COUNTY_BASELINE_MAX) return 'MEDIUM'
  const nassDerivedTier = district_tier * (nass_county_value / district_weighted_avg)
  const tierDelta = computeDelta(synthesized_tier, nassDerivedTier)
  if (tierDelta > SYNTHESIS_CONFIDENCE_THRESHOLDS.SYNTHESIZED_TIER_MAX) return 'MEDIUM'
  return 'HIGH'
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
  SYNTHESIS_CONFIDENCE_THRESHOLDS,
  buildIsuRowId,
  buildNassRowId,
  buildIsuCountyAvgRowId,
  buildIsuDistrictTierRowId,
  buildIsuDistrictWavgRowId,
  computeDelta,
  confidenceFromDelta,
  confidenceForSynthesizedTier,
  resolveInsufficientReason,
}
