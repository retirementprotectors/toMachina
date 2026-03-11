/**
 * BigQuery Streaming Cloud Function
 *
 * Triggers on ANY Firestore document write (create, update, delete).
 * Inserts a row into BigQuery `toMachina.firestore_changes`.
 *
 * This replaces per-collection Firebase extension instances (doesn't scale).
 * One function, all collections, one BigQuery table.
 */

import { onDocumentWritten, type FirestoreEvent, type Change } from 'firebase-functions/v2/firestore'
import { BigQuery } from '@google-cloud/bigquery'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin (once)
if (admin.apps.length === 0) {
  admin.initializeApp()
}

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'claude-mcp-484718'
const DATASET_ID = 'toMachina'
const TABLE_ID = 'firestore_changes'

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
