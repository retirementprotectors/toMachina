/**
 * Carrier/NAIC seed orchestration — ported from processCarrierSeed (IMPORT_Client.gs)
 * and seed-carriers.ts script logic.
 *
 * Provides API-callable carrier seeding:
 *   - Upsert carriers into Firestore `carriers` collection
 *   - Populate NAIC codes on accounts via charter_code lookup
 *   - Uses Firestore carrier docs as the authoritative charter → NAIC source
 *   - Import run tracking via import-tracker
 *
 * ATLAS wire: WIRE_NAIC_CARRIER_SEEDING (IK-004)
 */

import { getFirestore } from 'firebase-admin/firestore'
import {
  normalizeCarrierName,
  normalizeCarrierFull,
} from '@tomachina/core'
import { startImportRun, completeImportRun } from './import-tracker.js'

// ============================================================================
// CONSTANTS
// ============================================================================

const CARRIERS_COLLECTION = 'carriers'
const BATCH_LIMIT = 400

// ============================================================================
// TYPES
// ============================================================================

export interface CarrierSeedEntry {
  carrier_id: string
  parent_brand: string
  display_name: string
  underwriting_charters: Array<{
    naic: number | null
    legal_name: string
    short_code: string
  }>
  ghl_format?: string | null
  status?: string
  website?: string
  contact_phone?: string
  contact_email?: string
  am_best_rating?: string
  product_types?: string[]
}

export interface CarrierSeedResult {
  created: number
  updated: number
  unchanged: number
  errors: Array<{ carrier_id: string; error: string }>
  import_run_id: string
}

export interface NaicPopulateResult {
  scanned: number
  updated: number
  skipped_no_charter: number
  skipped_no_naic: number
  skipped_already_set: number
  errors: number
  dry_run: boolean
  import_run_id: string
}

// ============================================================================
// CARRIER SEED (upsert carriers into Firestore)
// ============================================================================

/**
 * Seed / upsert carrier documents into Firestore.
 *
 * Each carrier entry is a parent brand with underwriting charters.
 * Uses carrier_id as the Firestore document ID for deterministic upserts.
 * Merges new charters into existing docs (never removes existing charters).
 */
export async function seedCarriers(
  entries: CarrierSeedEntry[],
  triggeredBy: string = 'api'
): Promise<{ success: boolean; data?: CarrierSeedResult; error?: string }> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { success: false, error: 'Carrier entries array is required and must not be empty' }
  }

  const importRunId = await startImportRun({
    wire_id: 'WIRE_NAIC_CARRIER_SEEDING',
    import_type: 'carrier_seed',
    source: 'NAIC_SEED',
    total_records: entries.length,
    triggered_by: triggeredBy,
  })

  const db = getFirestore()
  const now = new Date().toISOString()
  const results: CarrierSeedResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
    import_run_id: importRunId,
  }

  // Chunk into batches of BATCH_LIMIT
  const chunks: CarrierSeedEntry[][] = []
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    chunks.push(entries.slice(i, i + BATCH_LIMIT))
  }

  for (const chunk of chunks) {
    const batch = db.batch()

    for (const entry of chunk) {
      try {
        if (!entry.carrier_id || !entry.parent_brand) {
          results.errors.push({
            carrier_id: entry.carrier_id || 'UNKNOWN',
            error: 'Missing carrier_id or parent_brand',
          })
          continue
        }

        const docRef = db.collection(CARRIERS_COLLECTION).doc(entry.carrier_id)
        const existing = await docRef.get()

        if (existing.exists) {
          // Merge: add any new charters, update metadata
          const existingData = existing.data() || {}
          const existingCharters = existingData.underwriting_charters || []
          const existingCodes = new Set(
            existingCharters.map((c: { short_code: string }) => c.short_code)
          )

          const newCharters = (entry.underwriting_charters || []).filter(
            c => !existingCodes.has(c.short_code)
          )

          if (newCharters.length > 0 || entry.parent_brand !== existingData.parent_brand) {
            const updates: Record<string, unknown> = {
              parent_brand: entry.parent_brand,
              display_name: entry.display_name || existingData.display_name,
              status: entry.status || existingData.status || 'ACTIVE',
              updated_at: now,
            }

            if (newCharters.length > 0) {
              updates.underwriting_charters = [...existingCharters, ...newCharters]
            }

            // Merge optional metadata fields
            if (entry.website) updates.website = entry.website
            if (entry.contact_phone) updates.contact_phone = entry.contact_phone
            if (entry.contact_email) updates.contact_email = entry.contact_email
            if (entry.am_best_rating) updates.am_best_rating = entry.am_best_rating
            if (entry.product_types) updates.product_types = entry.product_types
            if (entry.ghl_format !== undefined) updates.ghl_format = entry.ghl_format

            batch.update(docRef, updates)
            results.updated++
          } else {
            results.unchanged++
          }
        } else {
          // Create new carrier
          const doc: Record<string, unknown> = {
            carrier_id: entry.carrier_id,
            parent_brand: entry.parent_brand,
            display_name: entry.display_name || entry.parent_brand,
            // Map to the Carrier interface field name
            name: entry.display_name || entry.parent_brand,
            underwriting_charters: entry.underwriting_charters || [],
            ghl_format: entry.ghl_format || null,
            status: entry.status || 'ACTIVE',
            created_at: now,
            updated_at: now,
          }

          // Optional metadata
          if (entry.website) doc.website = entry.website
          if (entry.contact_phone) doc.contact_phone = entry.contact_phone
          if (entry.contact_email) doc.contact_email = entry.contact_email
          if (entry.am_best_rating) doc.am_best_rating = entry.am_best_rating
          if (entry.product_types) doc.product_types = entry.product_types

          batch.set(docRef, doc)
          results.created++
        }
      } catch (err) {
        results.errors.push({ carrier_id: entry.carrier_id, error: String(err) })
      }
    }

    await batch.commit()
  }

  await completeImportRun(importRunId, {
    imported: results.created,
    skipped: results.unchanged,
    duplicates: results.updated,
    errors: results.errors.length,
    error_details: results.errors.map((e, i) => ({ index: i, error: `${e.carrier_id}: ${e.error}` })),
  })

  return { success: true, data: results }
}

