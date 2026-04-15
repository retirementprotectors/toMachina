// ---------------------------------------------------------------------------
// Atomic Tool: nass-lookup
//
// Queries USDA NASS Quick Stats API for county-year farmland values.
// Used by SUPER_FARMLAND_VALUATION (ensemble cross-check vs ISU) and
// WIRE_FARMLAND_VALUE_SEED (annual Iowa county seed).
//
// Sprint: SPR-FARMLAND-VALUATION-001 (FV-002)
// ZRD: ZRD-PLATFORM-FARMLAND-VALUATION-API
//
// Key management (MEGAZORD 2026-04-15 ruling):
//   NASS_QUICK_STATS_KEY lives in Google Secret Manager (project
//   claude-mcp-484718). Mounted into tm-api at Cloud Run deploy time via
//   `gcloud run deploy --set-secrets NASS_QUICK_STATS_KEY=...`, then
//   consumed here as `process.env.NASS_QUICK_STATS_KEY`. Tool throws
//   without a key — no silent-skip fallback (would mask cron failures).
//
// API contract:
//   Endpoint:    https://quickstats.nass.usda.gov/api/api_GET/
//   Auth:        query param `key=${NASS_QUICK_STATS_KEY}`
//   Courtesy:    1 req/sec throttle (shared throttle state; wire seeder
//                loops 99 counties sequentially = ~99 sec for full Iowa).
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition, AtomicToolResult } from '../types'

/* ─── Tool definition ────────────────────────────────────────────────── */

