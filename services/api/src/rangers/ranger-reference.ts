// ---------------------------------------------------------------------------
// Ranger: Reference Seed (ZRD-O05)
// ---------------------------------------------------------------------------
// Foundation data. Carriers, products, NAIC codes, rate tables.
// WIRE_REFERENCE_SEED — idempotent: re-seed updates existing, zero duplicates.
// Stages: SUPER_EXTRACT → SUPER_NORMALIZE → SUPER_MATCH → SUPER_WRITE (skips VALIDATE)
// ---------------------------------------------------------------------------

import type { RangerConfig } from './types.js'
import { createRanger, type RangerExecutor } from './ranger-base.js'

export const RANGER_REFERENCE_CONFIG: RangerConfig = {
  rangerId: 'ranger-reference',
  wireId: 'WIRE_REFERENCE_SEED',
  systemPrompt:
    'Reference Seed Ranger. Executes WIRE_REFERENCE_SEED: extract reference data formats, normalize carrier names and product types, match to existing carriers/products for upsert, write reference records. Idempotent — re-seed updates existing, creates zero duplicates.',
  superTools: ['SUPER_EXTRACT', 'SUPER_NORMALIZE', 'SUPER_MATCH', 'SUPER_WRITE'],
  model: 'haiku',
  maxRetries: 2,
}

export const rangerReference: RangerExecutor = createRanger(RANGER_REFERENCE_CONFIG)
