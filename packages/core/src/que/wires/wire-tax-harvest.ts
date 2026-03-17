/**
 * WIRE_TAX_HARVEST (TRK-13399)
 * Trigger: NQ liquidation needed
 * Sequence: ANALYZE_TAX_HARVEST → GENERATE_CASEWORK
 */

import type { WireInput, WireResult } from './types'
import { analyzeTaxHarvest } from '../super-tools/analyze-tax-harvest'
import { generateCasework } from '../super-tools/generate-casework'

export function wireTaxHarvest(input: WireInput): WireResult {
  const { household, preparedBy, preparedDate } = input

  const analysis = analyzeTaxHarvest(household)
  const caseworkResult = generateCasework([analysis.result], household, preparedBy, preparedDate)

  return {
    success: true,
    wire: 'WIRE_TAX_HARVEST',
    trigger: 'NQ liquidation needed',
    analysis: analysis.result,
    casework: caseworkResult.outputs[0],
  }
}
