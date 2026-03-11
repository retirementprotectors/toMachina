/**
 * Financial calculation helpers.
 * Ported from CORE_Financial.gs _roundCurrency(), _normalizeRate(), _normalizeAmount().
 * Formulas ported EXACTLY from GAS source.
 */

/** Round to 2 decimal places (currency precision). */
export function roundCurrency(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) return 0
  return Math.round(value * 100) / 100
}

/**
 * Validate and normalize percentage (convert 15 to 0.15 if > 1).
 * Ported from CORE_Financial.gs _normalizeRate().
 */
export function normalizeRate(rate: number | null | undefined): number {
  if (rate === null || rate === undefined || isNaN(rate)) return 0
  // If rate > 1, assume it's a percentage (e.g., 15 means 15%)
  if (rate > 1) {
    return rate / 100
  }
  return Math.max(0, Math.min(1, rate)) // Clamp between 0 and 1
}

/**
 * Validate and normalize amount (ensure non-negative).
 * Ported from CORE_Financial.gs _normalizeAmount().
 */
export function normalizeAmount(amount: number | null | undefined): number {
  if (amount === null || amount === undefined || isNaN(amount)) return 0
  return Math.max(0, amount) // Ensure non-negative
}
