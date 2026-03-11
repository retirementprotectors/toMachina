/**
 * Modified Endowment Contract (MEC) calculator.
 * A life insurance policy becomes a MEC if cumulative premiums exceed the
 * 7-pay test limit at any point during the first 7 policy years.
 *
 * Ported from DAVID-HUB calculator logic.
 */

import { roundCurrency, normalizeAmount } from './helpers'

export interface MecInput {
  premiumPaid: number
  faceAmount: number
  policyYear: number
  sevenPayLimit: number
}

export interface MecResult {
  isMec: boolean
  cumulativePremium: number
  sevenPayLimit: number
  remainingRoom: number
  percentUsed: number
  policyYear: number
  guidance: string
}

/**
 * Evaluate whether a policy is a Modified Endowment Contract.
 * Compares cumulative premiums paid against the 7-pay test limit.
 */
export function calculateMec(input: MecInput): MecResult {
  const premiumPaid = normalizeAmount(input.premiumPaid)
  const faceAmount = normalizeAmount(input.faceAmount)
  const policyYear = Math.max(1, Math.min(7, Math.floor(input.policyYear || 1)))
  const sevenPayLimit = normalizeAmount(input.sevenPayLimit)

  const cumulativeLimit = roundCurrency(sevenPayLimit * policyYear)
  const remainingRoom = roundCurrency(Math.max(0, cumulativeLimit - premiumPaid))
  const percentUsed = cumulativeLimit > 0 ? Math.min(100, Math.round((premiumPaid / cumulativeLimit) * 100)) : 0
  const isMec = premiumPaid > cumulativeLimit

  let guidance: string
  if (isMec) {
    const excess = roundCurrency(premiumPaid - cumulativeLimit)
    guidance = `Policy IS a MEC. Cumulative premiums exceed the 7-pay limit by $${excess.toLocaleString()}. Distributions will be taxed LIFO (gains first) and may incur a 10% penalty if under age 59.5.`
  } else if (percentUsed >= 90) {
    guidance = `Policy is NOT a MEC but is within ${100 - percentUsed}% of the limit. Exercise caution with additional premium payments to avoid MEC status.`
  } else if (percentUsed >= 70) {
    guidance = `Policy is NOT a MEC. $${remainingRoom.toLocaleString()} of room remains under the 7-pay limit through year ${policyYear}.`
  } else {
    guidance = `Policy is NOT a MEC. Significant room remains ($${remainingRoom.toLocaleString()}) under the 7-pay limit. Policy is well within safe funding levels.`
  }

  return {
    isMec,
    cumulativePremium: premiumPaid,
    sevenPayLimit: cumulativeLimit,
    remainingRoom,
    percentUsed,
    policyYear,
    guidance,
  }
}
