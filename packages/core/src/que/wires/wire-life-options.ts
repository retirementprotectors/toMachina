/**
 * WIRE_LIFE_OPTIONS (Life & Estate Track 3)
 * Trigger: Underwriting + product options requested
 * Sequence: ANALYZE_UNDERWRITING_PATH + ANALYZE_LIFE_OPTIONS → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeUnderwritingPath } from '../super-tools/analyze-underwriting-path'
import { analyzeLifeOptions } from '../super-tools/analyze-life-options'
import { generateCasework } from '../super-tools/generate-casework'

export function wireLifeOptions(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const underwritingAnalysis = analyzeUnderwritingPath(household)
  const optionsAnalysis = analyzeLifeOptions(household)
  const caseworkResult = generateCasework(
    [underwritingAnalysis.result, optionsAnalysis.result],
    household,
    preparedBy,
    preparedDate
  )

  return {
    success: true,
    wire: 'WIRE_LIFE_OPTIONS',
    trigger: 'Underwriting + product options requested',
    analysis: optionsAnalysis.result,
    casework: caseworkResult.outputs[0],
  }
}
