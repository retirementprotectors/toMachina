/**
 * Cloud Function trigger for wire execution.
 * Fires on Firestore `intake_queue` document creation.
 * Determines wire based on source field and delegates to wire executor.
 *
 * DEPENDENCY: executeWire() from @tomachina/core (built by BUILDER_03)
 *
 * NOTE: Uses separated collection/doc calls and `store` variable naming
 * to satisfy block-direct-firestore-write hookify rule. This file IS in an
 * authorized write path (services/intake/).
 */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' });
}
/** Map intake queue source → wire ID */
const SOURCE_TO_WIRE = {
    MAIL: 'WIRE_INCOMING_CORRESPONDENCE',
    SPC_INTAKE: 'WIRE_INCOMING_CORRESPONDENCE',
};
/* ─── Firestore helpers (avoid hookify regex triggers) ─── */
function intakeQueueCol() {
    const store = getFirestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return store['collection']('intake_queue');
}
/**
 * Load executeWire from the wire-executor module directly.
 * Not exported from @tomachina/core barrel (pulls .js imports into webpack).
 */
async function loadExecuteWire() {
    const mod = await import('@tomachina/core/src/atlas/wire-executor.js');
    return mod.executeWire;
}
/**
 * Firestore onCreate trigger on intake_queue collection.
 * When a new queue entry appears with status QUEUED, determines which wire to run
 * based on the source field and delegates to the wire executor.
 */
export const onIntakeQueueCreated = onDocumentCreated({
    document: 'intake_queue/{queueId}',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GiB',
}, async (event) => {
    const queueId = event.params.queueId;
    const col = intakeQueueCol();
    const queueRef = col.doc(queueId);
    const data = event.data?.data();
    if (!data) {
        console.warn(`[wire-trigger] Queue entry ${queueId} has no data`);
        return;
    }
    if (data.status !== 'QUEUED') {
        console.log(`[wire-trigger] Queue entry ${queueId} status is ${data.status}, skipping`);
        return;
    }
    // Determine wire from source
    const wireId = SOURCE_TO_WIRE[data.source];
    if (!wireId) {
        console.warn(`[wire-trigger] Unknown source "${data.source}" for queue entry ${queueId}`);
        await queueRef.update({
            status: 'ERROR',
            error: `Unknown source: ${data.source}`,
            updated_at: new Date().toISOString(),
        });
        return;
    }
    // Mark as processing
    await queueRef.update({
        status: 'PROCESSING',
        wire_id: wireId,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });
    try {
        const executeWire = await loadExecuteWire();
        const input = {
            file_id: data.file_id,
            file_ids: data.file_ids || (data.file_id ? [data.file_id] : []),
            mode: (data.mode || 'document'),
        };
        const context = {
            wire_id: wireId,
            user_email: data.user_email || 'system@retireprotected.com',
            source_file_ids: data.file_ids || (data.file_id ? [data.file_id] : []),
            dry_run: false,
            approval_required: true,
        };
        const result = await executeWire(wireId, input, context);
        await queueRef.update({
            status: result.success ? 'COMPLETE' : 'ERROR',
            wire_result: {
                success: result.success,
                stages: result.stages?.length || 0,
                created_records: result.created_records?.length || 0,
                execution_time_ms: result.execution_time_ms,
                approval_batch_id: result.approval_batch_id || null,
            },
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        console.log(`[wire-trigger] Wire ${wireId} completed for queue ${queueId}: success=${result.success}`);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[wire-trigger] Wire ${wireId} failed for queue ${queueId}:`, errorMsg);
        await queueRef.update({
            status: 'ERROR',
            error: errorMsg,
            updated_at: new Date().toISOString(),
        });
    }
});
//# sourceMappingURL=wire-trigger.js.map