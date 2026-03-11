/**
 * Commission calculations -- FYC, renewal, override.
 * Ported from CORE_Financial.gs calculateFYC(), calculateRenewal(), calculateOverride().
 * Formulas ported EXACTLY from GAS source.
 */

import { roundCurrency, normalizeRate, normalizeAmount } from './helpers'

/**
 * Calculate First Year Commission (FYC).
 * Ported from CORE_Financial.gs calculateFYC().
 */
export function calculateFYC(amount: number, rate: number): number {
  return roundCurrency(normalizeAmount(amount) * normalizeRate(rate))
}

/**
 * Calculate renewal commission.
 * Ported from CORE_Financial.gs calculateRenewal().
 * Year parameter reserved for future year-specific rate schedules.
 */
export function calculateRenewal(amount: number, rate: number, year?: number): number {
  const validAmount = normalizeAmount(amount)
  const validRate = normalizeRate(rate)
  const _year = Math.max(1, Math.floor(year || 1))
  void _year // Reserved for year-specific rates
  return roundCurrency(validAmount * validRate)
}

/**
 * Calculate override commission.
 * Ported from CORE_Financial.gs calculateOverride().
 */
export function calculateOverride(amount: number, rate: number): number {
  return roundCurrency(normalizeAmount(amount) * normalizeRate(rate))
}
