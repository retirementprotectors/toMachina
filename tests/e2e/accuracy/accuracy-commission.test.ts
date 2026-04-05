/**
 * ZRD-D07: Data Accuracy — Commission Statement Parsing
 *
 * Verifies:
 *   - Gradient format (statement-a) detected and mapped correctly
 *   - Signal format (statement-b) detected and mapped correctly
 *   - Dollar amounts match to the penny after mapping
 *   - Split percentages calculate correctly
 *   - Total commission sums match source totals
 *   - No floating point drift (use integer cents comparison)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  CARRIER_FORMATS,
  detectCarrierFormat,
  mapRowToCanonical,
} from '../../../services/api/src/lib/carrier-formats'

const repoRoot = resolve(__dirname, '..', '..', '..')
const fixturesDir = resolve(repoRoot, 'tests/e2e/fixtures')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a simple CSV string into headers + rows */
function parseCsv(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = raw.trim().split('\n').filter((l) => l.trim())
  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
  return { headers, rows }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Parse a dollar amount string to integer cents to avoid floating point.
 * "$1,250.00" → 125000, "500.00" → 50000
 */
function toCents(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '')
  // Multiply by 100 and round to integer cents
  return Math.round(parseFloat(cleaned) * 100)
}

/**
 * Format cents back to dollar string for display in assertions
 */
function fromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

// ---------------------------------------------------------------------------
// Load fixtures
// ---------------------------------------------------------------------------

const csvA = readFileSync(resolve(fixturesDir, 'commission-statement-a.csv'), 'utf-8')
const csvB = readFileSync(resolve(fixturesDir, 'commission-statement-b.csv'), 'utf-8')
const { headers: headersA, rows: rowsA } = parseCsv(csvA)
const { headers: headersB, rows: rowsB } = parseCsv(csvB)

// ---------------------------------------------------------------------------
// Statement A — Gradient format
// ---------------------------------------------------------------------------

describe('ZRD-D07: commission-statement-a.csv — Gradient format detection', () => {
  it('detects gradient_commission format', () => {
    const fmt = detectCarrierFormat(headersA)
    expect(fmt).not.toBeNull()
    expect(fmt!.carrier_id).toBe('gradient_commission')
    expect(fmt!.carrier_name).toBe('Gradient (Commission Statement)')
    expect(fmt!.default_category).toBe('commission')
  })

  it('has 5 data rows', () => {
    expect(rowsA).toHaveLength(5)
  })
})

describe('ZRD-D07: commission-statement-a.csv — row-by-row canonical mapping', () => {
  const fmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'gradient_commission')!

  it('row 1: Robert Johnson POL-001234 maps correctly', () => {
    const canonical = mapRowToCanonical(rowsA[0], fmt)
    expect(canonical.carrier_id).toBe('gradient_commission')
    expect(canonical.transaction_date).toBe('2026-01-15')
    expect(canonical.policy_number).toBe('POL-001234')
    // carrier_name is pre-populated from format definition (first-match-wins).
    // Row's 'Carrier' field maps to carrier_name in column_map but is dropped
    // because the format-level value is already set.
    expect(canonical.carrier_name).toBe('Gradient (Commission Statement)')
    expect(canonical.product_type).toBe('Performance Elite 10')
    expect(canonical.client_name).toBe('Robert Johnson')
    expect(canonical.agent_npn).toBe('12345678')
    expect(canonical.gross_commission).toBe('1250.00')
    expect(canonical.net_commission).toBe('1125.00')
    expect(canonical.override_amount).toBe('125.00')
    expect(canonical.commission_type).toBe('New Business')
    expect(canonical.premium_basis).toBe('100000.00')
  })

  it('row 2: María García-López POL-005678 maps correctly', () => {
    const canonical = mapRowToCanonical(rowsA[1], fmt)
    expect(canonical.policy_number).toBe('POL-005678')
    expect(canonical.client_name).toBe('García-López, María')
    expect(canonical.agent_npn).toBe('87654321')
    expect(canonical.gross_commission).toBe('2500.00')
    expect(canonical.net_commission).toBe('2250.00')
    expect(canonical.override_amount).toBe('250.00')
    expect(canonical.commission_type).toBe('New Business')
  })

  it('row 3: James T. Smith POL-009012 Renewal maps correctly', () => {
    const canonical = mapRowToCanonical(rowsA[2], fmt)
    expect(canonical.policy_number).toBe('POL-009012')
    expect(canonical.commission_type).toBe('Renewal')
    expect(canonical.gross_commission).toBe('375.25')
    expect(canonical.net_commission).toBe('337.73')
    expect(canonical.override_amount).toBe('37.52')
  })

  it('all 5 rows have policy_number and commission_type', () => {
    for (const row of rowsA) {
      const canonical = mapRowToCanonical(row, fmt)
      expect(canonical.policy_number).toBeTruthy()
      expect(canonical.commission_type).toBeTruthy()
      expect(canonical.account_category).toBe('commission')
    }
  })
})

