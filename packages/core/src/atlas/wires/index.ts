// ---------------------------------------------------------------------------
// ATLAS Wires — subdir barrel.
//
// Created by SPR-FARMLAND-VALUATION-001 (FV-005) per MEGAZORD GAP A
// path ruling — canonical home for ATLAS-owned wire definitions going
// forward. `packages/core/src/atlas/wires.ts` imports from this file
// and concatenates the subdir's definitions into the flat
// `WIRE_DEFINITIONS_V2` array so existing consumers see no change.
//
// The nine inline wires in wires.ts (WIRE_DATA_IMPORT, WIRE_COMMISSION_
// SYNC, …) stay put for now; future ATLAS wires land here.
// ---------------------------------------------------------------------------

import type { WireDefinitionV2 } from '../types'
import { WIRE_FARMLAND_VALUE_SEED } from './wire-farmland-value-seed'

export { WIRE_FARMLAND_VALUE_SEED } from './wire-farmland-value-seed'

/**
 * All wire definitions defined in this subdir. wires.ts spreads this
 * array into `WIRE_DEFINITIONS_V2` to keep the public registry flat.
 */
export const ATLAS_WIRES_SUBDIR: WireDefinitionV2[] = [
  WIRE_FARMLAND_VALUE_SEED,
]