// ============================================================================
// NAIC POPULATION (backfill NAIC codes on accounts)
// ============================================================================

/**
 * Build charter_code → NAIC lookup from Firestore carrier docs.
 * Each carrier doc has an underwriting_charters array with { naic, short_code }.
 */
async function buildCharterNaicMap(
  db: FirebaseFirestore.Firestore
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const snap = await db.collection(CARRIERS_COLLECTION).get()

  for (const doc of snap.docs) {
    const charters = doc.data().underwriting_charters || []
    for (const charter of charters) {
      if (charter.short_code && charter.naic) {
        map.set(charter.short_code, charter.naic)
      }
    }
  }

  return map
}

/**
 * Populate naic_code on accounts that have a charter_code but no naic_code.
 *
 * Reads carrier docs from Firestore to build charter_code → NAIC lookup,
 * then scans all client account subcollections for candidates.
 *
 * Ported from services/api/src/scripts/populate-naic.ts to be API-callable.
 */
export async function populateNaicCodes(
  dryRun: boolean = true,
  triggeredBy: string = 'api'
): Promise<{ success: boolean; data?: NaicPopulateResult; error?: string }> {
  const importRunId = await startImportRun({
    wire_id: 'WIRE_NAIC_CARRIER_SEEDING',
    import_type: 'naic_populate',
    source: 'CARRIER_DOCS',
    total_records: 0,
    triggered_by: triggeredBy,
  })

  const db = getFirestore()

  // Build charter_code → NAIC lookup from Firestore carrier docs
  const charterToNaic = await buildCharterNaicMap(db)

  const result: NaicPopulateResult = {
    scanned: 0,
    updated: 0,
    skipped_no_charter: 0,
    skipped_no_naic: 0,
    skipped_already_set: 0,
    errors: 0,
    dry_run: dryRun,
    import_run_id: importRunId,
  }

  try {
    // Scan all clients, then their account subcollections
    const clientSnap = await db.collection('clients').select().get()

    for (const clientDoc of clientSnap.docs) {
      const accountsSnap = await clientDoc.ref.collection('accounts').get()

      for (const accountDoc of accountsSnap.docs) {
        result.scanned++
        const data = accountDoc.data()

        // Skip if already has naic_code
        if (data.naic_code) {
          result.skipped_already_set++
          continue
        }

        // Skip if no charter_code to look up
        const charterCode = data.charter_code
        if (!charterCode) {
          result.skipped_no_charter++
          continue
        }

        // Look up NAIC
        const naic = charterToNaic.get(charterCode)
        if (!naic) {
          result.skipped_no_naic++
          continue
        }

        // Write NAIC code
        if (!dryRun) {
          try {
            await accountDoc.ref.update({
              naic_code: String(naic),
              updated_at: new Date().toISOString(),
            })
          } catch (_writeErr) {
            result.errors++
            continue
          }
        }

        result.updated++
      }
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }

  await completeImportRun(importRunId, {
    imported: result.updated,
    skipped: result.skipped_already_set + result.skipped_no_charter + result.skipped_no_naic,
    duplicates: 0,
    errors: result.errors,
    error_details: [],
    status: result.errors > 0 && result.updated === 0 ? 'failed' : undefined,
  })

  return { success: true, data: result }
}

// ============================================================================
// CARRIER LOOKUP HELPERS
// ============================================================================

/**
 * Resolve a raw carrier name to its full identity (parent + charter + NAIC).
 * Delegates to the core normalizer's two-layer resolution via normalizeCarrierFull().
 */
export function resolveCarrier(rawName: string): {
  carrier: string
  charter: string | null
  charter_code: string | null
  naic: number | null
  carrier_id: string | null
} {
  if (!rawName) {
    return { carrier: '', charter: null, charter_code: null, naic: null, carrier_id: null }
  }

  const resolved = normalizeCarrierFull(rawName)
  return {
    carrier: resolved.carrier,
    charter: resolved.charter,
    charter_code: resolved.charter_code,
    naic: resolved.naic,
    carrier_id: resolved.carrier_id,
  }
}