describe('ZRD-D07: commission-statement-a.csv — dollar amount accuracy (to the penny)', () => {
  const fmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'gradient_commission')!

  it('gross commissions match to the penny', () => {
    const expectedGrossCents = [125000, 250000, 37525, 62550, 187575]
    rowsA.forEach((row, i) => {
      const canonical = mapRowToCanonical(row, fmt)
      const cents = toCents(String(canonical.gross_commission))
      expect(cents).toBe(expectedGrossCents[i])
    })
  })

  it('net commissions match to the penny', () => {
    const expectedNetCents = [112500, 225000, 33773, 56295, 168818]
    rowsA.forEach((row, i) => {
      const canonical = mapRowToCanonical(row, fmt)
      const cents = toCents(String(canonical.net_commission))
      expect(cents).toBe(expectedNetCents[i])
    })
  })

  it('override amounts match to the penny', () => {
    const expectedOverrideCents = [12500, 25000, 3752, 6255, 18757]
    rowsA.forEach((row, i) => {
      const canonical = mapRowToCanonical(row, fmt)
      const cents = toCents(String(canonical.override_amount))
      expect(cents).toBe(expectedOverrideCents[i])
    })
  })

  it('total gross commission sum matches source total', () => {
    // 1250.00 + 2500.00 + 375.25 + 625.50 + 1875.75 = 6626.50
    const expectedTotalCents = 662650 // 6626.50 in cents
    const actualTotalCents = rowsA.reduce((sum, row) => {
      const canonical = mapRowToCanonical(row, fmt)
      return sum + toCents(String(canonical.gross_commission))
    }, 0)
    expect(actualTotalCents).toBe(expectedTotalCents)
    expect(fromCents(actualTotalCents)).toBe('6626.50')
  })

  it('total net commission sum matches source total', () => {
    // 1125.00 + 2250.00 + 337.73 + 562.95 + 1688.18 = 5963.86
    const expectedTotalCents = 596386 // 5963.86 in cents
    const actualTotalCents = rowsA.reduce((sum, row) => {
      const canonical = mapRowToCanonical(row, fmt)
      return sum + toCents(String(canonical.net_commission))
    }, 0)
    expect(actualTotalCents).toBe(expectedTotalCents)
    expect(fromCents(actualTotalCents)).toBe('5963.86')
  })

  it('net + override = gross for each row (no leakage)', () => {
    rowsA.forEach((row) => {
      const canonical = mapRowToCanonical(row, fmt)
      const grossCents = toCents(String(canonical.gross_commission))
      const netCents = toCents(String(canonical.net_commission))
      const overrideCents = toCents(String(canonical.override_amount))
      // gross = net + override (10% override structure in fixture)
      expect(netCents + overrideCents).toBe(grossCents)
    })
  })
})

