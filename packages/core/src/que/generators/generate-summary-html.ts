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
import { renderLifeDiscoverySummary } from './templates/life-discovery-summary'
import { renderLifeNeedsSummary } from './templates/life-needs-summary'
import { renderLifeOptionsSummary } from './templates/life-options-summary'
import { renderLifePresentationSummary } from './templates/life-presentation-summary'

const SUMMARY_RENDERERS: Record<CaseworkType, (input: GeneratorInput) => string> = {
  income_now: renderIncomeNowSummary,
  income_later: renderIncomeLaterSummary,
  estate_max: renderEstateMaxSummary,
  growth_max: renderGrowthMaxSummary,
  ltc_max: renderLtcMaxSummary,
  mge_detailed: renderMgeDetailedSummary,
  roth_conversion: renderRothConversionSummary,
  tax_harvesting: renderTaxHarvestingSummary,
  life_discovery: renderLifeDiscoverySummary,
  life_needs: renderLifeNeedsSummary,
  life_options: renderLifeOptionsSummary,
  life_presentation: renderLifePresentationSummary,
}

export function generateSummaryHtml(input: GeneratorInput): string {
  const renderer = SUMMARY_RENDERERS[input.analysis.type]
  if (!renderer) {
    return `<html><body><h1>Unknown casework type: ${input.analysis.type}</h1></body></html>`
  }
  return renderer(input)
}
