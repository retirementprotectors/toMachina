/**
 * generate-summary-html (TRK-13378)
 *
 * Dispatches to the type-specific Summary template based on the analysis type.
 * Pure function: (GeneratorInput) => string (HTML)
 */

import type { GeneratorInput } from './types'
import type { CaseworkType } from '../super-tools/types'
import { renderIncomeNowSummary } from './templates/income-now-summary'
import { renderIncomeLaterSummary } from './templates/income-later-summary'
import { renderEstateMaxSummary } from './templates/estate-max-summary'
import { renderGrowthMaxSummary } from './templates/growth-max-summary'
import { renderLtcMaxSummary } from './templates/ltc-max-summary'
import { renderMgeDetailedSummary } from './templates/mge-detailed-summary'
import { renderRothConversionSummary } from './templates/roth-conversion-summary'
import { renderTaxHarvestingSummary } from './templates/tax-harvesting-summary'

const SUMMARY_RENDERERS: Record<CaseworkType, (input: GeneratorInput) => string> = {
  income_now: renderIncomeNowSummary,
  income_later: renderIncomeLaterSummary,
  estate_max: renderEstateMaxSummary,
  growth_max: renderGrowthMaxSummary,
  ltc_max: renderLtcMaxSummary,
  mge_detailed: renderMgeDetailedSummary,
  roth_conversion: renderRothConversionSummary,
  tax_harvesting: renderTaxHarvestingSummary,
}

export function generateSummaryHtml(input: GeneratorInput): string {
  const renderer = SUMMARY_RENDERERS[input.analysis.type]
  if (!renderer) {
    return `<html><body><h1>Unknown casework type: ${input.analysis.type}</h1></body></html>`
  }
  return renderer(input)
}
