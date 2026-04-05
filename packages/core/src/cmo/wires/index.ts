/**
 * CMO Wires Barrel (MUS-C09 + MUS-O02/O03/O04)
 * Aggregates all wire definitions and their tool runners.
 */
import type { CmoWireDefinition } from '../types'
import { WIRE_BROCHURE } from './WIRE_BROCHURE'
import { WIRE_CAMPAIGN } from './WIRE_CAMPAIGN'
import { WIRE_LANDING_PAGE } from './WIRE_LANDING_PAGE'
import { WIRE_SOCIAL } from './WIRE_SOCIAL'
import { WIRE_VIDEO } from './WIRE_VIDEO'

export { WIRE_BROCHURE } from './WIRE_BROCHURE'
export { WIRE_CAMPAIGN } from './WIRE_CAMPAIGN'
export { WIRE_LANDING_PAGE } from './WIRE_LANDING_PAGE'
export { WIRE_SOCIAL } from './WIRE_SOCIAL'
export { WIRE_VIDEO } from './WIRE_VIDEO'
export { createBrochureRunner } from './brochure-runner'
export { createCampaignRunner } from './campaign-runner'
export { createLandingPageRunner } from './landing-page-runner'

/** All CMO wire definitions */
export const CMO_WIRES: CmoWireDefinition[] = [
  WIRE_BROCHURE,
  WIRE_CAMPAIGN,
  WIRE_LANDING_PAGE,
  WIRE_SOCIAL,
  WIRE_VIDEO,
]
