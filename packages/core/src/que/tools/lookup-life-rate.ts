/**
 * lookup-life-rate
 * Premium lookup by product type, health class, age, and face amount.
 *
 * Source: Simplified rate table — actual quotes require carrier illustration
 */

import type { CalcResult } from './types'

export type LifeProductType = 'term-10' | 'term-20' | 'term-30' | 'ul' | 'iul' | 'whole-life' | 'gul'

export interface LifeRateQuery {
  productType: LifeProductType
  age: number
  gender: 'male' | 'female'
  rateClass: string
  faceAmount: number
}

export interface LifeRateResult {
  monthlyPremium: number
  annualPremium: number
  ratePerThousand: number
  productType: LifeProductType
  notes: string
}

// Simplified illustrative base rates per $1,000 at Preferred, age 45, male
// Real rates require carrier API / illustration — these are planning estimates only
const BASE_RATE_PER_1K: Record<LifeProductType, number> = {
  'term-10': 0.42,
  'term-20': 0.68,
  'term-30': 1.10,
  'ul': 1.80,
  'iul': 2.20,
  'whole-life': 4.50,
  'gul': 1.60,
}

const AGE_FACTOR: (age: number) => number = (age) => {
  if (age < 35) return 0.6
  if (age < 40) return 0.75
  if (age < 45) return 1.0
  if (age < 50) return 1.35
  if (age < 55) return 1.80
  if (age < 60) return 2.40
  if (age < 65) return 3.20
  return 4.50
}

const CLASS_FACTOR: Record<string, number> = {
  'Preferred Plus': 0.85,
  'Preferred': 1.0,
  'Standard Plus': 1.20,
  'Standard': 1.50,
  'Table 2': 2.0,
  'Table 4': 2.5,
  'Table 6': 3.0,
}

const GENDER_FACTOR: Record<string, number> = { male: 1.0, female: 0.82 }

export function lookupLifeRate(query: LifeRateQuery): LifeRateResult {
  const baseRate = BASE_RATE_PER_1K[query.productType] ?? 1.0
  const ageFactor = AGE_FACTOR(query.age)
  const classFactor = CLASS_FACTOR[query.rateClass] ?? 1.5
  const genderFactor = GENDER_FACTOR[query.gender] ?? 1.0

  const ratePerThousand = Math.round(baseRate * ageFactor * classFactor * genderFactor * 100) / 100
  const units = query.faceAmount / 1000
  const monthlyPremium = Math.round(ratePerThousand * units * 100) / 100
  const annualPremium = Math.round(monthlyPremium * 12 * 100) / 100

  return {
    monthlyPremium,
    annualPremium,
    ratePerThousand,
    productType: query.productType,
    notes: 'Illustrative estimate only — carrier illustration required for actual quote',
  }
}

export function lookupLifeRateResult(query: LifeRateQuery): CalcResult<LifeRateResult> {
  return { value: lookupLifeRate(query) }
}
