/** calc-existing-coverage-offset — Total existing life coverage */
import type { CalcResult, CalcExistingCoverageOffsetInput, CalcExistingCoverageOffsetResult } from './types'

export function calcExistingCoverageOffset(input: CalcExistingCoverageOffsetInput): CalcResult<CalcExistingCoverageOffsetResult> {
  const { groupLife = 0, individualPolicies = 0, savingsAssets = 0, otherAssets = 0 } = input
  const totalOffset = groupLife + individualPolicies + savingsAssets + otherAssets
  return {
    value: { totalOffset },
    breakdown: { groupLife, individualPolicies, savingsAssets, otherAssets, totalOffset },
  }
}
