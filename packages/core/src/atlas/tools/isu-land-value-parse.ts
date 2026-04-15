// ---------------------------------------------------------------------------
// Atomic Tool: isu-land-value-parse  (v2 — CARD xlsx source)
//
// Fetches the annual ISU Farmland Value workbook from the CARD Farmland
// portal + parses it into structured FarmlandValueRow entries covering:
//   - 99 county average rows      (county grain, tier = null)
//   -  9 district weighted-avg rows (district grain, tier = null)
//   - 27 district tier rows         (district grain, 9 districts × 3 tiers)
// = 135 rows per year minimum (MEGAZORD Gate A floor, 2026-04-15).
//
// Sprint: SPR-FARMLAND-VALUATION-001 (FV-003 v2)
// ZRD: ZRD-PLATFORM-FARMLAND-VALUATION-API
//
// ─── Why v2 ────────────────────────────────────────────────────────────
// v1 (PDF + regex, PR #478) targeted
//   https://www.extension.iastate.edu/agdm/wholefarm/pdf/c2-70.pdf
// which publishes county-level data as an *image-based map*; pdf-parse yields
// zero extractable county names. The CARD portal (farmland.card.iastate.edu)
// publishes the same survey as an xlsx workbook — ISU's intended machine-
// readable source. v2 swaps the source + parser body, keeps the 3-tier
// fetch + drift-warning posture + 99-county guards.
//
// ─── ISU data grain ────────────────────────────────────────────────────
// The ISU survey publishes:
//   - HIGH/MEDIUM/LOW tiers        at state + district grain only
//   - a single AVERAGE per county  (from ISU survey + US Census of Ag fusion)
// Per-county-tier values are *synthesized* at valuation time via ratio
// scaling (MEGAZORD-locked 2026-04-15 ruling):
//   county_tier = district_tier × (county_avg / district_weighted_avg)
// with three guardrails enforced by SUPER_FARMLAND_VALUATION (FV-004):
//   1. tier_method records DISTRICT_RATIO_SYNTHESIZED
//   2. confidence caps at MEDIUM until NASS cross-check validates
//   3. outlier_from_district set true when county_avg deviates > 25%
// See FV-007 amendment PR for the supporting FarmlandValueRow fields.
//
// ─── 3-tier fetch (MEGAZORD GAP 1 pattern, preserved from v1) ──────────
//   1. Pattern URL — canonical xlsx filename with current year range.
//      Format: /files/inline-files/Iowa_Farmland_Values_ISU_{start}_{end}.xlsx
//      where {end} = requested survey year. We probe a window of {end-1,
//      end, end+1} to handle mid-year releases.
//   2. Index scrape — /downloads page, look for <a href> matching
//      /Iowa_Farmland_Values_ISU.*\.xlsx$/i; pick the one with the highest
//      trailing year.
//   3. Fail-loud — return { success: false } with the fetched index-page
//      body attached so the cron wire can post it to #megazord for same-
//      session fixer intervention. No silent fallback to prior-year.
//
// ─── Dependency ────────────────────────────────────────────────────────
// `xlsx@^0.18.5` is a direct runtime dep of @tomachina/core (MEGAZORD ruling
// 2026-04-15 — "pin it, don't rely on transitive"). This is the single
// exception to the runtime-dep-free posture on the atlas tools layer and is
// considered a scoped compromise for the seed-wire execution path.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import type { AtomicToolDefinition, AtomicToolResult } from '../types'
import type {
  FarmlandValueRow,
  QualityTier,
} from '../../types/farm-holdings'

/* ─── Tool definition ────────────────────────────────────────────────── */

