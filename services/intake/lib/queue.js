/**
 * Shared intake queue management — Firestore `intake_queue` collection.
 * Status flow: QUEUED → EXTRACTING → REVIEWING → APPROVED → WRITING → COMPLETE
 */
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
const COLLECTION = 'intake_queue';
function db() {
    return getFirestore();
}
/**
 * Create a new queue entry for an incoming file/document.
 */
export async function createQueueEntry(source, fileData) {
    const now = new Date().toISOString();
    const entry = {
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
        created_at: now,
        updated_at: now,
    };
    await db().collection(COLLECTION).doc(entry.queue_id).set(entry);
    return entry;
}
/**
 * Check if a file is already queued (prevent duplicates).
 */
export async function isFileQueued(fileId) {
    const snap = await db()
        .collection(COLLECTION)
        .where('file_id', '==', fileId)
        .where('status', 'not-in', ['ERROR', 'SKIPPED'])
        .limit(1)
        .get();
    return !snap.empty;
}
/**
 * Update queue entry status with transition validation.
 */
export async function updateQueueStatus(queueId, status, extra) {
    const updates = {
        status,
        updated_at: new Date().toISOString(),
        ...extra,
    };
    if (status === 'ERROR' && extra?.error_message) {
        updates.error_message = extra.error_message;
    }
    await db().collection(COLLECTION).doc(queueId).update(updates);
}
/**
 * Get queue depth grouped by status.
 */
export async function getQueueDepth() {
    const snap = await db().collection(COLLECTION).get();
    const counts = {};
    for (const doc of snap.docs) {
        const status = doc.data().status;
        counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
}
/**
 * Get queue depth grouped by source.
 */
export async function getQueueDepthBySource() {
    const snap = await db()
        .collection(COLLECTION)
        .where('status', '==', 'QUEUED')
        .get();
    const counts = {};
    for (const doc of snap.docs) {
        const source = doc.data().source;
        counts[source] = (counts[source] || 0) + 1;
    }
    return counts;
}
/**
 * Get next pending queue entry (oldest QUEUED).
 */
export async function getNextPending() {
    const snap = await db()
        .collection(COLLECTION)
        .where('status', '==', 'QUEUED')
        .orderBy('created_at', 'asc')
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    return snap.docs[0].data();
}
/**
 * Get all entries for a given source with status filter.
 */
export async function getQueueEntries(source, status, limit = 50) {
    let q = db().collection(COLLECTION).orderBy('created_at', 'desc');
    if (source)
        q = q.where('source', '==', source);
    if (status)
        q = q.where('status', '==', status);
    const snap = await q.limit(limit).get();
    return snap.docs.map(d => d.data());
}
/**
 * Store the last scan timestamp for a given channel.
 */
export async function setLastScanTime(channel, timestamp) {
    await db().collection('intake_config').doc('last_scan').set({ [channel]: timestamp }, { merge: true });
}
/**
 * Get the last scan timestamp for a given channel.
 */
export async function getLastScanTime(channel) {
    const doc = await db().collection('intake_config').doc('last_scan').get();
    if (!doc.exists)
        return null;
    return doc.data()?.[channel] || null;
}
//# sourceMappingURL=queue.js.map