describe('ZRD-D07: commission-statement-a.csv — split percentage', () => {
  it('each row net is 90% of gross (10% override split)', () => {
    const fmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'gradient_commission')!
    for (const row of rowsA) {
      const canonical = mapRowToCanonical(row, fmt)
      const grossCents = toCents(String(canonical.gross_commission))
      const netCents = toCents(String(canonical.net_commission))
      const splitPct = netCents / grossCents
      expect(splitPct).toBeCloseTo(0.9, 2)
    }
  })
})

// ---------------------------------------------------------------------------
// Statement B — Signal format
// ---------------------------------------------------------------------------

describe('ZRD-D07: commission-statement-b.csv — Signal format detection', () => {
  it('detects signal_commission format', () => {
    const fmt = detectCarrierFormat(headersB)
    expect(fmt).not.toBeNull()
    expect(fmt!.carrier_id).toBe('signal_commission')
    expect(fmt!.carrier_name).toBe('Signal (Commission Statement)')
    expect(fmt!.default_category).toBe('commission')
  })

  it('has 3 data rows', () => {
    expect(rowsB).toHaveLength(3)
  })
})

describe('ZRD-D07: commission-statement-b.csv — row-by-row canonical mapping', () => {
  const fmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'signal_commission')!

  it('row 1: Dorothy Chen POL-020001 maps correctly', () => {
    const canonical = mapRowToCanonical(rowsB[0], fmt)
    expect(canonical.carrier_id).toBe('signal_commission')
    expect(canonical.transaction_date).toBe('01/31/2026')
    expect(canonical.policy_number).toBe('POL-020001')
    // carrier_name is pre-populated from format definition (first-match-wins).
    // Row's 'Insurance Company' maps to carrier_name but is dropped (already set).
    expect(canonical.carrier_name).toBe('Signal (Commission Statement)')
    expect(canonical.product_type).toBe('FIA Gold')
    expect(canonical.client_name).toBe('Dorothy Chen')
    expect(canonical.agent_npn).toBe('12345678')
    expect(canonical.gross_commission).toBe('500.00')
    expect(canonical.net_commission).toBe('450.00')
    expect(canonical.override_amount).toBe('50.00')
    expect(canonical.commission_type).toBe('First Year')
    expect(canonical.premium_basis).toBe('40000.00')
  })

  it('row 2: Frank Wilson POL-020002 maps correctly', () => {
    const canonical = mapRowToCanonical(rowsB[1], fmt)
    expect(canonical.policy_number).toBe('POL-020002')
    // carrier_name comes from format definition (first-match-wins);
    // row's 'Insurance Company' is dropped as it maps to the already-set field.
    expect(canonical.carrier_name).toBe('Signal (Commission Statement)')
    expect(canonical.client_name).toBe('Frank Wilson')
    expect(canonical.agent_npn).toBe('87654321')
    expect(canonical.gross_commission).toBe('750.00')
    expect(canonical.net_commission).toBe('675.00')
    expect(canonical.override_amount).toBe('75.00')
    expect(canonical.commission_type).toBe('First Year')
  })

  it('row 3: Grace Kim POL-020003 Renewal maps correctly', () => {
    const canonical = mapRowToCanonical(rowsB[2], fmt)
    expect(canonical.policy_number).toBe('POL-020003')
    expect(canonical.commission_type).toBe('Renewal')
    expect(canonical.gross_commission).toBe('312.50')
    expect(canonical.net_commission).toBe('281.25')
    expect(canonical.override_amount).toBe('31.25')
  })
})

