/**
 * lookup-irs-factor
 * Returns the IRS Uniform Lifetime Table distribution period for a given age.
 *
 * Formula: Table III lookup by age (72-120)
 * Source: IRS Publication 590-B
 *
 * @param age - Owner age as of Dec 31 of RMD year (72-120)
 * @returns Factor and age, or undefined if age is out of range
 */

import type { IrsFactorResult } from './types'
import { IRS_UNIFORM_LIFETIME_TABLE } from './data/irs-uniform-lifetime'

export function lookupIrsFactor(age: number): IrsFactorResult | undefined {
  const factor = IRS_UNIFORM_LIFETIME_TABLE[age]
  if (factor === undefined) return undefined
  return { age, factor }
}
