/**
 * Farm Holdings + Farmland Valuation — shared types.
 *
 * Sprint: SPR-FARMLAND-VALUATION-001 (RONIN, owner: MEGAZORD / ATLAS DEVOUR)
 * ZRD: ZRD-PLATFORM-FARMLAND-VALUATION-API
 *
 * Scope
 *   - `FarmHolding` — a single parcel entry on a client record's
 *     `farm_holdings` array (added to `Client` in this sprint).
 *   - `FarmlandValueRow` — one document in the new `farmland_values`
 *     top-level Firestore collection. Rows are seeded by the annual
 *     WIRE_FARMLAND_VALUE_SEED cron (ISU 99 counties × 3 tiers = 297 rows,
 *     plus NASS rows keyed by state/county/year). The super tool
 *     SUPER_FARMLAND_VALUATION reads cache-first from this collection.
 *
 * Design decisions baked in from MEGAZORD's CIO rulings
 * (implementation gaps 1-3, 2026-04-14):
 *   - Quality tier is nullable; super tool blends 0.35 HIGH / 0.45 MEDIUM /
 *     0.20 LOW when null and records the method in `tier_method`.
 *   - Cache-miss path returns an `insufficient_data` payload with 200
 *     status rather than erroring — the UI surfaces a casework-override
 *     affordance instead of a hard failure.
 *   - Each seeded row carries a `source_doc_hash` so year-over-year
 *     staleness is detectable on the next cron run (ISU PDF layout drift).
 */

/* ─── Enums ────────────────────────────────────────────────────────────── */

/**
 * ISU Extension quality tiers for Iowa farmland. USDA NASS does not emit
 * tiers and is represented with `null`. User entry can leave tier null when
 * unknown — the super tool applies a statistical blend (see `TierMethod`).
 */
export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW'

/** How the quality tier value was resolved for a given valuation. */
export type TierMethod =
  | 'USER_SPECIFIED'                  // user explicitly selected HIGH / MEDIUM / LOW
  | 'BLEND_DEFAULT'                   // super tool applied 0.35/0.45/0.20 weighted blend
  | 'NASS_ONLY_NO_TIER'               // non-Iowa county — NASS has no tier concept
  | 'DISTRICT_RATIO_SYNTHESIZED'      // synthesized at county grain via
                                      // county_tier = district_tier × (county_avg / district_weighted_avg).
                                      // Used when ISU provides a county average but tier data only at
                                      // crop-reporting-district grain (MEGAZORD ruling 2026-04-14).
                                      // Confidence caps at MEDIUM until NASS cross-check.

/** How the client holds the parcel. Shapes ownership-aware roadmap treatment. */
export type OwnershipType =
  | 'FEE_SIMPLE'
  | 'LIFE_ESTATE'
  | 'INHERITED'
  | 'LEASED'

/** Which source(s) contributed to the `estimated_value` on a `FarmHolding`. */
export type ValueSource =
  | 'ENSEMBLE_ISU_NASS'  // both sources agreed within tolerance, ensemble scored
  | 'ISU_ONLY'           // Iowa county, NASS unavailable or stale
  | 'NASS_ONLY'          // non-Iowa county, or ISU missing
  | 'MANUAL'             // casework override via `override_value`

/**
 * Agreement band between ISU + NASS. See implementation-gap ruling 3:
 *   HIGH   ← delta < 0.10
 *   MEDIUM ← 0.10 ≤ delta ≤ 0.20   (also the cap for NASS-only)
 *   LOW    ← delta > 0.20
 */
export type ValueConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

/** Registered sources for farmland valuation (ATLAS source_registry entries). */
export type FarmlandValueSource = 'ISU_EXTENSION' | 'USDA_NASS'

/* ─── farm_holdings — array field on Client ────────────────────────────── */

export interface FarmHolding {
  /** Stable ID within the array, e.g. `fh_01HZK...`. Client-generated ULID/UUID. */
  id: string

  // ─── Parcel identity ────────────────────────────────────────────────
  /** US county name (title case, e.g. "Johnson"). */
  county: string
  /** Two-letter US state code (e.g. "IA"). */
  state: string
  /** Acreage — float, one decimal recommended. */
  acres: number
  ownership_type: OwnershipType
  /** Land quality self-assessment. `null` when unknown; super tool blends. */
  quality_tier: QualityTier | null

  // ─── Computed valuation (populated by super tool) ────────────────────
  /** Dollars. Derived from value_per_acre × acres. */
  estimated_value: number
  value_source: ValueSource
  value_confidence: ValueConfidence
  /** Year the source data reflects (e.g. "2025"). */
  value_as_of: string
  /** ISO-8601 timestamp of the last super-tool run for this holding. */
  last_computed_at: string

  // ─── Casework override (manual) ──────────────────────────────────────
  /** If set, UI + roadmap use this instead of `estimated_value`. */
  override_value: number | null
  override_reason: string | null

  // ─── Free-form notes (e.g. "Inherited 2019, leased to cousin") ───────
  notes?: string
}

/* ─── farmland_values — new top-level Firestore collection ─────────────── */

/**
 * One document per surveyed/derived value. Composite IDs keep cron upserts
 * deterministic. Post-MEGAZORD-2026-04-14 ruling on ISU CARD-xlsx source:
 * ISU publishes *county-grain averages only* + *district-grain tiers*; per-
 * county tier values are *synthesized* at lookup time via ratio scaling
 * (`tier_method: DISTRICT_RATIO_SYNTHESIZED`). See FV-007 amendment PR.
 *
 * ID patterns:
 *   ISU county avg:      `ISU_{state}_{county}_{year}`
 *   ISU district tier:   `ISU_{state}_DIST_{district}_{year}_{tier}`
 *   ISU district w-avg:  `ISU_{state}_DIST_{district}_{year}_WAVG`
 *   NASS county:         `NASS_{state}_{county}_{year}`
 */
