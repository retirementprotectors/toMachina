/**
 * BigQuery Streaming Cloud Function
 *
 * Triggers on ANY Firestore document write (create, update, delete).
 * Inserts a row into a BigQuery table.
 *
 * Default Firestore DB → dataset `toMachina`, table `firestore_changes`.
 * Per-partner named DBs (ZRD-PLAT-MT-011) stream to their own datasets:
 *   partner-<slug>  →  partner_<slug_underscored>.firestore_changes
 *
 * See docs/warriors/ronin/mt-011-bigquery-per-partner-config.md for the
 * naming convention and the add-a-partner checklist.
 */

import { onDocumentWritten, type FirestoreEvent, type Change } from 'firebase-functions/v2/firestore'
import { BigQuery } from '@google-cloud/bigquery'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin (once)
if (admin.apps.length === 0) {
  admin.initializeApp()
}

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'claude-mcp-484718'
const DEFAULT_DATASET_ID = 'toMachina'
const TABLE_ID = 'firestore_changes'

// Backwards-compat alias for existing default-DB functions below.
const DATASET_ID = DEFAULT_DATASET_ID

/**
 * ZRD-PLAT-MT-011 — Convert a partner slug (hyphen-separated) to its
 * BigQuery dataset name (underscore-separated, prefixed with "partner_").
 *   'midwest-medigap' → 'partner_midwest_medigap'
 *
 * BigQuery dataset names cannot contain hyphens. Firestore named DB ids can.
 */
export function partnerDatasetName(slug: string): string {
  return `partner_${slug.replace(/-/g, '_')}`
}

// Lazy-init BigQuery client
let bq: BigQuery | null = null
function getBQ(): BigQuery {
  if (!bq) {
    bq = new BigQuery({ projectId: PROJECT_ID })
  }
  return bq
}

/**
 * Determine which fields changed between before and after snapshots.
 */
function getChangedFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): string[] {
  if (!before && after) return Object.keys(after) // create: all fields are "changed"
  if (before && !after) return Object.keys(before) // delete: all fields are "changed"
  if (!before || !after) return []

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key)
    }
  }
  return changed
}

/**
 * Extract collection path from the full document path.
 * e.g., "clients/abc123" → "clients"
 *        "clients/abc123/accounts/def456" → "clients/accounts"
 */
function extractCollection(docPath: string): string {
  const parts = docPath.split('/')
  // Even indices are collection names, odd indices are document IDs
  return parts.filter((_, i) => i % 2 === 0).join('/')
}

/**
 * Cloud Function: onDocumentWritten for all Firestore documents.
 * Matches the wildcard pattern "{document=**}" to catch everything.
 */
export const streamToBI = onDocumentWritten(
  {
    document: '{collectionId}/{documentId}',
    region: 'us-central1',
  },
  async (event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>) => {
    if (!event.data) return

    const beforeData = event.data.before?.data()
    const afterData = event.data.after?.data()
    const docPath = event.data.after?.ref?.path || event.data.before?.ref?.path || ''
    const docId = event.data.after?.id || event.data.before?.id || ''

    // Determine operation type
    let operation: 'create' | 'update' | 'delete'
    if (!beforeData && afterData) operation = 'create'
    else if (beforeData && !afterData) operation = 'delete'
    else operation = 'update'

    const collection = extractCollection(docPath)
    const changedFields = getChangedFields(beforeData, afterData)
    const timestamp = new Date().toISOString()

    // Prepare BigQuery row
    const row = {
      collection,
      document_id: docId,
      operation,
      timestamp,
      data_json: JSON.stringify(afterData || beforeData || {}),
      changed_fields: changedFields.join(','),
    }

    try {
      const client = getBQ()
      await client
        .dataset(DATASET_ID)
        .table(TABLE_ID)
        .insert([row])
    } catch (err: unknown) {
      // Log but don't fail — BQ streaming can have transient errors
      const error = err as { name?: string; errors?: unknown[] }
      if (error.name === 'PartialFailureError') {
        console.error('BigQuery partial insert failure:', JSON.stringify(error.errors))
      } else {
        console.error('BigQuery insert error:', err)
      }
    }
  }
)

/**
 * Additional function for subcollection documents (2 levels deep).
 * Catches patterns like clients/{clientId}/accounts/{accountId}
 */
