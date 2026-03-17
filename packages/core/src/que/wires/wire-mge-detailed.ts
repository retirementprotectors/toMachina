/**
 * WIRE_MGE_DETAILED (TRK-13400)
 * Trigger: Full review / discovery meeting
 * Sequence: ANALYZE_MGE → GENERATE_CASEWORK (for all applicable types)
 */

import type { WireInput } from './types'
import type { CaseworkOutput, GenerateCaseworkResult } from '../super-tools/generate-casework'
import type { MgeAnalysisOutput } from '../super-tools/types'
import { analyzeMge } from '../super-tools/analyze-mge'
import { generateCasework } from '../super-tools/generate-casework'

export interface MgeDetailedWireResult {
  success: boolean
  wire: 'WIRE_MGE_DETAILED'
  trigger: string
  mgeAnalysis: MgeAnalysisOutput
  casework: GenerateCaseworkResult
}

export function wireMgeDetailed(input: WireInput): MgeDetailedWireResult {
  const { household, preparedBy, preparedDate } = input

  const mgeAnalysis = analyzeMge(household)
  const casework = generateCasework(mgeAnalysis.analyses, household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_MGE_DETAILED',
    trigger: 'Full review / discovery meeting',
    mgeAnalysis,
    casework,
  }
}
