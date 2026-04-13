/**
 * WIRE_LIFE_PRESENTATION (Life & Estate Track 3)
 * Trigger: Complete life insurance presentation requested
 * Sequence: ANALYZE_GROUP_GAP + ANALYZE_LIFE_NEED + ANALYZE_UNDERWRITING_PATH + ANALYZE_LIFE_OPTIONS → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeGroupGap } from '../super-tools/analyze-group-gap'
import { analyzeLifeNeed } from '../super-tools/analyze-life-need'
import { analyzeUnderwritingPath } from '../super-tools/analyze-underwriting-path'
import { analyzeLifeOptions } from '../super-tools/analyze-life-options'
import { generateCasework } from '../super-tools/generate-casework'

export function wireLifePresentation(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const groupGapAnalysis = analyzeGroupGap(household)
  const lifeNeedAnalysis = analyzeLifeNeed(household)
  const underwritingAnalysis = analyzeUnderwritingPath(household)
  const optionsAnalysis = analyzeLifeOptions(household)

  const caseworkResult = generateCasework(
    [
      groupGapAnalysis.result,
      lifeNeedAnalysis.result,
      underwritingAnalysis.result,
      optionsAnalysis.result,
    ],
    household,
    preparedBy,
    preparedDate
  )

  return {
    success: true,
    wire: 'WIRE_LIFE_PRESENTATION',
    trigger: 'Complete life insurance presentation requested',
    analysis: lifeNeedAnalysis.result,
    casework: caseworkResult.outputs[0],
  }
}
