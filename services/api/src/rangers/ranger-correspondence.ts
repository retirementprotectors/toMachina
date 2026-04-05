// ---------------------------------------------------------------------------
// Ranger: Correspondence (ZRD-O06)
// ---------------------------------------------------------------------------
// Most complex Ranger. 8-stage wire. Server-only (SUPER_PREPARE + SUPER_CLASSIFY
// need fs access). Physical mail scan → classify → extract → route to ACF.
// Must run on MDJ_SERVER (fs access required).
// ---------------------------------------------------------------------------

import type { RangerConfig } from './types.js'
import { createRanger, type RangerExecutor } from './ranger-base.js'

export const RANGER_CORRESPONDENCE_CONFIG: RangerConfig = {
  rangerId: 'ranger-correspondence',
  wireId: 'WIRE_INCOMING_CORRESPONDENCE',
  systemPrompt:
    'Correspondence Ranger. Executes WIRE_INCOMING_CORRESPONDENCE (8 stages): download from Drive, PDF to page images, Claude Vision document classification, data extraction, validation, normalization, dedup matching, write, ACF filing. Server-only — requires filesystem access for PDF processing.',
  superTools: [
    'SUPER_PREPARE',
    'SUPER_CLASSIFY',
    'SUPER_EXTRACT',
    'SUPER_VALIDATE',
    'SUPER_NORMALIZE',
    'SUPER_MATCH',
    'SUPER_WRITE',
    'ACF_FINALIZE',
  ],
  model: 'sonnet', // Vision tasks need sonnet
  maxRetries: 1, // No retry on classification — wrong classification is worse than halting
}

export const rangerCorrespondence: RangerExecutor = createRanger(RANGER_CORRESPONDENCE_CONFIG)
