/**
 * WIRE_ASSEMBLE_B4 (TRK-13402)
 * Trigger: All casework wires complete — package and file
 * Sequence: ASSEMBLE_OUTPUT (collects all outputs into B4 package)
 */

import type { WireInput, AssembleB4WireResult } from './types'
import type { CaseworkOutput } from '../super-tools/generate-casework'
import type { AnalysisResult } from '../super-tools/types'
import { assembleOutput } from '../super-tools/assemble-output'

export interface AssembleB4Input extends WireInput {
  analyses: AnalysisResult[]
  caseworkOutputs: CaseworkOutput[]
  authForms?: Array<'life' | 'wealth' | 'its'>
}

export function wireAssembleB4(input: AssembleB4Input): AssembleB4WireResult {
  const { household, preparedBy, preparedDate, analyses, caseworkOutputs, authForms } = input

  const result = assembleOutput(
    household,
    analyses,
    caseworkOutputs,
    preparedBy,
    preparedDate,
    authForms
  )

  return {
    success: true,
    wire: 'WIRE_ASSEMBLE_B4',
    documents: result.documents,
    summary: result.summary,
    notes: [
      `Assembled ${result.summary.totalDocuments} documents for ${result.clientNames}`,
      `Casework components: ${result.summary.output4_casework}`,
      'Ready for DEX: html-to-pdf → file-to-acf',
    ],
  }
}
