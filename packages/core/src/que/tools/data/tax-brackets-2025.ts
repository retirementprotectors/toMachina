/**
 * 2025 Federal Tax Brackets + Standard Deductions
 * Source: IRS Revenue Procedure 2024-40
 *
 * State tax rates are simplified flat/effective rates for QUE casework.
 * Iowa: 0% on retirement income distributions (IRA, pension, annuity, SS).
 */

import type { TaxBracket, FilingStatus } from '../types'

/**
 * Config Registry key: 'tax_brackets'
 * Firestore collection: config_registry
 * Type: year_table | Category: financial
 *
 * Server-side usage:
 *   import { getConfig } from '../lib/config-helper.js'
 *   const config = await getConfig('tax_brackets', DEFAULT_TAX_BRACKETS_CONFIG)
 */
export const CONFIG_KEY_TAX_BRACKETS = 'tax_brackets'

// ---------------------------------------------------------------------------
// 2025 Standard Deductions
// ---------------------------------------------------------------------------

export const STANDARD_DEDUCTIONS_2025: Record<FilingStatus, number> = {
  single: 15_000,
  mfj: 30_000,
  mfs: 15_000,
  hoh: 22_500,
  widow: 30_000,
}

// ---------------------------------------------------------------------------
// 2025 Federal Tax Brackets (MFJ)
// ---------------------------------------------------------------------------

