/**
 * FV-004 synth-confidence amendment tests.
 *
 * Pure tests — no Firestore, no network. Exercise the synthesized-tier
 * confidence logic (Guardrails 2 + 3) by injecting a mock FarmlandRowLoader
 * and asserting branch behavior.
 *
 * Sprint: SPR-FARMLAND-VALUATION-001 (FV-004 amendment)
 */

import { describe, it, expect } from 'vitest'
import {
  execute,
  __testonly,
} from '../../../packages/core/src/atlas/super-tools/farmland-valuation'
import type {
  FarmlandValueRow,
  FarmlandValuationSuccess,
} from '../../../packages/core/src/types/farm-holdings'

const YEAR = 2025
const ISO = '2026-04-15T12:00:00.000Z'

function row(partial: Partial<FarmlandValueRow> & { id: string }): FarmlandValueRow {
  return {
    source: 'ISU_EXTENSION',
    state: 'IA',
    county: '',
    year: YEAR,
    tier: null,
    value_per_acre: 0,
    currency: 'USD',
    methodology_notes: 'test fixture',
    fetched_at: ISO,
    source_url: 'test:fixture',
    source_doc_hash: 'sha256:test',
    ...partial,
  }
}

function loaderFrom(rows: Record<string, FarmlandValueRow>) {
  return async (rowId: string) => rows[rowId] ?? null
}

// ---------------------------------------------------------------------------
// confidenceForSynthesizedTier — pure unit tests
// ---------------------------------------------------------------------------

describe('FV-004 amend: confidenceForSynthesizedTier', () => {
  const baseArgs = {
    county_avg: 12000,
    nass_county_value: 12000, // 0% county baseline delta
    district_tier: 16000,
    district_weighted_avg: 14000,
    synthesized_tier: 13714, // 16000 × (12000/14000)
  }

  it('upgrades to HIGH when both thresholds pass', () => {
    expect(__testonly.confidenceForSynthesizedTier(baseArgs)).toBe('HIGH')
  })

  it('holds at MEDIUM when county baseline delta > 10%', () => {
    // NASS off by 15% → baseline delta = 0.15 > 0.10 → MEDIUM
    const r = __testonly.confidenceForSynthesizedTier({
      ...baseArgs,
      nass_county_value: Math.round(12000 * 1.18),
    })
    expect(r).toBe('MEDIUM')
  })

  it('holds at MEDIUM when synthesized-tier delta > 15%', () => {
    // Baseline passes (county_avg vs NASS close) but synthesized_tier is
    // far off from the NASS-derived tier → MEDIUM.
    const r = __testonly.confidenceForSynthesizedTier({
      ...baseArgs,
      synthesized_tier: 20000, // NASS-derived would be 16000 × (12000/14000) = 13714
    })
    expect(r).toBe('MEDIUM')
  })

  it('collapses to MEDIUM when any synthesis input is missing', () => {
    expect(
      __testonly.confidenceForSynthesizedTier({
        ...baseArgs,
        county_avg: null,
      }),
    ).toBe('MEDIUM')
    expect(
      __testonly.confidenceForSynthesizedTier({
        ...baseArgs,
        district_tier: null,
      }),
    ).toBe('MEDIUM')
    expect(
      __testonly.confidenceForSynthesizedTier({
        ...baseArgs,
        district_weighted_avg: null,
      }),
    ).toBe('MEDIUM')
  })
})

// ---------------------------------------------------------------------------
// execute() branch coverage — synthesized-tier path
// ---------------------------------------------------------------------------

