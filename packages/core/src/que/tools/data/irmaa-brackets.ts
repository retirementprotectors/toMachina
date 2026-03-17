/**
 * IRMAA (Income-Related Monthly Adjustment Amount) Brackets
 * Medicare Part B + Part D surcharges based on MAGI (2-year lookback)
 *
 * Source: CMS Medicare premiums announcements
 * Includes both 2024 and 2025 brackets for the 2-year lookback window.
 */

import type { IrmaaBracket, FilingStatus } from '../types'

// ---------------------------------------------------------------------------
// 2024 IRMAA Brackets (based on 2022 MAGI)
// ---------------------------------------------------------------------------

export const IRMAA_BRACKETS_2024: Record<FilingStatus, IrmaaBracket[]> = {
  mfj: [
    { magiMin: 0, magiMax: 206_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 206_000, magiMax: 258_000, partBMonthly: 69.90, partDMonthly: 12.90, tier: 'Tier 1' },
    { magiMin: 258_000, magiMax: 322_000, partBMonthly: 174.70, partDMonthly: 33.30, tier: 'Tier 2' },
    { magiMin: 322_000, magiMax: 386_000, partBMonthly: 279.50, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 386_000, magiMax: 750_000, partBMonthly: 384.30, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 750_000, magiMax: Infinity, partBMonthly: 419.30, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  single: [
    { magiMin: 0, magiMax: 103_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 103_000, magiMax: 129_000, partBMonthly: 69.90, partDMonthly: 12.90, tier: 'Tier 1' },
    { magiMin: 129_000, magiMax: 161_000, partBMonthly: 174.70, partDMonthly: 33.30, tier: 'Tier 2' },
    { magiMin: 161_000, magiMax: 193_000, partBMonthly: 279.50, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 193_000, magiMax: 500_000, partBMonthly: 384.30, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 500_000, magiMax: Infinity, partBMonthly: 419.30, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  mfs: [
    { magiMin: 0, magiMax: 103_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 103_000, magiMax: 397_000, partBMonthly: 384.30, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 397_000, magiMax: Infinity, partBMonthly: 419.30, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  hoh: [
    { magiMin: 0, magiMax: 103_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 103_000, magiMax: 129_000, partBMonthly: 69.90, partDMonthly: 12.90, tier: 'Tier 1' },
    { magiMin: 129_000, magiMax: 161_000, partBMonthly: 174.70, partDMonthly: 33.30, tier: 'Tier 2' },
    { magiMin: 161_000, magiMax: 193_000, partBMonthly: 279.50, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 193_000, magiMax: 500_000, partBMonthly: 384.30, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 500_000, magiMax: Infinity, partBMonthly: 419.30, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  widow: [
    { magiMin: 0, magiMax: 103_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 103_000, magiMax: 129_000, partBMonthly: 69.90, partDMonthly: 12.90, tier: 'Tier 1' },
    { magiMin: 129_000, magiMax: 161_000, partBMonthly: 174.70, partDMonthly: 33.30, tier: 'Tier 2' },
    { magiMin: 161_000, magiMax: 193_000, partBMonthly: 279.50, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 193_000, magiMax: 500_000, partBMonthly: 384.30, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 500_000, magiMax: Infinity, partBMonthly: 419.30, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
}

// ---------------------------------------------------------------------------
// 2025 IRMAA Brackets (based on 2023 MAGI)
// ---------------------------------------------------------------------------

export const IRMAA_BRACKETS_2025: Record<FilingStatus, IrmaaBracket[]> = {
  mfj: [
    { magiMin: 0, magiMax: 212_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 212_000, magiMax: 265_000, partBMonthly: 70.00, partDMonthly: 13.00, tier: 'Tier 1' },
    { magiMin: 265_000, magiMax: 332_000, partBMonthly: 175.00, partDMonthly: 33.40, tier: 'Tier 2' },
    { magiMin: 332_000, magiMax: 398_000, partBMonthly: 280.00, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 398_000, magiMax: 750_000, partBMonthly: 384.90, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 750_000, magiMax: Infinity, partBMonthly: 419.90, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  single: [
    { magiMin: 0, magiMax: 106_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 106_000, magiMax: 133_000, partBMonthly: 70.00, partDMonthly: 13.00, tier: 'Tier 1' },
    { magiMin: 133_000, magiMax: 167_000, partBMonthly: 175.00, partDMonthly: 33.40, tier: 'Tier 2' },
    { magiMin: 167_000, magiMax: 200_000, partBMonthly: 280.00, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 200_000, magiMax: 500_000, partBMonthly: 384.90, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 500_000, magiMax: Infinity, partBMonthly: 419.90, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  mfs: [
    { magiMin: 0, magiMax: 106_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 106_000, magiMax: 397_000, partBMonthly: 384.90, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 397_000, magiMax: Infinity, partBMonthly: 419.90, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  hoh: [
    { magiMin: 0, magiMax: 106_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 106_000, magiMax: 133_000, partBMonthly: 70.00, partDMonthly: 13.00, tier: 'Tier 1' },
    { magiMin: 133_000, magiMax: 167_000, partBMonthly: 175.00, partDMonthly: 33.40, tier: 'Tier 2' },
    { magiMin: 167_000, magiMax: 200_000, partBMonthly: 280.00, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 200_000, magiMax: 500_000, partBMonthly: 384.90, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 500_000, magiMax: Infinity, partBMonthly: 419.90, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
  widow: [
    { magiMin: 0, magiMax: 106_000, partBMonthly: 0, partDMonthly: 0, tier: 'Standard' },
    { magiMin: 106_000, magiMax: 133_000, partBMonthly: 70.00, partDMonthly: 13.00, tier: 'Tier 1' },
    { magiMin: 133_000, magiMax: 167_000, partBMonthly: 175.00, partDMonthly: 33.40, tier: 'Tier 2' },
    { magiMin: 167_000, magiMax: 200_000, partBMonthly: 280.00, partDMonthly: 53.80, tier: 'Tier 3' },
    { magiMin: 200_000, magiMax: 500_000, partBMonthly: 384.90, partDMonthly: 74.20, tier: 'Tier 4' },
    { magiMin: 500_000, magiMax: Infinity, partBMonthly: 419.90, partDMonthly: 81.00, tier: 'Tier 5' },
  ],
}

/**
 * Get IRMAA brackets for a given year and filing status.
 */
export function getIrmaaBrackets(taxYear: number, filingStatus: FilingStatus): IrmaaBracket[] {
  const brackets = taxYear >= 2025 ? IRMAA_BRACKETS_2025 : IRMAA_BRACKETS_2024
  return brackets[filingStatus] || brackets.mfj
}