export const FEDERAL_BRACKETS_2025: Record<FilingStatus, TaxBracket[]> = {
  mfj: [
    { min: 0, max: 23_850, rate: 0.10 },
    { min: 23_850, max: 96_950, rate: 0.12 },
    { min: 96_950, max: 206_700, rate: 0.22 },
    { min: 206_700, max: 394_600, rate: 0.24 },
    { min: 394_600, max: 501_050, rate: 0.32 },
    { min: 501_050, max: 751_600, rate: 0.35 },
    { min: 751_600, max: Infinity, rate: 0.37 },
  ],
  single: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
  mfs: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 375_800, rate: 0.35 },
    { min: 375_800, max: Infinity, rate: 0.37 },
  ],
  hoh: [
    { min: 0, max: 17_000, rate: 0.10 },
    { min: 17_000, max: 64_850, rate: 0.12 },
    { min: 64_850, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_500, rate: 0.32 },
    { min: 250_500, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
  widow: [
    { min: 0, max: 23_850, rate: 0.10 },
    { min: 23_850, max: 96_950, rate: 0.12 },
    { min: 96_950, max: 206_700, rate: 0.22 },
    { min: 206_700, max: 394_600, rate: 0.24 },
    { min: 394_600, max: 501_050, rate: 0.32 },
    { min: 501_050, max: 751_600, rate: 0.35 },
    { min: 751_600, max: Infinity, rate: 0.37 },
  ],
}

// ---------------------------------------------------------------------------
// State Income Tax Rates (simplified flat/effective)
// ---------------------------------------------------------------------------

/**
 * State income tax rates.
 * These are simplified effective rates for casework estimates.
 *
 * CRITICAL: Iowa (IA) = 0% on retirement income distributions
 * (IRA, pension, annuity, Social Security). Iowa's actual income
 * tax rate on non-retirement income is ~5.7% flat.
 *
 * States with 0% income tax: AK, FL, NV, NH, SD, TN, TX, WA, WY
 * (NH and TN only tax interest/dividends historically, now 0%)
 */
export const STATE_TAX_RATES: Record<string, { rate: number; retirementExempt: boolean; name: string }> = {
  AL: { rate: 0.050, retirementExempt: false, name: 'Alabama' },
  AK: { rate: 0.000, retirementExempt: false, name: 'Alaska' },
  AZ: { rate: 0.025, retirementExempt: false, name: 'Arizona' },
  AR: { rate: 0.044, retirementExempt: false, name: 'Arkansas' },
  CA: { rate: 0.093, retirementExempt: false, name: 'California' },
  CO: { rate: 0.044, retirementExempt: false, name: 'Colorado' },
  CT: { rate: 0.050, retirementExempt: false, name: 'Connecticut' },
  DE: { rate: 0.066, retirementExempt: false, name: 'Delaware' },
  FL: { rate: 0.000, retirementExempt: false, name: 'Florida' },
  GA: { rate: 0.055, retirementExempt: false, name: 'Georgia' },
  HI: { rate: 0.090, retirementExempt: false, name: 'Hawaii' },
  ID: { rate: 0.058, retirementExempt: false, name: 'Idaho' },
  IL: { rate: 0.0495, retirementExempt: true, name: 'Illinois' },
  IN: { rate: 0.0305, retirementExempt: false, name: 'Indiana' },
  IA: { rate: 0.057, retirementExempt: true, name: 'Iowa' },
  KS: { rate: 0.057, retirementExempt: false, name: 'Kansas' },
  KY: { rate: 0.040, retirementExempt: false, name: 'Kentucky' },
  LA: { rate: 0.0425, retirementExempt: false, name: 'Louisiana' },
  ME: { rate: 0.0715, retirementExempt: false, name: 'Maine' },
  MD: { rate: 0.0575, retirementExempt: false, name: 'Maryland' },
  MA: { rate: 0.050, retirementExempt: false, name: 'Massachusetts' },
  MI: { rate: 0.0425, retirementExempt: false, name: 'Michigan' },
  MN: { rate: 0.0785, retirementExempt: false, name: 'Minnesota' },
  MS: { rate: 0.047, retirementExempt: true, name: 'Mississippi' },
  MO: { rate: 0.048, retirementExempt: false, name: 'Missouri' },
  MT: { rate: 0.059, retirementExempt: false, name: 'Montana' },
  NE: { rate: 0.0584, retirementExempt: false, name: 'Nebraska' },
  NV: { rate: 0.000, retirementExempt: false, name: 'Nevada' },
  NH: { rate: 0.000, retirementExempt: false, name: 'New Hampshire' },
  NJ: { rate: 0.0637, retirementExempt: false, name: 'New Jersey' },
  NM: { rate: 0.049, retirementExempt: false, name: 'New Mexico' },
  NY: { rate: 0.0685, retirementExempt: false, name: 'New York' },
  NC: { rate: 0.045, retirementExempt: false, name: 'North Carolina' },
  ND: { rate: 0.0195, retirementExempt: false, name: 'North Dakota' },
  OH: { rate: 0.035, retirementExempt: false, name: 'Ohio' },
  OK: { rate: 0.0475, retirementExempt: false, name: 'Oklahoma' },
  OR: { rate: 0.088, retirementExempt: false, name: 'Oregon' },
  PA: { rate: 0.0307, retirementExempt: true, name: 'Pennsylvania' },
  RI: { rate: 0.0599, retirementExempt: false, name: 'Rhode Island' },
  SC: { rate: 0.064, retirementExempt: false, name: 'South Carolina' },
  SD: { rate: 0.000, retirementExempt: false, name: 'South Dakota' },
  TN: { rate: 0.000, retirementExempt: false, name: 'Tennessee' },
  TX: { rate: 0.000, retirementExempt: false, name: 'Texas' },
  UT: { rate: 0.0465, retirementExempt: false, name: 'Utah' },
  VT: { rate: 0.0675, retirementExempt: false, name: 'Vermont' },
  VA: { rate: 0.0575, retirementExempt: false, name: 'Virginia' },
  WA: { rate: 0.000, retirementExempt: false, name: 'Washington' },
  WV: { rate: 0.0512, retirementExempt: false, name: 'West Virginia' },
  WI: { rate: 0.0530, retirementExempt: false, name: 'Wisconsin' },
  WY: { rate: 0.000, retirementExempt: false, name: 'Wyoming' },
  DC: { rate: 0.085, retirementExempt: false, name: 'District of Columbia' },
}

// ---------------------------------------------------------------------------
// Default config_registry doc shape (for getConfig fallback + seed script)
// ---------------------------------------------------------------------------

/** Converts bracket max Infinity → null for Firestore/JSON storage. */
function firestoreBrackets(brackets: TaxBracket[]): Array<{ min: number; max: number | null; rate: number }> {
  return brackets.map(b => ({ min: b.min, max: b.max === Infinity ? null : b.max, rate: b.rate }))
}

function firestoreBracketsByStatus(byStatus: Record<FilingStatus, TaxBracket[]>) {
  return Object.fromEntries(
    Object.entries(byStatus).map(([status, brackets]) => [status, firestoreBrackets(brackets)]),
  )
}

/**
 * Default Firestore doc shape for `config_registry/tax_brackets`.
 * Use as the `fallback` param for `getConfig('tax_brackets', DEFAULT_TAX_BRACKETS_CONFIG)`.
 */
export const DEFAULT_TAX_BRACKETS_CONFIG = {
  years: {
    '2025': {
      brackets: firestoreBracketsByStatus(FEDERAL_BRACKETS_2025),
      standard_deduction: STANDARD_DEDUCTIONS_2025,
    },
  },
  state_tax_rates: STATE_TAX_RATES,
  type: 'year_table' as const,
  category: 'financial' as const,
}
