/**
 * Net Present Value and Internal Rate of Return calculations.
 * Ported from CORE_Financial.gs calculateNPV(), calculateIRR().
 * Formulas ported EXACTLY from GAS source.
 */

import { roundCurrency, normalizeRate } from './helpers'

/**
 * Calculate Net Present Value (NPV).
 * Ported from CORE_Financial.gs calculateNPV().
 *
 * Cash flows can include initial investment as negative value.
 * NPV preserves negative values (does NOT use normalizeAmount).
 */
export function calculateNPV(cashflows: number[], discountRate: number): number {
  if (!cashflows || !Array.isArray(cashflows) || cashflows.length === 0) {
    return 0
  }

  const rate = normalizeRate(discountRate || 0)

  let npv = 0
  cashflows.forEach((cf, period) => {
    // Don't use normalizeAmount -- NPV needs negative values (initial investment)
    const amount = (cf === null || cf === undefined || isNaN(cf)) ? 0 : Number(cf)
    npv += amount / Math.pow(1 + rate, period)
  })

  return roundCurrency(npv)
}

/**
 * Calculate Internal Rate of Return (IRR).
 * Uses Newton-Raphson method for approximation.
 * Ported from CORE_Financial.gs calculateIRR().
 *
 * Returns IRR as decimal (e.g., 0.15 for 15%) or NaN if cannot converge.
 */
export function calculateIRR(
  cashflows: number[],
  initialGuess = 0.1,
  maxIterations = 100
): number {
  if (!cashflows || !Array.isArray(cashflows) || cashflows.length < 2) {
    return NaN
  }

  // Normalize -- first cashflow should be negative (investment)
  const normalizedCFs = cashflows.map(cf => {
    if (cf === null || cf === undefined || isNaN(cf)) return 0
    return Math.max(0, cf)
  })

  // If first is positive, make it negative (initial investment)
  if (normalizedCFs[0] > 0) {
    normalizedCFs[0] = -normalizedCFs[0]
  }

  let rate = initialGuess || 0.1
  const maxIter = maxIterations || 100
  const tolerance = 0.0001

  for (let i = 0; i < maxIter; i++) {
    let npv = 0
    let npvDerivative = 0

    normalizedCFs.forEach((cf, period) => {
      const denominator = Math.pow(1 + rate, period)
      npv += cf / denominator
      if (period > 0) {
        npvDerivative -= (period * cf) / (denominator * (1 + rate))
      }
    })

    if (Math.abs(npv) < tolerance) {
      return roundCurrency(rate)
    }

    if (Math.abs(npvDerivative) < tolerance) {
      return NaN // Cannot converge
    }

    rate = rate - npv / npvDerivative

    // Prevent negative rates or rates > 1000%
    rate = Math.max(-0.99, Math.min(10, rate))
  }

  return NaN // Did not converge
}
