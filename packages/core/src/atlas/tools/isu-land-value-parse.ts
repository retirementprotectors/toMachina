// ---------------------------------------------------------------------------
// Atomic Tool: isu-land-value-parse
//
// Fetches the annual ISU Extension Iowa Land Value Survey PDF + parses it
// into structured per-county-tier rows. Used by SUPER_FARMLAND_VALUATION
// (cache lookup) and WIRE_FARMLAND_VALUE_SEED (annual Jan 15 cron).
//
// Sprint: SPR-FARMLAND-VALUATION-001 (FV-003)
// ZRD: ZRD-PLATFORM-FARMLAND-VALUATION-API
//
// MEGAZORD ruling — GAP 1 fetch strategy (2026-04-14):
//   1. Try known URL pattern first:
//        https://www.extension.iastate.edu/agdm/wholefarm/pdf/c2-70-{YY}.pdf
//      where YY = prior-year 2-digit.
//   2. On 404 / non-PDF: scrape index page
//        https://www.extension.iastate.edu/agdm/wholefarm/html/c2-70.html
//      for <a href> matching /c2-70(-\d+)?\.pdf/i; pick latest-year filename.
//   3. On both failures: return { success: false } with the fetched index
//      page body attached so the caller (cron wire) can post it to #megazord
//      for same-session fixer intervention. No silent fallback to prior-year.
//
// Dependency-free PDF extraction — the caller injects `textExtractor`.
// @tomachina/core stays runtime-dep-free; WIRE_FARMLAND_VALUE_SEED (FV-005)
// will wire in the canonical extractor using whichever PDF library is
// appropriate for the Cloud Functions runtime.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto'
import type { AtomicToolDefinition, AtomicToolResult } from '../types'
import type { FarmlandValueRow, QualityTier } from '../../types/farm-holdings'

/* ─── Tool definition ────────────────────────────────────────────────── */

export const definition: AtomicToolDefinition = {
  tool_id: 'isu-land-value-parse',
  name: 'ISU Extension Land Value Parse',
  description:
    'Fetch + parse the annual ISU Extension Iowa Land Value Survey PDF into per-county-tier rows (99 counties × 3 tiers = 297 expected). Implements MEGAZORD GAP 1 three-tier fetch: pattern URL → index scrape → fail-loud with index-page body. Dependency-free PDF extraction — caller injects textExtractor.',
  used_by: ['SUPER_FARMLAND_VALUATION', 'WIRE_FARMLAND_VALUE_SEED'],
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const ISU_INDEX_URL =
  'https://www.extension.iastate.edu/agdm/wholefarm/html/c2-70.html'
const ISU_PDF_BASE =
  'https://www.extension.iastate.edu/agdm/wholefarm/pdf'

/** Order of tier columns on the ISU PDF (canonical ordering per disco Tab 3). */
const TIER_ORDER: QualityTier[] = ['HIGH', 'MEDIUM', 'LOW']

/**
 * 99 Iowa counties — alphabetical. Used to anchor line-scanning in the
 * parser (ISU tables list counties in alphabetical order with three tier
 * columns; county-name match + nearby 3 dollar values yields one row per
 * tier).
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

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface IsuParseInput {
  /**
   * The survey year to fetch. ISU releases in mid-Nov to mid-Dec of each
   * year N, covering data for year N. Defaults to `currentYear - 1` when
   * omitted — matches the annual Jan 15 cron cadence.
   */
  year?: number

  /**
   * Pre-fetched PDF bytes. When provided, skips the 3-tier HTTP fetch.
   * Primary use: unit tests + manual retries.
   */
  pdfBytes?: ArrayBuffer

  /**
   * Caller-injected PDF-to-text extractor. REQUIRED unless
   * `preExtractedText` is supplied. @tomachina/core is runtime-dep-free;
   * the canonical extractor lives in WIRE_FARMLAND_VALUE_SEED's runtime.
   */
  textExtractor?: (bytes: ArrayBuffer) => Promise<string>

  /** Skip fetch + extraction entirely (for pure-parser unit tests). */
  preExtractedText?: string

  /** Override the default user-agent on the HTTP fetches. */
  userAgent?: string
}

