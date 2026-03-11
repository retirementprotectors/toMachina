/**
 * Single Premium Hybrid (SPH) projection calculator.
 * Projects benefit values over time for hybrid life/LTC policies
 * funded with a single premium.
 *
 * Ported from DAVID-HUB SPH calculator logic.
 */

import { roundCurrency, normalizeRate, normalizeAmount } from './helpers'

export interface SphInput {
  singlePremium: number
  interestRate: number
  benefitPeriod: number
  inflationRate: number
}

export interface SphYearProjection {
  year: number
  accountValue: number
  deathBenefit: number
  ltcBenefit: number
  surrenderValue: number
}

export interface SphResult {
  projections: SphYearProjection[]
  breakEvenYear: number | null
  totalLtcBenefit: number
  peakDeathBenefit: number
  summary: string
}

/**
 * Project SPH benefit values over the benefit period.
 * Models account value growth, death benefit leverage, and LTC benefit pool.
 */
export function calculateSph(input: SphInput): SphResult {
  const premium = normalizeAmount(input.singlePremium)
  const interestRate = normalizeRate(input.interestRate || 0.03)
  const benefitPeriod = Math.max(1, Math.min(30, Math.floor(input.benefitPeriod || 10)))
  const inflationRate = normalizeRate(input.inflationRate || 0.02)

  const projections: SphYearProjection[] = []
  let breakEvenYear: number | null = null
  let peakDeathBenefit = 0

  // Typical SPH leverage: death benefit ~2-3x premium, LTC ~3-4x premium
  const deathBenefitMultiple = 2.5
  const ltcMultiple = 3.5
  // Surrender charge schedule: starts at ~10% year 1, declining to 0 by year 10
  const surrenderSchedule = [0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01]

  for (let year = 1; year <= benefitPeriod; year++) {
    // Account value grows at the credited interest rate
    const accountValue = roundCurrency(premium * Math.pow(1 + interestRate, year))

    // Death benefit: leveraged amount adjusted for inflation
    const deathBenefit = roundCurrency(
      premium * deathBenefitMultiple * Math.pow(1 + inflationRate, year - 1)
    )
    if (deathBenefit > peakDeathBenefit) peakDeathBenefit = deathBenefit

    // LTC benefit pool: leveraged and grows with inflation protection
    const ltcBenefit = roundCurrency(
      premium * ltcMultiple * Math.pow(1 + inflationRate, year - 1)
    )

    // Surrender value: account value minus surrender charge
    const chargeIndex = Math.min(year - 1, surrenderSchedule.length - 1)
    const surrenderCharge = year <= surrenderSchedule.length ? surrenderSchedule[chargeIndex] : 0
    const surrenderValue = roundCurrency(accountValue * (1 - surrenderCharge))

    // Break-even: first year where surrender value >= premium
    if (breakEvenYear === null && surrenderValue >= premium) {
      breakEvenYear = year
    }

    projections.push({
      year,
      accountValue,
      deathBenefit,
      ltcBenefit,
      surrenderValue,
    })
  }

  const lastProjection = projections[projections.length - 1]
  const totalLtcBenefit = lastProjection?.ltcBenefit || 0

  const breakEvenText = breakEvenYear
    ? `Break-even at year ${breakEvenYear}.`
    : 'Surrender value does not exceed premium within the projection period.'

  const summary = `$${premium.toLocaleString()} single premium generates up to $${totalLtcBenefit.toLocaleString()} in LTC benefits and $${peakDeathBenefit.toLocaleString()} death benefit. ${breakEvenText}`

  return {
    projections,
    breakEvenYear,
    totalLtcBenefit,
    peakDeathBenefit,
    summary,
  }
}
