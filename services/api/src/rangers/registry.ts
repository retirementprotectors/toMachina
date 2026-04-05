// ---------------------------------------------------------------------------
// Ranger Registry (ZRD-O08)
// ---------------------------------------------------------------------------
// Central map of all registered Rangers. Used by the Orchestration API
// to look up Rangers by ID, validate dispatch requests, and list available Rangers.
// ---------------------------------------------------------------------------

import type { RangerMeta } from './types.js'
import { RANGER_ACF_CONFIG } from './ranger-acf.js'
import { RANGER_IMPORT_CONFIG } from './ranger-import.js'
import { RANGER_COMMISSION_CONFIG } from './ranger-commission.js'
import { RANGER_REFERENCE_CONFIG } from './ranger-reference.js'
import { RANGER_CORRESPONDENCE_CONFIG } from './ranger-correspondence.js'
import { rangerAcf } from './ranger-acf.js'
import { rangerImport } from './ranger-import.js'
import { rangerCommission } from './ranger-commission.js'
import { rangerReference } from './ranger-reference.js'
import { rangerCorrespondence } from './ranger-correspondence.js'
import type { RangerExecutor } from './ranger-base.js'

// ---------------------------------------------------------------------------
// Registry data
// ---------------------------------------------------------------------------

interface RangerRegistryEntry {
  meta: RangerMeta
  executor: RangerExecutor
}

const RANGER_REGISTRY: Map<string, RangerRegistryEntry> = new Map([
  [
    'ranger-acf',
    {
      meta: {
        rangerId: RANGER_ACF_CONFIG.rangerId,
        wireId: RANGER_ACF_CONFIG.wireId,
        name: 'ACF Cleanup',
        description: 'Active Client File hygiene: folder structure, document naming, dedup, audit.',
        superTools: RANGER_ACF_CONFIG.superTools,
        model: RANGER_ACF_CONFIG.model,
        maxRetries: RANGER_ACF_CONFIG.maxRetries,
      },
      executor: rangerAcf,
    },
  ],
  [
    'ranger-import',
    {
      meta: {
        rangerId: RANGER_IMPORT_CONFIG.rangerId,
        wireId: RANGER_IMPORT_CONFIG.wireId,
        name: 'Data Import',
        description: 'Universal CSV/file ingestion pipeline. Handles clients, accounts, and producers.',
        superTools: RANGER_IMPORT_CONFIG.superTools,
        model: RANGER_IMPORT_CONFIG.model,
        maxRetries: RANGER_IMPORT_CONFIG.maxRetries,
      },
      executor: rangerImport,
    },
  ],
  [
    'ranger-commission',
    {
      meta: {
        rangerId: RANGER_COMMISSION_CONFIG.rangerId,
        wireId: RANGER_COMMISSION_CONFIG.wireId,
        name: 'Commission Sync',
        description: 'Carrier commission statements → revenue records. Accuracy to the penny.',
        superTools: RANGER_COMMISSION_CONFIG.superTools,
        model: RANGER_COMMISSION_CONFIG.model,
        maxRetries: RANGER_COMMISSION_CONFIG.maxRetries,
      },
      executor: rangerCommission,
    },
  ],
  [
    'ranger-reference',
    {
      meta: {
        rangerId: RANGER_REFERENCE_CONFIG.rangerId,
        wireId: RANGER_REFERENCE_CONFIG.wireId,
        name: 'Reference Seed',
        description: 'Foundation data: carriers, products, NAIC codes, rate tables. Idempotent.',
        superTools: RANGER_REFERENCE_CONFIG.superTools,
        model: RANGER_REFERENCE_CONFIG.model,
        maxRetries: RANGER_REFERENCE_CONFIG.maxRetries,
      },
      executor: rangerReference,
    },
  ],
  [
    'ranger-correspondence',
    {
      meta: {
        rangerId: RANGER_CORRESPONDENCE_CONFIG.rangerId,
        wireId: RANGER_CORRESPONDENCE_CONFIG.wireId,
        name: 'Correspondence',
        description: 'Physical mail scan → classify → extract → route to ACF. Server-only (fs access).',
        superTools: RANGER_CORRESPONDENCE_CONFIG.superTools,
        model: RANGER_CORRESPONDENCE_CONFIG.model,
        maxRetries: RANGER_CORRESPONDENCE_CONFIG.maxRetries,
      },
      executor: rangerCorrespondence,
    },
  ],
])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a Ranger executor by ID. Returns null if not found.
 */
export function getRanger(rangerId: string): RangerRegistryEntry | null {
  return RANGER_REGISTRY.get(rangerId) || null
}

/**
 * List all registered Rangers with metadata.
 */
export function listRangers(): RangerMeta[] {
  return Array.from(RANGER_REGISTRY.values()).map((entry) => entry.meta)
}

/**
 * Check if a rangerId is valid.
 */
export function isValidRanger(rangerId: string): boolean {
  return RANGER_REGISTRY.has(rangerId)
}
