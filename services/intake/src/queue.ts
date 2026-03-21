/**
 * Shared intake queue management — Firestore `intake_queue` collection.
 * Status flow: QUEUED → EXTRACTING → REVIEWING → APPROVED → WRITING → COMPLETE
 */

import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

export type QueueStatus =
  | 'QUEUED'
  | 'EXTRACTING'
  | 'REVIEWING'
  | 'APPROVED'
  | 'PARTIAL'
  | 'REJECTED'
  | 'WRITING'
  | 'COMPLETE'
  | 'ERROR'
  | 'SKIPPED'

export type IntakeSource = 'SPC_INTAKE' | 'COMMISSION' | 'MEET_TRANSCRIPT' | 'MAIL' | 'EMAIL'

export interface QueueEntry {
  queue_id: string
  source: IntakeSource
  file_id: string
  file_name: string
  file_type: string
  file_size?: number
  status: QueueStatus
  specialist_name?: string
  document_type?: string
  content_preview?: string
  extracted_data?: Record<string, unknown> | null
  approval_batch_id?: string | null
  meet_event_id?: string | null
  email_from?: string
  email_subject?: string
  email_priority?: 'high' | 'normal' | 'low'
  /** Folder the source file currently resides in (for post-wire moves) */
  source_folder_id?: string
  /** Processed folder ID (ACF_FINALIZE moves here on success) */
  processed_folder_id?: string
  /** Errors folder ID (error handler moves here on wire failure) */
  errors_folder_id?: string
  error_message?: string
  created_at: string
  updated_at: string
}

const COLLECTION = 'intake_queue'

function db(): Firestore {
  return getFirestore()
}

/**
 * Create a new queue entry for an incoming file/document.
 */
export async function createQueueEntry(
  source: IntakeSource,
  fileData: {
    file_id: string
    file_name: string
    file_type: string
    file_size?: number
    specialist_name?: string
    document_type?: string
    content_preview?: string
    meet_event_id?: string
    email_from?: string
    email_subject?: string
    email_priority?: 'high' | 'normal' | 'low'
    source_folder_id?: string
    processed_folder_id?: string
    errors_folder_id?: string
  }
): Promise<QueueEntry> {
  const now = new Date().toISOString()
  const entry: QueueEntry = {
    queue_id: randomUUID(),
    source,
    file_id: fileData.file_id,
    file_name: fileData.file_name,
    file_type: fileData.file_type,
    file_size: fileData.file_size,
    status: 'QUEUED',
    specialist_name: fileData.specialist_name,
    document_type: fileData.document_type,
    content_preview: fileData.content_preview,
    extracted_data: null,
    approval_batch_id: null,
    meet_event_id: fileData.meet_event_id,
    email_from: fileData.email_from,
    email_subject: fileData.email_subject,
    email_priority: fileData.email_priority,
    source_folder_id: fileData.source_folder_id,
    processed_folder_id: fileData.processed_folder_id,
    errors_folder_id: fileData.errors_folder_id,
    created_at: now,
    updated_at: now,
  }

  await db().collection(COLLECTION).doc(entry.queue_id).set(entry)
  return entry
}

/**
 * Check if a file is already queued (prevent duplicates).
 */
export async function isFileQueued(fileId: string): Promise<boolean> {
  const snap = await db()
    .collection(COLLECTION)
    .where('file_id', '==', fileId)
    .where('status', 'not-in', ['ERROR', 'SKIPPED'])
    .limit(1)
    .get()
  return !snap.empty
}

/**
 * Update queue entry status with transition validation.
 */
export async function updateQueueStatus(
  queueId: string,
  status: QueueStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  }

  if (status === 'ERROR' && extra?.error_message) {
    updates.error_message = extra.error_message
  }

  await db().collection(COLLECTION).doc(queueId).update(updates)
}

/**
 * Get queue depth grouped by status.
 */
export async function getQueueDepth(): Promise<Record<QueueStatus, number>> {
  const snap = await db().collection(COLLECTION).get()
  const counts: Record<string, number> = {}

  for (const doc of snap.docs) {
    const status = doc.data().status as string
    counts[status] = (counts[status] || 0) + 1
  }

  return counts as Record<QueueStatus, number>
}

/**
 * Get queue depth grouped by source.
 */
export async function getQueueDepthBySource(): Promise<Record<IntakeSource, number>> {
  const snap = await db()
    .collection(COLLECTION)
    .where('status', '==', 'QUEUED')
    .get()

  const counts: Record<string, number> = {}
  for (const doc of snap.docs) {
    const source = doc.data().source as string
    counts[source] = (counts[source] || 0) + 1
  }

  return counts as Record<IntakeSource, number>
}

/**
 * Get next pending queue entry (oldest QUEUED).
 */
export async function getNextPending(): Promise<QueueEntry | null> {
  const snap = await db()
    .collection(COLLECTION)
    .where('status', '==', 'QUEUED')
    .orderBy('created_at', 'asc')
    .limit(1)
    .get()

  if (snap.empty) return null
  return snap.docs[0].data() as QueueEntry
}

/**
 * Get all entries for a given source with status filter.
 */
export async function getQueueEntries(
  source?: IntakeSource,
  status?: QueueStatus,
  limit = 50
): Promise<QueueEntry[]> {
  let q = db().collection(COLLECTION).orderBy('created_at', 'desc') as FirebaseFirestore.Query

  if (source) q = q.where('source', '==', source)
  if (status) q = q.where('status', '==', status)

  const snap = await q.limit(limit).get()
  return snap.docs.map(d => d.data() as QueueEntry)
}

/**
 * Store the last scan timestamp for a given channel.
 */
export async function setLastScanTime(channel: IntakeSource, timestamp: string): Promise<void> {
  await db().collection('intake_config').doc('last_scan').set(
    { [channel]: timestamp },
    { merge: true }
  )
}

/**
 * Get the last scan timestamp for a given channel.
 */
export async function getLastScanTime(channel: IntakeSource): Promise<string | null> {
  const doc = await db().collection('intake_config').doc('last_scan').get()
  if (!doc.exists) return null
  return (doc.data() as Record<string, string>)?.[channel] || null
}
