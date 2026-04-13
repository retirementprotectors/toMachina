/**
 * generate-detail-html (TRK-13379)
 *
 * Dispatches to the type-specific Detail template based on the analysis type.
 * Pure function: (GeneratorInput) => string (HTML)
 */

import type { GeneratorInput } from './types'
import type { CaseworkType } from '../super-tools/types'
import { renderIncomeNowDetail } from './templates/income-now-detail'
import { renderIncomeLaterDetail } from './templates/income-later-detail'
import { renderEstateMaxDetail } from './templates/estate-max-detail'
import { renderGrowthMaxDetail } from './templates/growth-max-detail'
import { renderLtcMaxDetail } from './templates/ltc-max-detail'
import { renderMgeDetailedDetail } from './templates/mge-detailed-detail'
import { renderRothConversionDetail } from './templates/roth-conversion-detail'
import { renderTaxHarvestingDetail } from './templates/tax-harvesting-detail'
import { renderLifeDiscoveryDetail } from './templates/life-discovery-detail'
import { renderLifeNeedsDetail } from './templates/life-needs-detail'
import { renderLifeOptionsDetail } from './templates/life-options-detail'
import { renderLifePresentationDetail } from './templates/life-presentation-detail'

const DETAIL_RENDERERS: Record<CaseworkType, (input: GeneratorInput) => string> = {
  income_now: renderIncomeNowDetail,
  income_later: renderIncomeLaterDetail,
  estate_max: renderEstateMaxDetail,
  growth_max: renderGrowthMaxDetail,
  ltc_max: renderLtcMaxDetail,
  mge_detailed: renderMgeDetailedDetail,
  roth_conversion: renderRothConversionDetail,
  tax_harvesting: renderTaxHarvestingDetail,
  life_discovery: renderLifeDiscoveryDetail,
  life_needs: renderLifeNeedsDetail,
  life_options: renderLifeOptionsDetail,
  life_presentation: renderLifePresentationDetail,
  life_underwriting: renderLifeOptionsDetail,
}

export function generateDetailHtml(input: GeneratorInput): string {
  const renderer = DETAIL_RENDERERS[input.analysis.type]
  if (!renderer) {
    return `<html><body><h1>Unknown casework type: ${input.analysis.type}</h1></body></html>`
  }
  return renderer(input)
}
