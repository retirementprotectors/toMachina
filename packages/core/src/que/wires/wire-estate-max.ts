/**
 * WIRE_ESTATE_MAX (TRK-13395)
 * Trigger: Life policies approaching lapse
 * Sequence: ANALYZE_ESTATE → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeEstate } from '../super-tools/analyze-estate'
import { generateCasework } from '../super-tools/generate-casework'

export function wireEstateMax(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeEstate(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_ESTATE_MAX',
    trigger: 'Life policies approaching lapse',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
