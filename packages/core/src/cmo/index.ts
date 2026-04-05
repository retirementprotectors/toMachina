/**
 * CMO — Creative Marketing Operations Registry
 *
 * types     — CmoRegistryEntry, CmoChannel, CmoToolDomain, CmoWireStep, CmoWireDefinition
 * registry  — CMO_REGISTRY + lookup/filter helpers
 * tools/    — Canva (21) + WordPress (17) + Veo (5) + C3 (6) + Creative (5+)
 * wires/    — WIRE_BROCHURE, WIRE_CAMPAIGN, WIRE_LANDING_PAGE
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
export { CMO_WIRES } from './wires'
