/**
 * WIRE_LTC_MAX (TRK-13397)
 * Trigger: Multi-contract LTC portfolio
 * Sequence: ANALYZE_LTC → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeLtc } from '../super-tools/analyze-ltc'
import { generateCasework } from '../super-tools/generate-casework'

export function wireLtcMax(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeLtc(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_LTC_MAX',
    trigger: 'Multi-contract LTC portfolio detected',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