export const definition: AtomicToolDefinition = {
  tool_id: 'nass-lookup',
  name: 'USDA NASS Quick Stats Lookup',
  description:
    'Queries USDA NASS Quick Stats API for county-year farmland values (AG_LAND / CROPLAND / PASTURELAND categories). Requires NASS_QUICK_STATS_KEY env var (from GSM). 1 req/sec courtesy throttle.',
  used_by: ['SUPER_FARMLAND_VALUATION', 'WIRE_FARMLAND_VALUE_SEED'],
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const NASS_API_URL = 'https://quickstats.nass.usda.gov/api/api_GET/'
const THROTTLE_MS = 1000

export type NassCategory = 'AG_LAND' | 'CROPLAND' | 'PASTURELAND'

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface NassLookupInput {
  /** Two-letter US state code (e.g. "IA"). */
  state: string
  /** County name (title case, e.g. "Johnson"). NASS uses upper-case internally. */
  county: string
  /** Survey year (e.g. 2025). NASS publishes annual state-level + 5-year Census county-level. */
  year: number
  /** Which NASS category to query. Defaults to `AG_LAND` (farmland real-estate values). */
  category?: NassCategory
  /**
   * Override the default fetcher. Primary use: unit tests inject a mock
   * to avoid real HTTP + bypass the 1 sec throttle.
   */
  fetcher?: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
}

export interface NassLookupOutput {
  state: string
  county: string
  year: number
  category: NassCategory
  /** Dollars per acre. Integer. Rounded from NASS Value string. */
  value_per_acre: number
  source_url: string
  /** ISO-8601 timestamp when the lookup succeeded. */
  fetched_at: string
  /** Raw NASS `short_desc` field for provenance. */
  short_desc: string
}

/* ─── Throttle state ─────────────────────────────────────────────────── */

let lastFetchAt = 0

async function throttle(): Promise<void> {
  const delta = Date.now() - lastFetchAt
  if (delta < THROTTLE_MS) {
    await new Promise((r) => setTimeout(r, THROTTLE_MS - delta))
  }
  lastFetchAt = Date.now()
}

/* ─── execute ────────────────────────────────────────────────────────── */

/**
 * Main entry point. Failure modes:
 *   - { success: false, error } when NASS_QUICK_STATS_KEY unset
 *   - { success: false, error } when NASS API returns non-2xx or empty
 *   - { success: true, data } normal
 * Callers (wire seeder) are expected to loop per-county + tolerate
 * per-county failures (add to missing_counties[] instead of aborting).
 */
export async function execute(
  input: NassLookupInput,
): Promise<AtomicToolResult<NassLookupOutput>> {
  const key = process.env.NASS_QUICK_STATS_KEY
  if (!key) {
    return {
      success: false,
      error:
        'NASS_QUICK_STATS_KEY is not configured. Deploy tm-api with `--set-secrets NASS_QUICK_STATS_KEY=NASS_QUICK_STATS_KEY:latest` or set the env var locally.',
    }
  }

  const category = input.category ?? 'AG_LAND'
  const shortDesc = buildShortDesc(category)
  const params = new URLSearchParams({
    key,
    source_desc: 'CENSUS',
    sector_desc: 'ECONOMICS',
    group_desc: 'FARMS & LAND & ASSETS',
    short_desc: shortDesc,
    state_alpha: input.state.toUpperCase(),
    county_name: input.county.toUpperCase(),
    year: String(input.year),
    format: 'JSON',
  })
  const url = `${NASS_API_URL}?${params.toString()}`

  if (!input.fetcher) await throttle()
  const fetcher = input.fetcher ?? defaultFetcher

  let respJson: unknown
  try {
    const resp = await fetcher(url)
    if (!resp.ok) {
      return {
        success: false,
        error: `NASS API returned HTTP ${resp.status} for ${input.county} ${input.state} ${input.year}`,
      }
    }
    respJson = await resp.json()
  } catch (err) {
    return {
      success: false,
      error: `NASS fetch threw: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const parsed = parseNassResponse(respJson, category)
  if (!parsed) {
    return {
      success: false,
      error: `NASS returned no usable rows for ${input.county} ${input.state} ${input.year} (category ${category})`,
    }
  }

  // Strip the API key from the source_url we persist — don't leak secrets
  // into Firestore or UI surfaces.
  const cleanUrl = url.replace(/([?&])key=[^&]*/, '$1key=REDACTED')

  return {
    success: true,
    data: {
      state: input.state.toUpperCase(),
      county: input.county,
      year: input.year,
      category,
      value_per_acre: parsed.valuePerAcre,
      source_url: cleanUrl,
      fetched_at: new Date().toISOString(),
      short_desc: parsed.shortDesc,
    },
  }
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Build the NASS `short_desc` filter for a given category. The real NASS
 * API is picky about exact whitespace + punctuation — these strings come
 * from the NASS "Quick Stats" web UI (Data source → Economics → Farms &
 * Land & Assets → select measure).
 */
export function buildShortDesc(category: NassCategory): string {
  switch (category) {
    case 'AG_LAND':
      return 'AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE'
    case 'CROPLAND':
      return 'AG LAND, CROPLAND - ASSET VALUE, MEASURED IN $ / ACRE'
    case 'PASTURELAND':
      return 'AG LAND, PASTURELAND - ASSET VALUE, MEASURED IN $ / ACRE'
  }
}

interface NassParseResult {
  valuePerAcre: number
  shortDesc: string
}

/**
 * Extract the first usable numeric value from a NASS response. NASS
 * returns a top-level `data: [{...}]` array; values are string-typed
 * dollar figures with commas ("2,450"). Empty / suppressed values
 * appear as "(D)" (withheld) or "(Z)" (less than half of unit) — both
 * treated as missing.
 */
export function parseNassResponse(
  respJson: unknown,
  category: NassCategory,
): NassParseResult | null {
  const data = (respJson as { data?: Array<Record<string, unknown>> })?.data
  if (!Array.isArray(data) || data.length === 0) return null
  for (const row of data) {
    const raw = String(row.Value ?? row.value ?? '').trim()
    if (!raw || raw === '(D)' || raw === '(Z)' || raw === '(NA)') continue
    const num = parseFloat(raw.replace(/[,$\s]/g, ''))
    if (Number.isFinite(num) && num > 0) {
      return {
        valuePerAcre: Math.round(num),
        shortDesc: String(row.short_desc ?? buildShortDesc(category)),
      }
    }
  }
  return null
}

async function defaultFetcher(
  url: string,
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'toMachina/RONIN (FV-002 NASS lookup)',
    },
  })
  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json(),
  }
}

/* ─── __testonly ─────────────────────────────────────────────────────── */

export const __testonly = {
  NASS_API_URL,
  THROTTLE_MS,
  buildShortDesc,
  parseNassResponse,
  resetThrottleForTests: () => {
    lastFetchAt = 0
  },
}