export interface FarmlandValueRow {
  /** Composite doc id, see ID pattern above. */
  id: string
  source: FarmlandValueSource
  /** Two-letter US state code. */
  state: string
  /**
   * County name for county-grain rows. For district-grain rows (ISU crop
   * reporting district tier / weighted-avg), this is the district name
   * (e.g. "Northwest") and `district_id` carries the same value for clarity.
   */
  county: string
  year: number
  /**
   * Tier for tier-bearing rows (ISU district tier rows). `null` for
   * county-average rows (ISU county) and NASS county rows (no tier).
   */
  tier: QualityTier | null
  /** Dollars per acre. Integer or float acceptable. */
  value_per_acre: number
  /** ISO 4217 — always "USD" for v1; typed wide for future-proofing. */
  currency: 'USD'
  /** Short description of the methodology (survey panel, series code, etc). */
  methodology_notes: string
  /** ISO-8601 timestamp of the most recent cron fetch. */
  fetched_at: string
  /** URL the row was sourced from (PDF or API). */
  source_url: string
  /**
   * SHA-256 of the source document body at fetch time. Used by the next
   * cron run to detect whether the upstream source actually changed —
   * avoids falsely refreshing `fetched_at` when the underlying data hasn't
   * moved. Format: `sha256:<hex>`.
   */
  source_doc_hash: string

  // ─── FV-003 v2 / CARD-xlsx amendment fields ─────────────────────────
  /**
   * Grain of the row. New rows always populate this. Omitted on legacy rows
   * from the pre-v2 PDF parser — consumers should treat `undefined` as
   * `county_tier` for back-compat.
   */
  grain?: 'county_avg' | 'district_tier' | 'district_weighted_avg' | 'county_tier_legacy'
  /**
   * ISU crop-reporting-district identifier (one of the 9 Iowa districts, e.g.
   * "Northwest", "Central"). Present on district-grain rows and on county-
   * grain rows that carry district context for synthesis.
   */
  district_id?: string
  /**
   * Weighted average $/ac for the district, for any year. Stored on district
   * weighted-avg rows; also mirrored onto county_avg rows so synthesis at
   * lookup time doesn't need a second load.
   */
  district_weighted_avg?: number
  /**
   * County average $/ac mirrored here on district-grain rows that want to
   * expose the county→district ratio without a second load.
   */
  county_avg?: number
  /**
   * Human-readable math describing how the value was derived (for synthesized
   * per-county-tier rows emitted at valuation time — NOT written to
   * farmland_values directly). Super tool attaches this to response payloads;
   * FarmlandValueRow carries it when a row represents a materialized
   * synthesis. Example: "synth: 13507 × (12174 / 14522) = 11328".
   */
  synthesis_formula?: string
  /**
   * Set `true` when `county_avg` deviates > 25% from `district_weighted_avg`.
   * Synthesized per-county-tier values for this county are forced to LOW
   * confidence regardless of NASS cross-check (MEGAZORD guardrail 3).
   */
  outlier_from_district?: boolean
}

/* ─── API-type helpers (valuation endpoint + super tool) ──────────────── */

/**
 * Response payload when the cache has no row for the requested county/year.
 * Super tool + `POST /api/valuation/farmland` surface this as a successful
 * 200 with explicit `insufficient_data: true` — the UI renders a casework
 * override affordance instead of an error banner.
 */
export interface InsufficientFarmlandDataPayload {
  insufficient_data: true
  reason:
    | 'no_cache_entry_for_county_year'
    | 'no_iowa_tier_survey_for_county'
    | 'no_nass_data_for_county_year'
    | 'year_ahead_of_latest_release'
  requested: {
    county: string
    state: string
    year: number
    quality_tier: QualityTier | null
  }
  /**
   * Optional nudges toward closest-available data (e.g. prior year for the
   * same county, or a neighboring county if the requested one is unseeded).
   */
  suggestions?: Array<{
    county: string
    state: string
    year: number
    value_per_acre: number
    note: string
  }>
}

/** Full success payload for `POST /api/valuation/farmland`. */
export interface FarmlandValuationSuccess {
  estimated_value: number
  value_per_acre: number
  primary_source: FarmlandValueSource
  cross_check_source: FarmlandValueSource | null
  cross_check_value_per_acre: number | null
  /**
   * Absolute relative delta between primary + cross-check when both present.
   * `null` for NASS-only or ISU-only responses. Range: 0 to 1.
   */
  delta: number | null
  confidence: ValueConfidence
  year: number
  /** Release date of the source data (e.g. "2025-11-15" for ISU 2025 survey). */
  as_of: string
  /** How the quality tier was resolved. */
  tier_method: TierMethod
  /**
   * When `true`, caller explicitly passed `force_refresh: true` and the
   * backing super tool hit live sources instead of cache. Non-casework
   * paths should leave this undefined.
   */
  force_refreshed?: boolean
}

/**
 * Discriminated union for the POST /api/valuation/farmland response body.
 * Callers narrow with `if ('insufficient_data' in data)`.
 */
export type FarmlandValuationResponse =
  | FarmlandValuationSuccess
  | InsufficientFarmlandDataPayload
