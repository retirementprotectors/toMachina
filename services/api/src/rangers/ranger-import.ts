// ---------------------------------------------------------------------------
// Ranger: Data Import (ZRD-O03)
// ---------------------------------------------------------------------------
// Highest business value. Every carrier onboard starts here.
// WIRE_DATA_IMPORT — universal CSV/file ingestion pipeline.
// Stages: SUPER_EXTRACT → SUPER_VALIDATE → SUPER_NORMALIZE → SUPER_MATCH → SUPER_WRITE
// ---------------------------------------------------------------------------

import type { RangerConfig } from './types.js'
import { createRanger, type RangerExecutor } from './ranger-base.js'

export const RANGER_IMPORT_CONFIG: RangerConfig = {
  rangerId: 'ranger-import',
  wireId: 'WIRE_DATA_IMPORT',
  systemPrompt:
    'Data Import Ranger. Executes the WIRE_DATA_IMPORT pipeline: introspection-based column mapping, validation, normalization across 90+ fields, 3-tier dedup matching, and batch write. Accepts Drive file ID or upload path.',
  superTools: ['SUPER_EXTRACT', 'SUPER_VALIDATE', 'SUPER_NORMALIZE', 'SUPER_MATCH', 'SUPER_WRITE'],
  model: 'haiku',
  maxRetries: 2,
}

export const rangerImport: RangerExecutor = createRanger(RANGER_IMPORT_CONFIG)
