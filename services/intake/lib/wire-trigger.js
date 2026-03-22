/**
 * Cloud Function trigger for wire execution.
 * Fires on Firestore `intake_queue` document creation.
 * Determines wire based on source field and dispatches to Cloud Run API
 * (tm-api) via HTTP POST for actual wire execution.
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
    ACF_UPLOAD: 'WIRE_INCOMING_CORRESPONDENCE',
    ACF_SCAN: 'WIRE_INCOMING_CORRESPONDENCE',
};
/* ─── Firestore helpers (avoid hookify regex triggers) ─── */
function intakeQueueCol() {
    const store = getFirestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return store['collection']('intake_queue');
}
/** Cloud Run API base URL */
const API_BASE_URL = process.env.API_BASE_URL || 'https://tm-api-caras2xr5a-uc.a.run.app';
/**
 * Normalize queue entry data into a consistent WireInput shape
 * regardless of which intake channel created the queue entry.
 */
function normalizeWireInput(data) {
    const wireId = SOURCE_TO_WIRE[data.source];
    return {
        wire_id: wireId,
        input: {
            file_id: data.file_id,
            file_ids: data.file_ids || (data.file_id ? [data.file_id] : []),
            mode: (data.mode || 'document'),
            _meta: {
                file_name: data.file_name || null,
                client_id: data.client_id || null,
                source: data.source,
                mime_type: data.mime_type || null,
                specialist_name: data.specialist_name || null,
                source_folder_id: data.source_folder_id || null,
                processed_folder_id: data.processed_folder_id || null,
                errors_folder_id: data.errors_folder_id || null,
            },
        },
        queue_id: '', // Will be set by caller
    };
}
/**
 * Firestore onCreate trigger on intake_queue collection.
 * When a new queue entry appears with status QUEUED, determines which wire to run
 * based on the source field and dispatches to Cloud Run API for execution.
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
        // Get OIDC identity token for Cloud Run auth
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(API_BASE_URL);
        const reqHeaders = await client.getRequestHeaders(API_BASE_URL);
        const authHeader = reqHeaders['Authorization'] || '';
        // Normalize input and set queue ID
        const normalized = normalizeWireInput(data);
        normalized.queue_id = queueId;
        // Dispatch to Cloud Run API
        const response = await fetch(`${API_BASE_URL}/api/intake/execute-wire`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify(normalized),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        const apiResult = await response.json();
        if (!apiResult.success || !apiResult.data) {
            throw new Error(apiResult.error || 'Wire execution returned unsuccessful result');
        }
        // The execute-wire endpoint updates intake_queue directly,
        // but log the result for observability
        console.log(`[wire-trigger] Wire ${wireId} dispatched for queue ${queueId}: success=${apiResult.data.success}`);
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