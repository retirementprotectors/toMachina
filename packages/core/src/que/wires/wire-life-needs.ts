/**
 * WIRE_LIFE_NEEDS (Life & Estate Track 3)
 * Trigger: Life insurance needs analysis requested
 * Sequence: ANALYZE_LIFE_NEED → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeLifeNeed } from '../super-tools/analyze-life-need'
import { generateCasework } from '../super-tools/generate-casework'

export function wireLifeNeeds(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeLifeNeed(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_LIFE_NEEDS',
    trigger: 'Life insurance needs analysis requested',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
