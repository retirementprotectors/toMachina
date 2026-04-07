/**
 * GENERATE_LIFE_CASEWORK — Super Tool (Life & Estate Wire Expansion, Track 2)
 *
 * Assembles all Life & Estate ANALYZE outputs into HTML casework.
 * Follows the same pattern as generate-casework.ts but scoped to
 * life_discovery | life_needs | life_options | life_presentation types.
 *
 * Runs AFTER all ANALYZE_LIFE_* super tools have produced their AnalysisResults.
 */

import type { AnalysisResult, SuperToolHousehold } from './types'
import { generateSummaryHtml } from '../generators/generate-summary-html'
import { generateDetailHtml } from '../generators/generate-detail-html'
import type { GeneratorInput } from '../generators/types'

export interface LifeCaseworkOutput {
  type: string
  summaryHtml: string
  detailHtml: string
}

export interface GenerateLifeCaseworkResult {
  success: boolean
  outputs: LifeCaseworkOutput[]
  totalOutputs: number
}

const LIFE_TYPES = new Set(['life_discovery', 'life_needs', 'life_options', 'life_presentation'])

export function generateLifeCasework(
  analyses: AnalysisResult[],
  household: SuperToolHousehold,
  preparedBy: string,
  preparedDate: string
): GenerateLifeCaseworkResult {
  const clientNames = household.members.map((m) => m.name).join(' & ')
  const outputs: LifeCaseworkOutput[] = []

  const lifeAnalyses = analyses.filter((a) => LIFE_TYPES.has(a.type))

  for (const analysis of lifeAnalyses) {
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
