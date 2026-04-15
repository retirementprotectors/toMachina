/**
 * FV-003 v2 + FV-004 atomic/super-tool tests.
 *
 * Pure: reads the committed ISU xlsx fixture, drives the parser, asserts
 * row counts + specific county/district values + synthesis-helper math.
 * No network, no Firestore — deterministic against the pinned fixture.
 *
 * Sprint: SPR-FARMLAND-VALUATION-001
 * Covers:
 *   - FV-003 v2 xlsx parser (99 county_avg + 9 district_wavg + 27
 *     district_tier = 135 rows for 2025)
 *   - synthesizeCountyTier ratio-scaling helper
 *   - outlier_from_district guardrail (25% deviation threshold)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import {
  parseIsuWorkbook,
  __testonly,
} from '../../../packages/core/src/atlas/tools/isu-land-value-parse'

const FIXTURES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'core',
  'src',
  'atlas',
  'tools',
  '__fixtures__',
)
const XLSX_FIXTURE = join(FIXTURES_DIR, 'isu-land-value-sample.xlsx')
const PDF_FIXTURE = join(FIXTURES_DIR, 'isu-land-value-sample.pdf')

const FIXTURE_YEAR = 2025
const FIXTURE_SOURCE_URL = 'test:fixture'
const FIXTURE_HASH = 'sha256:testfixture'

function loadFixture(): XLSX.WorkBook {
  const bytes = readFileSync(XLSX_FIXTURE)
  return XLSX.read(bytes, { type: 'buffer' })
}

// ---------------------------------------------------------------------------
// FV-003 v2: parseIsuWorkbook — core shape
// ---------------------------------------------------------------------------

describe('FV-003 v2: parseIsuWorkbook', () => {
  it('emits 99 county_avg + 9 district_weighted_avg + 27 district_tier rows for 2025 (135 total)', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)

    expect(out.countiesParsed).toBe(99)
    expect(out.districtsParsed).toBe(9)

    const byGrain = out.rows.reduce<Record<string, number>>((acc, r) => {
      const g = r.grain ?? 'unknown'
      acc[g] = (acc[g] || 0) + 1
      return acc
    }, {})
    expect(byGrain['county_avg']).toBe(99)
    expect(byGrain['district_weighted_avg']).toBe(9)
    expect(byGrain['district_tier']).toBe(27)
    expect(out.rows.length).toBe(135)
  })

  it('county_avg rows carry composite ID ISU_IA_{county}_{year}', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    const polk = out.rows.find((r) => r.county === 'Polk' && r.grain === 'county_avg')
    expect(polk?.id).toBe('ISU_IA_Polk_2025')
    expect(polk?.tier).toBeNull()
    expect(polk?.value_per_acre).toBeGreaterThan(0)
    expect(polk?.source).toBe('ISU_EXTENSION')
    expect(polk?.state).toBe('IA')
  })

  it('all 99 Iowa counties are present as county_avg rows', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    const countyNames = new Set(
      out.rows.filter((r) => r.grain === 'county_avg').map((r) => r.county),
    )
    for (const c of __testonly.IOWA_COUNTIES) {
      expect(countyNames.has(c)).toBe(true)
    }
  })

  it('specific counties render real data (Polk, Story, Johnson, Washington)', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    const byCounty = Object.fromEntries(
      out.rows
        .filter((r) => r.grain === 'county_avg')
        .map((r) => [r.county, r.value_per_acre]),
    )
    // Real 2025 values — sanity-bounded ($1K–$25K/ac is the Iowa farmland range).
    for (const c of ['Polk', 'Story', 'Johnson', 'Washington']) {
      expect(byCounty[c]).toBeGreaterThan(1000)
      expect(byCounty[c]).toBeLessThan(25000)
    }
  })
})

// ---------------------------------------------------------------------------
// FV-003 v2: district tier structure
// ---------------------------------------------------------------------------

describe('FV-003 v2: district tier rows', () => {
  it('Northwest district HIGH > MEDIUM > LOW for 2025', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    const nw = out.rows.filter((r) => r.district_id === 'Northwest' && r.grain === 'district_tier')
    expect(nw.length).toBe(3)
    const tiers = Object.fromEntries(nw.map((r) => [r.tier, r.value_per_acre]))
    expect(tiers.HIGH).toBeGreaterThan(tiers.MEDIUM)
    expect(tiers.MEDIUM).toBeGreaterThan(tiers.LOW)
  })

  it('all 9 districts present with weighted_avg rows', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    const wavgNames = new Set(
      out.rows.filter((r) => r.grain === 'district_weighted_avg').map((r) => r.district_id),
    )
    for (const d of __testonly.IOWA_DISTRICTS) {
      expect(wavgNames.has(d)).toBe(true)
    }
  })

  it('district tier IDs follow ISU_IA_DIST_{district}_{year}_{tier} convention', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    const nwHigh = out.rows.find(
      (r) => r.district_id === 'Northwest' && r.tier === 'HIGH' && r.grain === 'district_tier',
    )
    expect(nwHigh?.id).toBe('ISU_IA_DIST_Northwest_2025_HIGH')
  })
})

// ---------------------------------------------------------------------------
// FV-004 amendment: synthesizeCountyTier ratio math
// ---------------------------------------------------------------------------

describe('FV-004 amendment: synthesizeCountyTier', () => {
  it('applies district-ratio scaling: county_tier = district_tier × (county_avg / district_weighted)', () => {
    const r = __testonly.synthesizeCountyTier({
      county_avg: 12000,
      district_tier: 16000,
      district_weighted_avg: 14000,
    })
    // 16000 × (12000 / 14000) = 13714.28... → rounds to 13714
    expect(r.value_per_acre).toBe(13714)
    expect(r.synthesis_formula).toContain('synth:')
    expect(r.synthesis_formula).toContain('13714')
  })

  it('round-trips identity when county_avg == district_weighted_avg', () => {
    const r = __testonly.synthesizeCountyTier({
      county_avg: 10000,
      district_tier: 12500,
      district_weighted_avg: 10000,
    })
    expect(r.value_per_acre).toBe(12500)
  })
})

// ---------------------------------------------------------------------------
// FV-003 v2 guardrail: outlier_from_district flag
// ---------------------------------------------------------------------------

describe('FV-003 v2: outlier_from_district flag', () => {
  it('threshold constant is 25%', () => {
    expect(__testonly.OUTLIER_RELATIVE_DEVIATION).toBe(0.25)
  })

  it('fixture rows set outlier_from_district=true only when deviation > 25%', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    for (const row of out.rows.filter((r) => r.grain === 'county_avg')) {
      if (row.district_weighted_avg == null) continue
      const deviation = Math.abs(row.value_per_acre - row.district_weighted_avg) / row.district_weighted_avg
      if (row.outlier_from_district === true) {
        expect(deviation).toBeGreaterThan(0.25)
      } else {
        expect(deviation).toBeLessThanOrEqual(0.25)
      }
    }
  })

  it('every county_avg row has district_id + district_weighted_avg attached', () => {
    const wb = loadFixture()
    const out = parseIsuWorkbook(wb, FIXTURE_YEAR, FIXTURE_SOURCE_URL, FIXTURE_HASH)
    for (const row of out.rows.filter((r) => r.grain === 'county_avg')) {
      expect(row.district_id).toBeDefined()
      expect(typeof row.district_weighted_avg).toBe('number')
    }
  })
})

// ---------------------------------------------------------------------------
// Negative-case drift-guard: PDF fixture must yield zero data via xlsx parse
// ---------------------------------------------------------------------------

describe('FV-003 v2: PDF drift-guard', () => {
  it('xlsx parse against legacy PDF fixture throws / yields no workbook', () => {
    const bytes = readFileSync(PDF_FIXTURE)
    let threw = false
    let wb: XLSX.WorkBook | null = null
    try {
      wb = XLSX.read(bytes, { type: 'buffer' })
    } catch {
      threw = true
    }
    // xlsx.read on a PDF will either throw or return a workbook with no
    // County/District sheets — either is an acceptable drift signal.
    if (!threw && wb) {
      expect(wb.Sheets['County']).toBeUndefined()
      expect(wb.Sheets['District']).toBeUndefined()
    } else {
      expect(threw).toBe(true)
    }
  })
})
