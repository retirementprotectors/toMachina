/**
 * WIRE_INCOME_LATER (TRK-13394)
 * Trigger: Rollup opportunity detected
 * Sequence: ANALYZE_INCOME_LATER → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeIncomeLater } from '../super-tools/analyze-income-later'
import { generateCasework } from '../super-tools/generate-casework'

export function wireIncomeLater(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeIncomeLater(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_INCOME_LATER',
    trigger: 'Rollup opportunity detected',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