export interface IsuParseOutput {
  year: number
  source_url: string
  source_doc_hash: string
  rows: FarmlandValueRow[]
  counties_parsed: number
  rows_parsed: number
  /** Non-fatal warnings (e.g. county missing a tier column). */
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
 * Main entry point. Fetches (unless bytes/text provided) and parses an
 * ISU annual land-value PDF into 297 expected rows. Failure modes:
 *   - { success: false, error, detail }  when three-tier fetch exhausts
 *   - { success: false, error }           when parsing yields 0 rows
 *   - { success: true, data }             normal, warnings surfaced inside data
 */
export async function execute(
  input: IsuParseInput
): Promise<AtomicToolResult<IsuParseOutput> & { detail?: IsuFetchFailureDetail }> {
  const year = input.year ?? new Date().getUTCFullYear() - 1

  let rawText: string
  let sourceUrl: string
  let sourceDocHash: string

  // ── If pre-extracted text is provided, skip fetch + extraction. ────
  if (input.preExtractedText) {
    rawText = input.preExtractedText
    sourceUrl = `preExtractedText:${year}`
    sourceDocHash = `sha256:${sha256(input.preExtractedText)}`
  } else {
    // ── Fetch PDF bytes (three-tier strategy) ─────────────────────────
    let bytes: ArrayBuffer
    if (input.pdfBytes) {
      bytes = input.pdfBytes
      sourceUrl = `pdfBytes:${year}`
    } else {
      const fetched = await fetchIsuPdf(year, input.userAgent)
      if (!fetched.success) {
        return { success: false, error: fetched.error, detail: fetched.detail }
      }
      bytes = fetched.bytes
      sourceUrl = fetched.sourceUrl
    }
    sourceDocHash = `sha256:${sha256Bytes(bytes)}`

    // ── Extract text ──────────────────────────────────────────────────
    if (!input.textExtractor) {
      return {
        success: false,
        error:
          'textExtractor is required when pdfBytes/preExtractedText are not provided. Callers must inject a PDF text extractor (WIRE_FARMLAND_VALUE_SEED wires in the canonical extractor).',
      }
    }
    try {
      rawText = await input.textExtractor(bytes)
    } catch (err) {
      return {
        success: false,
        error: `textExtractor threw: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  // ── Parse text → rows ───────────────────────────────────────────────
  const parsed = parseIsuPdfText(rawText, year, sourceUrl, sourceDocHash)
  if (parsed.rows.length === 0) {
    return {
      success: false,
      error: `ISU parser returned 0 rows (expected 99 counties × 3 tiers = 297). Text length: ${rawText.length}. First 200 chars: "${rawText.slice(0, 200)}".`,
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
      rows_parsed: parsed.rows.length,
      warnings: parsed.warnings,
    },
  }
}

/* ─── fetchIsuPdf — 3-tier strategy ───────────────────────────────────── */

/**
 * MEGAZORD GAP 1 ruling: pattern → index scrape → fail-loud. No silent
 * fallback to prior-year data. Returns the fetched index-page body on
 * double-failure so the caller can post to #megazord for same-session
 * fixer intervention.
 */
export async function fetchIsuPdf(
  year: number,
  userAgent: string = 'toMachina/RONIN (FV-003 ISU parser)'
): Promise<
  | { success: true; bytes: ArrayBuffer; sourceUrl: string }
  | { success: false; error: string; detail: IsuFetchFailureDetail }
> {
  const yy = String(year).slice(-2).padStart(2, '0')
  const patternUrl = `${ISU_PDF_BASE}/c2-70-${yy}.pdf`
  const attemptedUrls: string[] = []

  // ── Tier 1: known pattern ─────────────────────────────────────────
  attemptedUrls.push(patternUrl)
  const patternResp = await safeFetch(patternUrl, userAgent)
  if (patternResp.ok && patternResp.contentType?.includes('pdf')) {
    return { success: true, bytes: patternResp.bytes!, sourceUrl: patternUrl }
  }

  // ── Tier 2: scrape the index page ─────────────────────────────────
  attemptedUrls.push(ISU_INDEX_URL)
  const indexResp = await safeFetch(ISU_INDEX_URL, userAgent)
  if (!indexResp.ok || !indexResp.contentType?.includes('html')) {
    return {
      success: false,
      error: `ISU index page unreachable (status ${indexResp.status}). Pattern URL ${patternUrl} also failed (status ${patternResp.status}).`,
      detail: {
        attempted_urls: attemptedUrls,
        index_page_http_status: indexResp.status,
        index_page_content_type: indexResp.contentType,
      },
    }
  }
  const indexBody = indexResp.bytes ? new TextDecoder().decode(indexResp.bytes) : ''
  const linkRegex = /href\s*=\s*["']([^"']*c2-70(?:-(\d{2,4}))?\.pdf)["']/gi
  const candidates: Array<{ url: string; year: number }> = []
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(indexBody)) !== null) {
    const href = match[1]
    const yearFromFilename = parseYearFromFilename(href, year)
    const absoluteUrl = href.startsWith('http') ? href : resolveIsuUrl(href)
    candidates.push({ url: absoluteUrl, year: yearFromFilename })
  }

  if (candidates.length === 0) {
    return {
      success: false,
      error: `ISU index page contained no c2-70 PDF links. Parser cannot self-heal without a human update.`,
      detail: {
        attempted_urls: attemptedUrls,
        index_page_body: indexBody,
        index_page_http_status: indexResp.status,
        index_page_content_type: indexResp.contentType,
      },
    }
  }

  // Pick the latest-year candidate, then fetch it.
  candidates.sort((a, b) => b.year - a.year)
  const picked = candidates[0]
  attemptedUrls.push(picked.url)
  const pickedResp = await safeFetch(picked.url, userAgent)
  if (!pickedResp.ok || !pickedResp.contentType?.includes('pdf')) {
    return {
      success: false,
      error: `Index-scraped PDF URL ${picked.url} unreachable (status ${pickedResp.status}).`,
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

/* ─── parseIsuPdfText — pure function, testable with fixtures ─────────── */

/**
 * Walk the extracted text line-by-line. When a line starts with (or contains)
 * a known Iowa county name, extract up to three dollar values from that line
 * and emit HIGH/MEDIUM/LOW rows in canonical column order. Tolerant to:
 *   - $ signs (stripped)
 *   - commas in values (stripped)
 *   - extra whitespace
 *   - tie-breaking text between county name and values
 *   - lines where the county wraps to the next line (2-line lookahead)
 *
 * Warnings (not errors) are emitted when:
 *   - A county row has fewer than 3 dollar values
 *   - A county appears twice (duplicate row)
 *   - A county is missing entirely (reported as `counties_missing`)
 */
export function parseIsuPdfText(
  text: string,
  year: number,
  sourceUrl: string,
  sourceDocHash: string
): { rows: FarmlandValueRow[]; warnings: string[]; countiesParsed: number } {
  const rows: FarmlandValueRow[] = []
  const warnings: string[] = []
  const seenCounties = new Set<string>()

  // Normalize whitespace; preserve line breaks.
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const countySet = new Set(IOWA_COUNTIES.map((c) => c.toLowerCase()))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const found = matchCountyAtLineStart(line, countySet)
    if (!found) continue
    const { county } = found

    // Look for dollar values on the same line, then next 1 line if needed.
    let numericLine = line
    const values = extractDollarValues(numericLine)
    if (values.length < 3 && i + 1 < lines.length) {
      numericLine = line + ' ' + lines[i + 1]
      const extended = extractDollarValues(numericLine)
      if (extended.length > values.length) {
        values.length = 0
        values.push(...extended)
      }
    }

    if (values.length === 0) continue // likely a header row mentioning the county

    const canonicalCounty = toCanonicalCounty(county) || county
    if (seenCounties.has(canonicalCounty)) {
      warnings.push(`Duplicate county row: "${canonicalCounty}" — first occurrence kept.`)
      continue
    }
    seenCounties.add(canonicalCounty)

    if (values.length < 3) {
      warnings.push(
        `County "${canonicalCounty}" yielded only ${values.length} value(s) — expected 3 (HIGH/MEDIUM/LOW). Partial row(s) emitted.`
      )
    }

    for (let t = 0; t < Math.min(3, values.length); t++) {
      const tier = TIER_ORDER[t]
      rows.push(buildRow({
        year,
        state: 'IA',
        county: canonicalCounty,
        tier,
        valuePerAcre: values[t],
        sourceUrl,
        sourceDocHash,
      }))
    }
  }

  // Report missing counties (potentially signals a layout change)
  const missing: string[] = []
  for (const c of IOWA_COUNTIES) {
    if (!seenCounties.has(c)) missing.push(c)
  }
  if (missing.length > 0) {
    warnings.push(
      `Missing ${missing.length} counties from parse output — likely indicates ISU PDF layout drift. Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}.`
    )
  }

  return { rows, warnings, countiesParsed: seenCounties.size }
}

/* ─── Internal helpers ───────────────────────────────────────────────── */

interface SafeFetchResult {
  ok: boolean
  status: number
  contentType?: string
  bytes?: ArrayBuffer
}

async function safeFetch(url: string, userAgent: string): Promise<SafeFetchResult> {
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': userAgent, Accept: 'application/pdf, text/html, */*' },
      redirect: 'follow',
    })
    const contentType = resp.headers.get('content-type') || undefined
    if (!resp.ok) return { ok: false, status: resp.status, contentType }
    const bytes = await resp.arrayBuffer()
    return { ok: true, status: resp.status, contentType, bytes }
  } catch (err) {
    return { ok: false, status: 0, contentType: err instanceof Error ? err.message : 'network error' }
  }
}

function parseYearFromFilename(href: string, fallback: number): number {
  const m = href.match(/c2-70-(\d{2,4})\.pdf/i)
  if (!m) return fallback
  const raw = m[1]
  if (raw.length === 2) {
    const n = Number(raw)
    // 2-digit year — assume 2000s unless implausible (>50 → 1900s, else 2000s)
    return n > 50 ? 1900 + n : 2000 + n
  }
  return Number(raw)
}

function resolveIsuUrl(href: string): string {
  if (href.startsWith('/')) return `https://www.extension.iastate.edu${href}`
  if (href.startsWith('pdf/')) return `${ISU_PDF_BASE}/${href.replace(/^pdf\//, '')}`
  return `${ISU_PDF_BASE}/${href}`
}

function matchCountyAtLineStart(
  line: string,
  countySet: Set<string>
): { county: string } | null {
  if (!line) return null
  // Try the longest possible county prefix first — "Black Hawk" beats "Black".
  const tokens = line.split(/\s+/)
  for (const span of [3, 2, 1]) {
    if (tokens.length < span) continue
    const candidate = tokens.slice(0, span).join(' ').replace(/[^\w'\s]/g, '').trim()
    if (countySet.has(candidate.toLowerCase())) {
      return { county: candidate }
    }
  }
  return null
}

function toCanonicalCounty(raw: string): string | null {
  const rawLower = raw.toLowerCase()
  for (const c of IOWA_COUNTIES) {
    if (c.toLowerCase() === rawLower) return c
  }
  return null
}

function extractDollarValues(line: string): number[] {
  // Matches $12,345 / $1,234.56 / 12345 / 1234.56 / etc. Requires at least 3 digits
  // to avoid picking up stray "10" footnotes.
  const re = /\$?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{3,}(?:\.\d+)?)/g
  const out: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n >= 100) out.push(Math.round(n))
  }
  return out
}

function buildRow(args: {
  year: number
  state: string
  county: string
  tier: QualityTier
  valuePerAcre: number
  sourceUrl: string
  sourceDocHash: string
}): FarmlandValueRow {
  return {
    id: `ISU_${args.state}_${args.county.replace(/\s+/g, '_')}_${args.year}_${args.tier}`,
    source: 'ISU_EXTENSION',
    state: args.state,
    county: args.county,
    year: args.year,
    tier: args.tier,
    value_per_acre: args.valuePerAcre,
    currency: 'USD',
    methodology_notes: 'ISU Extension annual Iowa Land Value Survey — farm-manager + lender + assessor respondents',
    fetched_at: new Date().toISOString(),
    source_url: args.sourceUrl,
    source_doc_hash: args.sourceDocHash,
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function sha256Bytes(bytes: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex')
}

/* ─── Test-only exports (stable for fixture-based tests) ──────────────── */

export const __testonly = {
  IOWA_COUNTIES,
  TIER_ORDER,
  ISU_PDF_BASE,
  ISU_INDEX_URL,
  parseYearFromFilename,
  matchCountyAtLineStart,
  extractDollarValues,
  toCanonicalCounty,
}
