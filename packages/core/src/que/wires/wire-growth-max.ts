/**
 * WIRE_GROWTH_MAX (TRK-13396)
 * Trigger: VA bleeding fees or idle CDs
 * Sequence: ANALYZE_GROWTH → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeGrowth } from '../super-tools/analyze-growth'
import { generateCasework } from '../super-tools/generate-casework'

export function wireGrowthMax(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeGrowth(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_GROWTH_MAX',
    trigger: 'VA fee drag or idle CDs detected',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
