/**
 * FV-002 nass-lookup atomic tool tests.
 *
 * Pure tests — no network, no Firestore. Uses the injected `fetcher`
 * override to mock NASS responses. Bypasses the 1 sec throttle via the
 * __testonly reset helper.
 *
 * Sprint: SPR-FARMLAND-VALUATION-001 (FV-002)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  execute,
  __testonly,
} from '../../../packages/core/src/atlas/tools/nass-lookup'

function mockFetcher(responseJson: unknown, ok = true, status = 200) {
  return async () => ({
    ok,
    status,
    json: async () => responseJson,
  })
}

beforeEach(() => {
  __testonly.resetThrottleForTests()
  process.env.NASS_QUICK_STATS_KEY = 'test-key-dummy'
})

// ---------------------------------------------------------------------------
// execute()
// ---------------------------------------------------------------------------

describe('FV-002: nass-lookup.execute()', () => {
  it('returns success + value_per_acre from a well-formed NASS response', async () => {
    const fetcher = mockFetcher({
      data: [
        {
          Value: '7,850',
          short_desc: 'AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE',
          state_alpha: 'IA',
          county_name: 'POLK',
          year: '2017',
        },
      ],
    })
    const r = await execute({
      state: 'IA',
      county: 'Polk',
      year: 2017,
      fetcher,
    })
    expect(r.success).toBe(true)
    expect(r.data?.value_per_acre).toBe(7850)
    expect(r.data?.state).toBe('IA')
    expect(r.data?.county).toBe('Polk')
    expect(r.data?.source_url).toContain('key=REDACTED')
    expect(r.data?.source_url).not.toContain('test-key-dummy')
  })

  it('throws clear error when NASS_QUICK_STATS_KEY is unset', async () => {
    delete process.env.NASS_QUICK_STATS_KEY
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017 })
    expect(r.success).toBe(false)
    expect(r.error).toContain('NASS_QUICK_STATS_KEY')
  })

  it('returns failure on non-2xx HTTP status', async () => {
    const fetcher = mockFetcher({}, false, 503)
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017, fetcher })
    expect(r.success).toBe(false)
    expect(r.error).toContain('HTTP 503')
  })

  it('returns failure when NASS returns an empty data array', async () => {
    const fetcher = mockFetcher({ data: [] })
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017, fetcher })
    expect(r.success).toBe(false)
    expect(r.error).toContain('no usable rows')
  })

  it('treats (D) / (Z) / (NA) suppressed values as missing + returns failure', async () => {
    const fetcher = mockFetcher({ data: [{ Value: '(D)', short_desc: 'x' }, { Value: '(Z)' }, { Value: '(NA)' }] })
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017, fetcher })
    expect(r.success).toBe(false)
  })

  it('strips commas and dollar signs from the Value field', async () => {
    const fetcher = mockFetcher({ data: [{ Value: '$ 12,450', short_desc: 'x' }] })
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017, fetcher })
    expect(r.success).toBe(true)
    expect(r.data?.value_per_acre).toBe(12450)
  })

  it('defaults to AG_LAND category when none specified', async () => {
    let capturedUrl = ''
    const fetcher = async (url: string) => {
      capturedUrl = url
      return { ok: true, status: 200, json: async () => ({ data: [{ Value: '1000' }] }) }
    }
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017, fetcher })
    expect(r.success).toBe(true)
    expect(r.data?.category).toBe('AG_LAND')
    expect(capturedUrl).toContain('INCL+BUILDINGS')
  })

  it('picks first non-suppressed value even when earlier rows are (D)', async () => {
    const fetcher = mockFetcher({
      data: [
        { Value: '(D)' },
        { Value: '5,500', short_desc: 'real row' },
      ],
    })
    const r = await execute({ state: 'IA', county: 'Polk', year: 2017, fetcher })
    expect(r.data?.value_per_acre).toBe(5500)
  })
})

// ---------------------------------------------------------------------------
// buildShortDesc
// ---------------------------------------------------------------------------

describe('FV-002: buildShortDesc', () => {
  it('maps AG_LAND / CROPLAND / PASTURELAND to the NASS short_desc strings', () => {
    expect(__testonly.buildShortDesc('AG_LAND')).toContain('INCL BUILDINGS')
    expect(__testonly.buildShortDesc('CROPLAND')).toContain('CROPLAND')
    expect(__testonly.buildShortDesc('PASTURELAND')).toContain('PASTURELAND')
  })
})