describe('ZRD-D07: commission-statement-b.csv — dollar amount accuracy (to the penny)', () => {
  const fmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'signal_commission')!

  it('gross commissions match to the penny', () => {
    const expectedGrossCents = [50000, 75000, 31250]
    rowsB.forEach((row, i) => {
      const canonical = mapRowToCanonical(row, fmt)
      const cents = toCents(String(canonical.gross_commission))
      expect(cents).toBe(expectedGrossCents[i])
    })
  })

  it('total gross commission sum matches source total', () => {
    // 500.00 + 750.00 + 312.50 = 1562.50
    const expectedTotalCents = 156250
    const actualTotalCents = rowsB.reduce((sum, row) => {
      const canonical = mapRowToCanonical(row, fmt)
      return sum + toCents(String(canonical.gross_commission))
    }, 0)
    expect(actualTotalCents).toBe(expectedTotalCents)
    expect(fromCents(actualTotalCents)).toBe('1562.50')
  })

  it('net + override = gross for each row', () => {
    rowsB.forEach((row) => {
      const canonical = mapRowToCanonical(row, fmt)
      const grossCents = toCents(String(canonical.gross_commission))
      const netCents = toCents(String(canonical.net_commission))
      const overrideCents = toCents(String(canonical.override_amount))
      expect(netCents + overrideCents).toBe(grossCents)
    })
  })

  it('each row net is 90% of gross', () => {
    for (const row of rowsB) {
      const canonical = mapRowToCanonical(row, fmt)
      const grossCents = toCents(String(canonical.gross_commission))
      const netCents = toCents(String(canonical.net_commission))
      const splitPct = netCents / grossCents
      expect(splitPct).toBeCloseTo(0.9, 2)
    }
  })
})

// ---------------------------------------------------------------------------
// Cross-format: no confusion between A and B
// ---------------------------------------------------------------------------

describe('ZRD-D07: format isolation — no cross-format misdetection', () => {
  it('statement-a headers do NOT match signal_commission', () => {
    const signalFmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'signal_commission')!
    // Score statement-a headers against signal signatures manually
    const aHeaderSet = new Set(headersA.map((h) => h.trim()))
    const signalSigs = signalFmt.header_signatures
    let matched = 0
    for (const sig of signalSigs) {
      if (aHeaderSet.has(sig)) matched++
    }
    const score = matched / signalSigs.length
    // Should be below the 60% threshold
    expect(score).toBeLessThan(0.6)
  })

  it('statement-b headers do NOT match gradient_commission', () => {
    const gradientFmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'gradient_commission')!
    const bHeaderSet = new Set(headersB.map((h) => h.trim()))
    const gradientSigs = gradientFmt.header_signatures
    let matched = 0
    for (const sig of gradientSigs) {
      if (bHeaderSet.has(sig)) matched++
    }
    const score = matched / gradientSigs.length
    expect(score).toBeLessThan(0.6)
  })
})

// ---------------------------------------------------------------------------
// toCents helper — no floating point drift
// ---------------------------------------------------------------------------

describe('ZRD-D07: toCents helper — floating point safety', () => {
  it('converts 1250.00 → 125000 cents exactly', () => {
    expect(toCents('1250.00')).toBe(125000)
  })

  it('converts 375.25 → 37525 cents exactly', () => {
    expect(toCents('375.25')).toBe(37525)
  })

  it('converts 312.50 → 31250 cents exactly', () => {
    expect(toCents('312.50')).toBe(31250)
  })

  it('converts 37.52 → 3752 cents exactly', () => {
    expect(toCents('37.52')).toBe(3752)
  })

  it('converts $2,500.00 (with currency formatting) → 250000 cents', () => {
    expect(toCents('$2,500.00')).toBe(250000)
  })

  it('sum of statement-a gross cents is integer (no drift)', () => {
    const fmt = CARRIER_FORMATS.find((f) => f.carrier_id === 'gradient_commission')!
    const totalCents = rowsA.reduce((sum, row) => {
      const canonical = mapRowToCanonical(row, fmt)
      return sum + toCents(String(canonical.gross_commission))
    }, 0)
    // Verify it is an integer
    expect(Number.isInteger(totalCents)).toBe(true)
    expect(totalCents).toBe(662650)
  })
})