describe('FV-004 amend: execute() synthesis path', () => {
  const COUNTY = 'Story'
  const DIST = 'Central'

  function v2Rows(opts: { outlier?: boolean; countyAvg?: number } = {}): Record<string, FarmlandValueRow> {
    const countyAvg = opts.countyAvg ?? 13500
    return {
      [__testonly.buildIsuCountyAvgRowId('IA', COUNTY, YEAR)]: row({
        id: __testonly.buildIsuCountyAvgRowId('IA', COUNTY, YEAR),
        county: COUNTY,
        tier: null,
        value_per_acre: countyAvg,
        grain: 'county_avg',
        district_id: DIST,
        district_weighted_avg: 13800,
        county_avg: countyAvg,
        outlier_from_district: opts.outlier ?? false,
      }),
      [__testonly.buildIsuDistrictTierRowId('IA', DIST, YEAR, 'HIGH')]: row({
        id: __testonly.buildIsuDistrictTierRowId('IA', DIST, YEAR, 'HIGH'),
        county: DIST,
        tier: 'HIGH',
        value_per_acre: 15700,
        grain: 'district_tier',
        district_id: DIST,
      }),
      [__testonly.buildIsuDistrictWavgRowId('IA', DIST, YEAR)]: row({
        id: __testonly.buildIsuDistrictWavgRowId('IA', DIST, YEAR),
        county: DIST,
        tier: null,
        value_per_acre: 13800,
        grain: 'district_weighted_avg',
        district_id: DIST,
        district_weighted_avg: 13800,
      }),
    }
  }

  it('synthesizes county tier via ratio + tags DISTRICT_RATIO_SYNTHESIZED', async () => {
    const r = await execute({
      county: COUNTY,
      state: 'IA',
      year: YEAR,
      quality_tier: 'HIGH',
      loadRow: loaderFrom(v2Rows()),
    })
    expect(r.success).toBe(true)
    const data = r.data as FarmlandValuationSuccess
    expect(data.tier_method).toBe('DISTRICT_RATIO_SYNTHESIZED')
    // 15700 × (13500 / 13800) ≈ 15358
    expect(data.value_per_acre).toBeGreaterThan(15000)
    expect(data.value_per_acre).toBeLessThan(15700)
    expect(data.synthesis_formula).toContain('synth:')
    // ISU-only (no NASS row) → MEDIUM cap
    expect(data.confidence).toBe('MEDIUM')
  })

  it('forces LOW confidence when county is outlier (Guardrail 3, ISU-only)', async () => {
    const r = await execute({
      county: COUNTY,
      state: 'IA',
      year: YEAR,
      quality_tier: 'HIGH',
      loadRow: loaderFrom(v2Rows({ outlier: true })),
    })
    const data = r.data as FarmlandValuationSuccess
    expect(data.tier_method).toBe('DISTRICT_RATIO_SYNTHESIZED')
    expect(data.confidence).toBe('LOW')
    expect(data.outlier_from_district).toBe(true)
  })

  it('forces LOW confidence when outlier (Guardrail 3) EVEN with NASS agreement', async () => {
    const rowsWithNass = {
      ...v2Rows({ outlier: true }),
      [__testonly.buildNassRowId('IA', COUNTY, YEAR)]: row({
        id: __testonly.buildNassRowId('IA', COUNTY, YEAR),
        source: 'USDA_NASS',
        county: COUNTY,
        value_per_acre: 13500, // agrees exactly with ISU county_avg
      }),
    }
    const r = await execute({
      county: COUNTY,
      state: 'IA',
      year: YEAR,
      quality_tier: 'HIGH',
      loadRow: loaderFrom(rowsWithNass),
    })
    const data = r.data as FarmlandValuationSuccess
    expect(data.confidence).toBe('LOW')
    expect(data.outlier_from_district).toBe(true)
  })

  it('upgrades to HIGH when NASS agrees + not outlier (Guardrail 2)', async () => {
    const rowsWithNass = {
      ...v2Rows(),
      [__testonly.buildNassRowId('IA', COUNTY, YEAR)]: row({
        id: __testonly.buildNassRowId('IA', COUNTY, YEAR),
        source: 'USDA_NASS',
        county: COUNTY,
        value_per_acre: 13500, // exact match on county_avg → baseline delta 0
      }),
    }
    const r = await execute({
      county: COUNTY,
      state: 'IA',
      year: YEAR,
      quality_tier: 'HIGH',
      loadRow: loaderFrom(rowsWithNass),
    })
    const data = r.data as FarmlandValuationSuccess
    expect(data.tier_method).toBe('DISTRICT_RATIO_SYNTHESIZED')
    expect(data.confidence).toBe('HIGH')
    expect(data.cross_check_source).toBe('USDA_NASS')
  })

  it('caps at MEDIUM when NASS off >10% on county baseline (Guardrail 2 fails)', async () => {
    const rowsWithNass = {
      ...v2Rows(),
      [__testonly.buildNassRowId('IA', COUNTY, YEAR)]: row({
        id: __testonly.buildNassRowId('IA', COUNTY, YEAR),
        source: 'USDA_NASS',
        county: COUNTY,
        value_per_acre: Math.round(13500 * 1.25), // 25% above county_avg
      }),
    }
    const r = await execute({
      county: COUNTY,
      state: 'IA',
      year: YEAR,
      quality_tier: 'HIGH',
      loadRow: loaderFrom(rowsWithNass),
    })
    const data = r.data as FarmlandValuationSuccess
    expect(data.confidence).toBe('MEDIUM')
  })

  it('tier=null with only county_avg present → BLEND_DEFAULT returning county_avg directly', async () => {
    // Only county_avg, no district rows — falls back to BLEND_DEFAULT.
    const r = await execute({
      county: COUNTY,
      state: 'IA',
      year: YEAR,
      quality_tier: null,
      loadRow: loaderFrom({
        [__testonly.buildIsuCountyAvgRowId('IA', COUNTY, YEAR)]: row({
          id: __testonly.buildIsuCountyAvgRowId('IA', COUNTY, YEAR),
          county: COUNTY,
          value_per_acre: 13500,
          grain: 'county_avg',
        }),
      }),
    })
    const data = r.data as FarmlandValuationSuccess
    expect(data.tier_method).toBe('BLEND_DEFAULT')
    expect(data.value_per_acre).toBe(13500)
  })
})

// ---------------------------------------------------------------------------
// Threshold constant self-check
// ---------------------------------------------------------------------------

describe('FV-004 amend: threshold constants', () => {
  it('SYNTHESIS_CONFIDENCE_THRESHOLDS are exactly 10% + 15%', () => {
    expect(__testonly.SYNTHESIS_CONFIDENCE_THRESHOLDS.COUNTY_BASELINE_MAX).toBe(0.10)
    expect(__testonly.SYNTHESIS_CONFIDENCE_THRESHOLDS.SYNTHESIZED_TIER_MAX).toBe(0.15)
  })
})
