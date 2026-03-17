/**
 * calc-ss-taxation
 * How much Social Security is taxable based on provisional income.
 *
 * Formula (MFJ thresholds):
 *   $0 - $32,000 provisional => 0% of SS taxable
 *   $32,001 - $44,000 => 50% of SS taxable
 *   $44,001+ => 85% of SS taxable
 *
 * Single thresholds: $25,000 / $34,000
 *
 * Source: PROV+FEDS+STATE sheet
 */

import type { CalcResult, CalcSsTaxationInput, CalcSsTaxationResult, FilingStatus } from './types'

interface SsTaxThresholds {
  lower: number
  upper: number
}

const SS_THRESHOLDS: Record<FilingStatus, SsTaxThresholds> = {
  mfj: { lower: 32_000, upper: 44_000 },
  single: { lower: 25_000, upper: 34_000 },
  mfs: { lower: 0, upper: 0 }, // MFS: 85% taxable for most filers
  hoh: { lower: 25_000, upper: 34_000 },
  widow: { lower: 25_000, upper: 34_000 },
}

export function calcSsTaxation(input: CalcSsTaxationInput): CalcResult<CalcSsTaxationResult> {
  const { ssBenefits, provisionalIncome, filingStatus = 'mfj' } = input
  const thresholds = SS_THRESHOLDS[filingStatus] || SS_THRESHOLDS.mfj

  let taxablePercent: number
  let tier: CalcSsTaxationResult['tier']

  if (filingStatus === 'mfs') {
    // MFS: almost always 85% taxable
    taxablePercent = 85
    tier = 'max'
  } else if (provisionalIncome <= thresholds.lower) {
    taxablePercent = 0
    tier = 'exempt'
  } else if (provisionalIncome <= thresholds.upper) {
    taxablePercent = 50
    tier = 'partial'
  } else {
    taxablePercent = 85
    tier = 'max'
  }

  const taxableAmount = Math.round(ssBenefits * (taxablePercent / 100) * 100) / 100

  return {
    value: { taxableAmount, taxablePercent, tier },
    breakdown: {
      ssBenefits,
      provisionalIncome,
      lowerThreshold: thresholds.lower,
      upperThreshold: thresholds.upper,
      taxablePercent,
      taxableAmount,
    },
  }
}
