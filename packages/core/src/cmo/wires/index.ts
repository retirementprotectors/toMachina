/**
 * CMO Wires Barrel (MUS-C09)
 * Aggregates all wire definitions.
 */
import type { CmoWireDefinition } from '../types'
import { WIRE_BROCHURE } from './WIRE_BROCHURE'
import { WIRE_CAMPAIGN } from './WIRE_CAMPAIGN'
import { WIRE_LANDING_PAGE } from './WIRE_LANDING_PAGE'

export { WIRE_BROCHURE } from './WIRE_BROCHURE'
export { WIRE_CAMPAIGN } from './WIRE_CAMPAIGN'
export { WIRE_LANDING_PAGE } from './WIRE_LANDING_PAGE'

/** All CMO wire definitions */
export const CMO_WIRES: CmoWireDefinition[] = [
  WIRE_BROCHURE,
  WIRE_CAMPAIGN,
  WIRE_LANDING_PAGE,
]
