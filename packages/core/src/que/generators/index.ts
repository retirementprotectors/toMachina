/**
 * QUE Generators — HTML output generation for casework components.
 *
 * 5 generators:
 *   - generate-summary-html: Tier 1 one-pager per casework type
 *   - generate-detail-html:  Tier 2/3 year-by-year per casework type
 *   - generate-ai3-pdf:      Client-facing AI3 from household data
 *   - generate-meeting-prep:  Review meeting agenda with talk tracks
 *   - generate-factfinder:    Pre-filled application package
 *
 * 16 templates (Summary + Detail x 8 casework types)
 */

export type {
  GeneratorInput,
  Ai3GeneratorInput,
  MeetingPrepInput,
  FactfinderInput,
  TemplateRenderer,
} from './types'
export { DESIGN, TAX_HARVESTING_DISCLOSURE } from './types'

// Generators
export { generateSummaryHtml } from './generate-summary-html'
export { generateDetailHtml } from './generate-detail-html'
export { generateAi3Pdf } from './generate-ai3-pdf'
export { generateMeetingPrep } from './generate-meeting-prep'
export { generateFactfinder } from './generate-factfinder'

// Shared styles (for custom template work)
export {
  getBaseStyles,
  formatCurrency,
  formatPercent,
  renderHeader,
  renderFooter,
  escapeHtml,
} from './shared-styles'