export const definition: AtomicToolDefinition = {
  tool_id: 'isu-land-value-parse',
  name: 'ISU Extension Land Value Parse (CARD xlsx)',
  description:
    'Fetch + parse the annual ISU Farmland Value Survey xlsx from the CARD Farmland portal into 99 county-avg + 9 district weighted-avg + 27 district tier rows (135 per year). MEGAZORD v2 ruling 2026-04-15: xlsx replaces PDF source. Implements 3-tier fetch: pattern URL → /downloads scrape → fail-loud with index-page body.',
  used_by: ['SUPER_FARMLAND_VALUATION', 'WIRE_FARMLAND_VALUE_SEED'],
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const CARD_ORIGIN = 'https://farmland.card.iastate.edu'
const CARD_DOWNLOADS_URL = `${CARD_ORIGIN}/downloads`
const CARD_XLSX_DIR = `${CARD_ORIGIN}/files/inline-files`

/** ISU canonical filename prefix for the annual-values workbook. */
const ISU_XLSX_PREFIX = 'Iowa_Farmland_Values_ISU_'
/** ISU survey started in 1941 — earliest year in the xlsx series. */
const ISU_SERIES_START = 1941

/** Canonical ordering used by the workbook + the super tool. */
const TIER_ORDER: QualityTier[] = ['HIGH', 'MEDIUM', 'LOW']

/** Threshold above which a county-vs-district ratio is marked outlier. */
const OUTLIER_RELATIVE_DEVIATION = 0.25

/**
 * 99 Iowa counties — alphabetical. Used as an anchoring guard: the parser
 * verifies the workbook header row contains all 99 expected names before
 * emitting any rows. Missing counties become drift warnings.
 */
const IOWA_COUNTIES: readonly string[] = [
  'Adair','Adams','Allamakee','Appanoose','Audubon','Benton','Black Hawk','Boone','Bremer','Buchanan',
  'Buena Vista','Butler','Calhoun','Carroll','Cass','Cedar','Cerro Gordo','Cherokee','Chickasaw','Clarke',
  'Clay','Clayton','Clinton','Crawford','Dallas','Davis','Decatur','Delaware','Des Moines','Dickinson',
  'Dubuque','Emmet','Fayette','Floyd','Franklin','Fremont','Greene','Grundy','Guthrie','Hamilton',
  'Hancock','Hardin','Harrison','Henry','Howard','Humboldt','Ida','Iowa','Jackson','Jasper',
  'Jefferson','Johnson','Jones','Keokuk','Kossuth','Lee','Linn','Louisa','Lucas','Lyon',
  'Madison','Mahaska','Marion','Marshall','Mills','Mitchell','Monona','Monroe','Montgomery','Muscatine',
  "O'Brien",'Osceola','Page','Palo Alto','Plymouth','Pocahontas','Polk','Pottawattamie','Poweshiek','Ringgold',
  'Sac','Scott','Shelby','Sioux','Story','Tama','Taylor','Union','Van Buren','Wapello',
  'Warren','Washington','Wayne','Webster','Winnebago','Winneshiek','Woodbury','Worth','Wright',
]

/** 9 ISU crop reporting districts — order preserved in workbook header. */
const IOWA_DISTRICTS: readonly string[] = [
  'Northwest','North Central','Northeast','West Central','Central',
  'East Central','Southwest','South Central','Southeast',
]

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface IsuParseInput {
  /**
   * The survey year to fetch. Defaults to `currentYear - 1` — matches the
   * annual Jan 15 cron cadence (ISU releases in mid-Nov to mid-Dec, so
   * prior-year data is latest-stable when the cron fires).
   */
  year?: number

  /**
   * Pre-fetched xlsx bytes. When provided, skips the 3-tier HTTP fetch.
   * Primary use: unit tests + manual retries.
   */
  xlsxBytes?: ArrayBuffer

  /** Override the default user-agent on the HTTP fetches. */
  userAgent?: string

  // ─── v1 compat (deprecated, ignored) ──────────────────────────────
  // Accepted to keep existing call sites (FV-005b /seed handler) compiling
  // during the v1→v2 transition. xlsx is parsed directly by @tomachina/core
  // now; no caller-injected extractor is needed. These will be removed in
  // a follow-up cleanup PR once all call sites drop them.
  /** @deprecated v1 PDF path — unused since FV-003 v2 (CARD xlsx). */
  pdfBytes?: ArrayBuffer
  /** @deprecated v1 PDF path — unused since FV-003 v2 (CARD xlsx). */
  textExtractor?: unknown
  /** @deprecated v1 PDF path — unused since FV-003 v2 (CARD xlsx). */
  preExtractedText?: string
}

export interface IsuParseOutput {
  year: number
  source_url: string
  source_doc_hash: string
  rows: FarmlandValueRow[]
  counties_parsed: number
  districts_parsed: number
  rows_parsed: number
  /** Non-fatal warnings (missing counties/districts, outliers, parse drift). */
  warnings: string[]
}

export interface IsuFetchFailureDetail {
  attempted_urls: string[]
  index_page_body?: string
  index_page_http_status?: number
  index_page_content_type?: string
}

/* ─── execute ────────────────────────────────────────────────────────── */

/**
 * Main entry point. Fetches (unless bytes provided) and parses an ISU annual
 * xlsx into 135 expected rows (99 county-avg + 9 district weighted-avg + 27
 * district tier). Failure modes:
 *   - { success: false, error, detail }  when three-tier fetch exhausts
 *   - { success: false, error }           when parsing yields 0 rows
 *   - { success: true, data }             normal, warnings surfaced inside data
 */
export async function execute(
  input: IsuParseInput
): Promise<AtomicToolResult<IsuParseOutput> & { detail?: IsuFetchFailureDetail }> {
  const year = input.year ?? new Date().getUTCFullYear() - 1

  let bytes: ArrayBuffer
  let sourceUrl: string

  if (input.xlsxBytes) {
    bytes = input.xlsxBytes
    sourceUrl = `xlsxBytes:${year}`
  } else {
    const fetched = await fetchIsuXlsx(year, input.userAgent)
    if (!fetched.success) {
      return { success: false, error: fetched.error, detail: fetched.detail }
    }
    bytes = fetched.bytes
    sourceUrl = fetched.sourceUrl
  }

  const sourceDocHash = `sha256:${sha256Bytes(bytes)}`

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(bytes, { type: 'array' })
  } catch (err) {
    return {
      success: false,
      error: `xlsx.read threw: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const parsed = parseIsuWorkbook(workbook, year, sourceUrl, sourceDocHash)
  if (parsed.rows.length === 0) {
    return {
      success: false,
      error: `ISU xlsx parser returned 0 rows for year ${year}. Warnings: ${parsed.warnings.join(' | ')}`,
    }
  }

  return {
    success: true,
    data: {
      year,
      source_url: sourceUrl,
      source_doc_hash: sourceDocHash,
      rows: parsed.rows,
      counties_parsed: parsed.countiesParsed,
      districts_parsed: parsed.districtsParsed,
      rows_parsed: parsed.rows.length,
      warnings: parsed.warnings,
    },
  }
}

/* ─── fetchIsuXlsx — 3-tier strategy ──────────────────────────────────── */

/**
 * MEGAZORD GAP 1 pattern preserved. Pattern URL → /downloads scrape → fail-
 * loud with index body. No silent fallback to prior-year.
 */
export async function fetchIsuXlsx(
  year: number,
  userAgent: string = 'toMachina/RONIN (FV-003 v2 ISU parser)',
): Promise<
  | { success: true; bytes: ArrayBuffer; sourceUrl: string }
  | { success: false; error: string; detail: IsuFetchFailureDetail }
> {
  const attemptedUrls: string[] = []

  // ── Tier 1: known patterns (window around requested year) ────────────
  for (const candidateYear of [year, year + 1, year - 1]) {
    const patternUrl = `${CARD_XLSX_DIR}/${ISU_XLSX_PREFIX}${ISU_SERIES_START}_${candidateYear}.xlsx`
    attemptedUrls.push(patternUrl)
    const resp = await safeFetch(patternUrl, userAgent)
    if (resp.ok && looksLikeXlsx(resp.contentType, resp.bytes)) {
      return { success: true, bytes: resp.bytes!, sourceUrl: patternUrl }
    }
  }

  // ── Tier 2: scrape /downloads for the latest ISU xlsx link ───────────
  attemptedUrls.push(CARD_DOWNLOADS_URL)
  const indexResp = await safeFetch(CARD_DOWNLOADS_URL, userAgent)
  if (!indexResp.ok || !indexResp.contentType?.includes('html')) {
    return {
      success: false,
      error: `CARD /downloads page unreachable (status ${indexResp.status}). Pattern URLs also failed.`,
      detail: {
        attempted_urls: attemptedUrls,
        index_page_http_status: indexResp.status,
        index_page_content_type: indexResp.contentType,
      },
    }
  }
  const indexBody = indexResp.bytes ? new TextDecoder().decode(indexResp.bytes) : ''
  const linkRegex = /href\s*=\s*["']([^"']*Iowa_Farmland_Values_ISU_\d{4}_(\d{4})\.xlsx)["']/gi
  const candidates: Array<{ url: string; year: number }> = []
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(indexBody)) !== null) {
    const href = match[1]
    const yearFromFilename = parseInt(match[2], 10)
    const absoluteUrl = href.startsWith('http') ? href : resolveCardUrl(href)
    candidates.push({ url: absoluteUrl, year: yearFromFilename })
  }

  if (candidates.length === 0) {
    return {
      success: false,
      error: 'CARD /downloads page contained no ISU xlsx links. Parser cannot self-heal without a human update.',
      detail: {
        attempted_urls: attemptedUrls,
        index_page_body: indexBody,
        index_page_http_status: indexResp.status,
        index_page_content_type: indexResp.contentType,
      },
    }
  }

  candidates.sort((a, b) => b.year - a.year)
  const picked = candidates[0]
  attemptedUrls.push(picked.url)
  const pickedResp = await safeFetch(picked.url, userAgent)
  if (!pickedResp.ok || !looksLikeXlsx(pickedResp.contentType, pickedResp.bytes)) {
    return {
      success: false,
      error: `Index-scraped xlsx URL ${picked.url} unreachable (status ${pickedResp.status}).`,
      detail: {
        attempted_urls: attemptedUrls,
        index_page_body: indexBody,
        index_page_http_status: indexResp.status,
        index_page_content_type: indexResp.contentType,
      },
    }
  }
  return { success: true, bytes: pickedResp.bytes!, sourceUrl: picked.url }
}

/* ─── parseIsuWorkbook ────────────────────────────────────────────────── */

/**
 * Extract county-avg + district tier + district weighted-avg rows from the
 * ISU workbook for a specific year. Returns ordered rows suitable for batched
 * Firestore upsert. Warnings emit drift signals — missing counties/districts
 * imply upstream schema change since last cron run.
 */
export function parseIsuWorkbook(
  workbook: XLSX.WorkBook,
  year: number,
  sourceUrl: string,
  sourceDocHash: string,
): {
  rows: FarmlandValueRow[]
  warnings: string[]
  countiesParsed: number
  districtsParsed: number
} {
  const warnings: string[] = []
  const rows: FarmlandValueRow[] = []
  const fetchedAt = new Date().toISOString()

  // ── County sheet ───────────────────────────────────────────────────
  const countySheet = workbook.Sheets['County']
  if (!countySheet) {
    warnings.push('Workbook missing "County" sheet — upstream schema drift.')
  }
  const countyResult = countySheet
    ? extractCountyAverages(countySheet, year, sourceUrl, sourceDocHash, fetchedAt)
    : { rows: [] as FarmlandValueRow[], warnings: [] as string[], countiesParsed: 0, districtByCounty: new Map<string, string>() }
  warnings.push(...countyResult.warnings)

  // ── District sheet (tiers + weighted avg) ───────────────────────────
  const distSheet = workbook.Sheets['District']
  if (!distSheet) {
    warnings.push('Workbook missing "District" sheet — upstream schema drift.')
  }
  const distResult = distSheet
    ? extractDistrictRows(distSheet, year, sourceUrl, sourceDocHash, fetchedAt)
    : { rows: [] as FarmlandValueRow[], warnings: [] as string[], districtsParsed: 0, districtWAvgByName: new Map<string, number>() }
  warnings.push(...distResult.warnings)

  // ── Outlier flag: decorate county_avg rows with district context ────
  // County→district mapping isn't in the xlsx directly; we pull it from the
  // 9-district definition + a small built-in county→district lookup. The
  // lookup lives in IOWA_COUNTY_DISTRICTS (below). Rows are mutated in
  // place with district_id, district_weighted_avg, outlier_from_district.
  for (const row of countyResult.rows) {
    const district = IOWA_COUNTY_DISTRICTS[row.county]
    if (!district) {
      warnings.push(`County "${row.county}" not in district map — outlier flag skipped.`)
      continue
    }
    const dwa = distResult.districtWAvgByName.get(district)
    if (dwa == null) continue
    row.district_id = district
    row.district_weighted_avg = dwa
    const deviation = Math.abs(row.value_per_acre - dwa) / dwa
    if (deviation > OUTLIER_RELATIVE_DEVIATION) {
      row.outlier_from_district = true
      warnings.push(`Outlier: ${row.county} ($${Math.round(row.value_per_acre)}/ac) deviates ${(deviation * 100).toFixed(1)}% from ${district} wavg ($${Math.round(dwa)}/ac).`)
    }
  }

  rows.push(...countyResult.rows, ...distResult.rows)
  return {
    rows,
    warnings,
    countiesParsed: countyResult.countiesParsed,
    districtsParsed: distResult.districtsParsed,
  }
}

/* ─── extractCountyAverages ───────────────────────────────────────────── */

function extractCountyAverages(
  sheet: XLSX.WorkSheet,
  year: number,
  sourceUrl: string,
  sourceDocHash: string,
  fetchedAt: string,
): {
  rows: FarmlandValueRow[]
  warnings: string[]
  countiesParsed: number
  districtByCounty: Map<string, string>
} {
  const rows: FarmlandValueRow[] = []
  const warnings: string[] = []
  const districtByCounty = new Map<string, string>()

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true })
  const headerIdx = aoa.findIndex(
    (r) => Array.isArray(r) && r[0] === 'Year' && r.some((c) => typeof c === 'string' && /Polk/i.test(c)),
  )
  if (headerIdx < 0) {
    warnings.push('County sheet header row not found (expected "Year | Adair | ... | Polk | ...").')
    return { rows, warnings, countiesParsed: 0, districtByCounty }
  }
  const header = (aoa[headerIdx] as unknown[]).map((c) =>
    typeof c === 'string' ? c.replace(/\r?\n/g, ' ').trim() : String(c ?? '').trim(),
  )

  // Guard: 99 counties expected
  const presentCounties = new Set(header.slice(1))
  const missing = IOWA_COUNTIES.filter((c) => !presentCounties.has(c))
  if (missing.length > 0) {
    warnings.push(`County sheet missing ${missing.length} expected counties: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}.`)
  }

  const yearRow = aoa
    .slice(headerIdx + 1)
    .find((r) => Array.isArray(r) && r[0] === year) as unknown[] | undefined
  if (!yearRow) {
    warnings.push(`County sheet has no row for year ${year} — release may lag requested year.`)
    return { rows, warnings, countiesParsed: 0, districtByCounty }
  }

  for (let i = 1; i < header.length; i++) {
    const county = header[i]
    const val = yearRow[i]
    if (!county || typeof val !== 'number' || !Number.isFinite(val)) continue
    rows.push({
      id: `ISU_IA_${safeSegment(county)}_${year}`,
      source: 'ISU_EXTENSION',
      state: 'IA',
      county,
      year,
      tier: null,
      value_per_acre: Math.round(val),
      currency: 'USD',
      methodology_notes:
        'ISU Extension + US Census of Agriculture fusion, county-average nominal $/ac. Per-county tier values not surveyed — synthesize via DISTRICT_RATIO_SYNTHESIZED at lookup time.',
      fetched_at: fetchedAt,
      source_url: sourceUrl,
      source_doc_hash: sourceDocHash,
      grain: 'county_avg',
      county_avg: Math.round(val),
    })
  }
  return { rows, warnings, countiesParsed: rows.length, districtByCounty }
}

/* ─── extractDistrictRows ─────────────────────────────────────────────── */

function extractDistrictRows(
  sheet: XLSX.WorkSheet,
  year: number,
  sourceUrl: string,
  sourceDocHash: string,
  fetchedAt: string,
): {
  rows: FarmlandValueRow[]
  warnings: string[]
  districtsParsed: number
  districtWAvgByName: Map<string, number>
} {
  const rows: FarmlandValueRow[] = []
  const warnings: string[] = []
  const districtWAvgByName = new Map<string, number>()

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true })
  // Row index 10 carries district names in 5-column blocks (per spike dump):
  // [Northwest,null,null,null,null, North Central,null,null,null,null, ...]
  // Row 12 is the [Year|High|Medium|Low|For All Grades] header repeated.
  // Data rows start at 13 with Year in col 0 of each block.
  const nameRow = aoa.find((r) => Array.isArray(r) && r[0] === 'Northwest' && typeof r[5] === 'string')
  if (!Array.isArray(nameRow)) {
    warnings.push('District sheet: name row (Northwest anchor) not found.')
    return { rows, warnings, districtsParsed: 0, districtWAvgByName }
  }

  const districtBlocks: Array<{ name: string; startCol: number }> = []
  for (let c = 0; c < nameRow.length; c += 5) {
    const cell = nameRow[c]
    if (typeof cell === 'string' && cell.trim()) {
      districtBlocks.push({ name: cell.trim(), startCol: c })
    }
  }
  const missingDistricts = IOWA_DISTRICTS.filter((d) => !districtBlocks.some((b) => b.name === d))
  if (missingDistricts.length > 0) {
    warnings.push(`District sheet missing: ${missingDistricts.join(', ')}.`)
  }

  const yearRow = aoa.find((r) => Array.isArray(r) && r[0] === year) as unknown[] | undefined
  if (!yearRow) {
    warnings.push(`District sheet has no row for year ${year}.`)
    return { rows, warnings, districtsParsed: 0, districtWAvgByName }
  }

  for (const block of districtBlocks) {
    const high = yearRow[block.startCol + 1]
    const med = yearRow[block.startCol + 2]
    const low = yearRow[block.startCol + 3]
    const wavg = yearRow[block.startCol + 4]
    if (typeof wavg !== 'number' || !Number.isFinite(wavg)) {
      warnings.push(`District ${block.name}: weighted avg missing for ${year}.`)
      continue
    }
    const wavgRounded = Math.round(wavg)
    districtWAvgByName.set(block.name, wavgRounded)
    const seg = safeSegment(block.name)

    // Weighted-avg row
    rows.push({
      id: `ISU_IA_DIST_${seg}_${year}_WAVG`,
      source: 'ISU_EXTENSION',
      state: 'IA',
      county: block.name,
      year,
      tier: null,
      value_per_acre: wavgRounded,
      currency: 'USD',
      methodology_notes: `ISU Extension district weighted-average nominal $/ac (${block.name} crop reporting district).`,
      fetched_at: fetchedAt,
      source_url: sourceUrl,
      source_doc_hash: sourceDocHash,
      grain: 'district_weighted_avg',
      district_id: block.name,
      district_weighted_avg: wavgRounded,
    })

    // Tier rows
    const tierVals = [high, med, low]
    TIER_ORDER.forEach((tier, ti) => {
      const v = tierVals[ti]
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        warnings.push(`District ${block.name}: ${tier} tier missing for ${year}.`)
        return
      }
      rows.push({
        id: `ISU_IA_DIST_${seg}_${year}_${tier}`,
        source: 'ISU_EXTENSION',
        state: 'IA',
        county: block.name,
        year,
        tier,
        value_per_acre: Math.round(v),
        currency: 'USD',
        methodology_notes: `ISU Extension district tier nominal $/ac (${block.name} crop reporting district, ${tier} quality).`,
        fetched_at: fetchedAt,
        source_url: sourceUrl,
        source_doc_hash: sourceDocHash,
        grain: 'district_tier',
        district_id: block.name,
        district_weighted_avg: wavgRounded,
      })
    })
  }
  return {
    rows,
    warnings,
    districtsParsed: districtBlocks.length,
    districtWAvgByName,
  }
}

/* ─── synthesizeCountyTier — helper exposed for super tool use ────────── */

/**
 * Ratio scaling: `county_tier = district_tier × (county_avg / district_weighted_avg)`.
 * Returns the synthesized dollar value plus a human-readable formula string
 * for provenance display. Rounds to whole dollars per acre.
 *
 * Used by SUPER_FARMLAND_VALUATION (FV-004 amendment) at lookup time when
 * a caller asks for county-grain tier data.
 */
export function synthesizeCountyTier(args: {
  county_avg: number
  district_tier: number
  district_weighted_avg: number
}): { value_per_acre: number; synthesis_formula: string } {
  const { county_avg, district_tier, district_weighted_avg } = args
  const raw = district_tier * (county_avg / district_weighted_avg)
  const v = Math.round(raw)
  return {
    value_per_acre: v,
    synthesis_formula: `synth: ${district_tier} × (${county_avg} / ${district_weighted_avg}) = ${v}`,
  }
}

/* ─── fetch plumbing ──────────────────────────────────────────────────── */

interface SafeFetchResult {
  ok: boolean
  status: number
  contentType?: string
  bytes?: ArrayBuffer
}

async function safeFetch(url: string, userAgent: string): Promise<SafeFetchResult> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': userAgent, Accept: '*/*' },
    })
    const bytes = await res.arrayBuffer()
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') ?? undefined,
      bytes,
    }
  } catch {
    return { ok: false, status: 0 }
  }
}

function looksLikeXlsx(contentType: string | undefined, bytes: ArrayBuffer | undefined): boolean {
  if (contentType?.includes('spreadsheet') || contentType?.includes('excel') || contentType?.includes('openxmlformats')) return true
  if (!bytes || bytes.byteLength < 4) return false
  // xlsx files start with PK (zip magic)
  const view = new Uint8Array(bytes, 0, 4)
  return view[0] === 0x50 && view[1] === 0x4b
}

function resolveCardUrl(href: string): string {
  if (href.startsWith('/')) return `${CARD_ORIGIN}${href}`
  return `${CARD_ORIGIN}/${href}`
}

/* ─── hashing ─────────────────────────────────────────────────────────── */

function sha256Bytes(bytes: ArrayBuffer): string {
  const h = createHash('sha256')
  h.update(Buffer.from(bytes))
  return h.digest('hex')
}

function safeSegment(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '')
}

/* ─── County → district mapping ───────────────────────────────────────── */

/**
 * 99 Iowa counties mapped to their ISU crop reporting district. Source: ISU
 * Ag Decision Maker C2-70 documentation — districts are stable since 1941.
 * Used for the outlier guardrail + county→district→tier ratio synthesis.
 */
const IOWA_COUNTY_DISTRICTS: Record<string, string> = {
  // Northwest
  Lyon: 'Northwest', Osceola: 'Northwest', Dickinson: 'Northwest', Emmet: 'Northwest',
  Sioux: 'Northwest', "O'Brien": 'Northwest', Clay: 'Northwest', Palo_Alto: 'Northwest',
  Plymouth: 'Northwest', Cherokee: 'Northwest', Buena_Vista: 'Northwest', Pocahontas: 'Northwest',
  'Palo Alto': 'Northwest', 'Buena Vista': 'Northwest',
  // North Central
  Kossuth: 'North Central', Winnebago: 'North Central', Worth: 'North Central',
  Mitchell: 'North Central', Hancock: 'North Central', 'Cerro Gordo': 'North Central',
  Humboldt: 'North Central', Wright: 'North Central', Franklin: 'North Central',
  Butler: 'North Central',
  // Northeast
  Howard: 'Northeast', Winneshiek: 'Northeast', Allamakee: 'Northeast',
  Chickasaw: 'Northeast', Floyd: 'Northeast', Bremer: 'Northeast', Fayette: 'Northeast',
  Clayton: 'Northeast', Buchanan: 'Northeast', Delaware: 'Northeast', Dubuque: 'Northeast',
  'Black Hawk': 'Northeast',
  // West Central
  Woodbury: 'West Central', Ida: 'West Central', Sac: 'West Central', Calhoun: 'West Central',
  Monona: 'West Central', Crawford: 'West Central', Carroll: 'West Central',
  Harrison: 'West Central', Shelby: 'West Central', Audubon: 'West Central', Greene: 'West Central',
  // Central
  Webster: 'Central', Hamilton: 'Central', Hardin: 'Central', Boone: 'Central',
  Story: 'Central', Marshall: 'Central', Dallas: 'Central', Polk: 'Central', Jasper: 'Central',
  Guthrie: 'Central',
  // East Central
  Grundy: 'East Central', Tama: 'East Central', Benton: 'East Central', Linn: 'East Central',
  Jones: 'East Central', Jackson: 'East Central', Iowa: 'East Central', Johnson: 'East Central',
  Cedar: 'East Central', Clinton: 'East Central', Scott: 'East Central', Poweshiek: 'East Central',
  // Southwest
  Pottawattamie: 'Southwest', Cass: 'Southwest', Adair: 'Southwest', Mills: 'Southwest',
  Montgomery: 'Southwest', Adams: 'Southwest', Fremont: 'Southwest', Page: 'Southwest',
  Taylor: 'Southwest',
  // South Central
  Madison: 'South Central', Warren: 'South Central', Marion: 'South Central',
  Mahaska: 'South Central', Union: 'South Central', Clarke: 'South Central',
  Lucas: 'South Central', Monroe: 'South Central', Ringgold: 'South Central',
  Decatur: 'South Central', Wayne: 'South Central', Appanoose: 'South Central',
  // Southeast
  Keokuk: 'Southeast', Washington: 'Southeast', Louisa: 'Southeast', Muscatine: 'Southeast',
  Jefferson: 'Southeast', Henry: 'Southeast', 'Des Moines': 'Southeast',
  Davis: 'Southeast', 'Van Buren': 'Southeast', Lee: 'Southeast', Wapello: 'Southeast',
}

/* ─── __testonly — helpers exposed for unit tests ─────────────────────── */

export const __testonly = {
  IOWA_COUNTIES,
  IOWA_DISTRICTS,
  IOWA_COUNTY_DISTRICTS,
  OUTLIER_RELATIVE_DEVIATION,
  parseIsuWorkbook,
  extractCountyAverages,
  extractDistrictRows,
  synthesizeCountyTier,
  looksLikeXlsx,
  safeSegment,
}