export const streamSubcollectionToBI = onDocumentWritten(
  {
    document: '{collectionId}/{parentId}/{subcollectionId}/{documentId}',
    region: 'us-central1',
  },
  async (event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>) => {
    if (!event.data) return

    const beforeData = event.data.before?.data()
    const afterData = event.data.after?.data()
    const docPath = event.data.after?.ref?.path || event.data.before?.ref?.path || ''
    const docId = event.data.after?.id || event.data.before?.id || ''

    let operation: 'create' | 'update' | 'delete'
    if (!beforeData && afterData) operation = 'create'
    else if (beforeData && !afterData) operation = 'delete'
    else operation = 'update'

    const collection = extractCollection(docPath)
    const changedFields = getChangedFields(beforeData, afterData)
    const timestamp = new Date().toISOString()

    const row = {
      collection,
      document_id: docId,
      operation,
      timestamp,
      data_json: JSON.stringify(afterData || beforeData || {}),
      changed_fields: changedFields.join(','),
    }

    try {
      const client = getBQ()
      await client
        .dataset(DATASET_ID)
        .table(TABLE_ID)
        .insert([row])
    } catch (err: unknown) {
      const error = err as { name?: string; errors?: unknown[] }
      if (error.name === 'PartialFailureError') {
        console.error('BigQuery partial insert failure:', JSON.stringify(error.errors))
      } else {
        console.error('BigQuery insert error:', err)
      }
    }
  }
)

// ─── ZRD-PLAT-MT-011 — Per-partner streaming factories ─────────────────────────
//
// Firebase Functions v2 onDocumentWritten supports a `database` option to
// attach the trigger to a named Firestore DB. Each partner DB gets its own
// pair of trigger functions (top-level + subcollection) writing to the
// partner-specific BigQuery dataset.
//
// To add a new partner:
//   1. Provision the DB via `npm run onboard-partner <slug> …` (MT-008).
//   2. Ensure the BQ dataset `partnerDatasetName(slug)` exists:
//        bq mk --dataset claude-mcp-484718:partner_<slug_underscored>
//   3. Add two exports using makePartnerStream() below.
//   4. Redeploy services/bigquery-stream.
//
// Future: auto-generate these blocks from partner_registry (follow-up sprint).

async function insertToDataset(datasetId: string, row: Record<string, unknown>): Promise<void> {
  try {
    const client = getBQ()
    await client.dataset(datasetId).table(TABLE_ID).insert([row])
  } catch (err: unknown) {
    const error = err as { name?: string; errors?: unknown[] }
    if (error.name === 'PartialFailureError') {
      console.error(`BigQuery partial insert failure (${datasetId}):`, JSON.stringify(error.errors))
    } else {
      console.error(`BigQuery insert error (${datasetId}):`, err)
    }
  }
}

function buildRowFromEvent(
  event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>
): Record<string, unknown> | null {
  if (!event.data) return null
  const beforeData = event.data.before?.data()
  const afterData = event.data.after?.data()
  const docPath = event.data.after?.ref?.path || event.data.before?.ref?.path || ''
  const docId = event.data.after?.id || event.data.before?.id || ''

  let operation: 'create' | 'update' | 'delete'
  if (!beforeData && afterData) operation = 'create'
  else if (beforeData && !afterData) operation = 'delete'
  else operation = 'update'

  return {
    collection: extractCollection(docPath),
    document_id: docId,
    operation,
    timestamp: new Date().toISOString(),
    data_json: JSON.stringify(afterData || beforeData || {}),
    changed_fields: getChangedFields(beforeData, afterData).join(','),
  }
}

/**
 * Factory: build two onDocumentWritten triggers for a named Firestore DB,
 * streaming into a partner-scoped BigQuery dataset. Returns the two
 * Cloud Function handles so the caller can export them.
 */
export function makePartnerStream(databaseId: string, datasetId: string) {
  const top = onDocumentWritten(
    {
      document: '{collectionId}/{documentId}',
      region: 'us-central1',
      database: databaseId,
    },
    async (event) => {
      const row = buildRowFromEvent(event)
      if (row) await insertToDataset(datasetId, row)
    }
  )

  const sub = onDocumentWritten(
    {
      document: '{collectionId}/{parentId}/{subcollectionId}/{documentId}',
      region: 'us-central1',
      database: databaseId,
    },
    async (event) => {
      const row = buildRowFromEvent(event)
      if (row) await insertToDataset(datasetId, row)
    }
  )

  return { top, sub }
}

// ─── Midwest Medigap (DAVID Partner #1) ────────────────────────────────────────
// Enable once partner-midwest-medigap DB exists and the partner_midwest_medigap
// BQ dataset has been created. Uncomment and redeploy to activate.
//
// const mm = makePartnerStream('partner-midwest-medigap', partnerDatasetName('midwest-medigap'))
// export const streamMidwestMedigapToBI = mm.top
// export const streamMidwestMedigapSubToBI = mm.sub
