/**
 * WIRE_ROTH_CONVERSION (TRK-13398)
 * Trigger: Large traditional IRA balances
 * Sequence: ANALYZE_ROTH → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeRoth } from '../super-tools/analyze-roth'
import { generateCasework } from '../super-tools/generate-casework'

export function wireRothConversion(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeRoth(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_ROTH_CONVERSION',
    trigger: 'Large traditional IRA balances',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
