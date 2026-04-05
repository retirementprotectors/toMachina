/**
 * CMO — Creative Marketing Operations Registry
 *
 * types     — CmoRegistryEntry, CmoChannel, CmoToolDomain, CmoWireStep, CmoWireDefinition
 * registry  — CMO_REGISTRY + lookup/filter helpers
 * tools/    — Canva (21) + WordPress (17) + Veo (5) + C3 (6) + Creative (5+)
 * wires/    — WIRE_BROCHURE, WIRE_CAMPAIGN, WIRE_LANDING_PAGE
 * wire-executor — step engine, logs, halt on failure (MUS-O01)
 * artisans  — Print + Digital + Web configs (MUS-O06)
 * compliance — brand compliance check hook (MUS-O08)
 * pipeline  — brief intake → artisan dispatch → result (MUS-O07)
 */

export * from './types'
export {
  CMO_REGISTRY,
  getCmoTool,
  getCmoToolsByDomain,
  getCmoToolsByChannel,
  getCmoToolsByType,
  getCmoWire,
} from './registry'
export { CMO_TOOLS } from './tools'
export { CMO_WIRES, WIRE_BROCHURE, WIRE_CAMPAIGN, WIRE_LANDING_PAGE } from './wires'
export { createBrochureRunner } from './wires/brochure-runner'
export { createCampaignRunner } from './wires/campaign-runner'
export { createLandingPageRunner } from './wires/landing-page-runner'
export { executeWire } from './wire-executor'
export {
  CMO_ARTISANS,
  getArtisan,
  getArtisanByChannel,
  getArtisanByWire,
} from './artisans'
export { checkBrandCompliance } from './compliance'
export { processBrief } from './pipeline'

// DEVOUR Track — inventory process helpers (type-safe, no server deps)
export { processCanvaDesigns } from './inventory/canva-scanner'
export { processDriveFiles } from './inventory/drive-scanner'
export { processWordPressPages } from './inventory/wordpress-auditor'
export { processTemplateDocuments } from './inventory/template-auditor'
