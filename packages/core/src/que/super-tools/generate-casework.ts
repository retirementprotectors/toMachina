/**
 * GENERATE_CASEWORK — Super Tool (TRK-13391)
 *
 * Calls generate-summary-html + generate-detail-html per applicable casework type.
 * Runs AFTER ANALYZE_* super tools have produced their AnalysisResults.
 *
 * Output: Summary HTML + Detail HTML per casework type
 */

import type { AnalysisResult, SuperToolHousehold } from './types'
import { generateSummaryHtml } from '../generators/generate-summary-html'
import { generateDetailHtml } from '../generators/generate-detail-html'
import type { GeneratorInput } from '../generators/types'

export interface CaseworkOutput {
  type: string
  summaryHtml: string
  detailHtml: string
}

export interface GenerateCaseworkResult {
  success: boolean
  outputs: CaseworkOutput[]
  totalOutputs: number
}

export function generateCasework(
  analyses: AnalysisResult[],
  household: SuperToolHousehold,
  preparedBy: string,
  preparedDate: string
): GenerateCaseworkResult {
  const clientNames = household.members.map((m) => m.name).join(' & ')
  const outputs: CaseworkOutput[] = []

  for (const analysis of analyses) {
    if (!analysis.applicable) continue

    const generatorInput: GeneratorInput = {
      analysis,
      household: {
        id: household.id,
        clientNames,
        filingStatus: household.filingStatus,
        state: household.state,
        members: household.members.map((m) => ({
          name: m.name,
          age: m.age,
        })),
      },
      preparedBy,
      preparedDate,
    }

    const summaryHtml = generateSummaryHtml(generatorInput)
    const detailHtml = generateDetailHtml(generatorInput)

    outputs.push({
      type: analysis.type,
      summaryHtml,
      detailHtml,
    })
  }

  return {
    success: true,
    outputs,
    totalOutputs: outputs.length,
  }
}
