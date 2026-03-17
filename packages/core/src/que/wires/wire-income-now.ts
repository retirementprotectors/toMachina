/**
 * WIRE_INCOME_NOW (TRK-13393)
 * Trigger: Dormant income riders detected
 * Sequence: ANALYZE_INCOME_NOW → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeIncomeNow } from '../super-tools/analyze-income-now'
import { generateCasework } from '../super-tools/generate-casework'

export function wireIncomeNow(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeIncomeNow(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_INCOME_NOW',
    trigger: 'Dormant income riders detected',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
