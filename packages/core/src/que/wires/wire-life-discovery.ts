/**
 * WIRE_LIFE_DISCOVERY (Life & Estate Track 3)
 * Trigger: Group coverage gap detected
 * Sequence: ANALYZE_GROUP_GAP → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeGroupGap } from '../super-tools/analyze-group-gap'
import { generateCasework } from '../super-tools/generate-casework'

export function wireLifeDiscovery(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeGroupGap(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_LIFE_DISCOVERY',
    trigger: 'Group coverage gap detected',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
