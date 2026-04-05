// ---------------------------------------------------------------------------
// Ranger: Commission Sync (ZRD-O04)
// ---------------------------------------------------------------------------
// Revenue pipeline. Carrier commission statements → revenue records.
// WIRE_COMMISSION_SYNC — accuracy to the penny.
// Stages: SUPER_EXTRACT → SUPER_VALIDATE → SUPER_NORMALIZE → SUPER_MATCH → SUPER_WRITE
// ---------------------------------------------------------------------------

import type { RangerConfig } from './types.js'
import { createRanger, type RangerExecutor } from './ranger-base.js'

export const RANGER_COMMISSION_CONFIG: RangerConfig = {
  rangerId: 'ranger-commission',
  wireId: 'WIRE_COMMISSION_SYNC',
  systemPrompt:
    'Commission Sync Ranger. Executes the WIRE_COMMISSION_SYNC pipeline: extract commission rows from carrier statements, validate amounts and policy references, normalize carrier names and amounts, match to existing accounts and producers, write revenue records. Accuracy to the penny.',
  superTools: ['SUPER_EXTRACT', 'SUPER_VALIDATE', 'SUPER_NORMALIZE', 'SUPER_MATCH', 'SUPER_WRITE'],
  model: 'haiku',
  maxRetries: 2,
}

export const rangerCommission: RangerExecutor = createRanger(RANGER_COMMISSION_CONFIG)
