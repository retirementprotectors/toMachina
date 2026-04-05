// ---------------------------------------------------------------------------
// Ranger: ACF Cleanup (ZRD-O02)
// ---------------------------------------------------------------------------
// First Ranger. Proves the pattern.
// WIRE_ACF_CLEANUP — shortest wire (3 stages), most tested (ACF 2.0), lowest risk.
// Stages: SUPER_FOLDER_CLEANUP → SUPER_DOCUMENT_CLEANUP → SUPER_AUDIT_REVIEW
// ---------------------------------------------------------------------------

import type { RangerConfig } from './types.js'
import { createRanger, type RangerExecutor } from './ranger-base.js'

export const RANGER_ACF_CONFIG: RangerConfig = {
  rangerId: 'ranger-acf',
  wireId: 'WIRE_ACF_CLEANUP',
  systemPrompt:
    'ACF Cleanup Ranger. Executes the WIRE_ACF_CLEANUP pipeline: folder structure normalization, document dedup/rename/reclassify, and audit review. Produces an audit report for human review.',
  superTools: ['SUPER_FOLDER_CLEANUP', 'SUPER_DOCUMENT_CLEANUP', 'SUPER_AUDIT_REVIEW'],
  model: 'haiku',
  maxRetries: 2,
}

export const rangerAcf: RangerExecutor = createRanger(RANGER_ACF_CONFIG)
