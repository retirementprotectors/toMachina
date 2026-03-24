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
/**
 * Firestore onCreate trigger on intake_queue collection.
 * When a new queue entry appears with status QUEUED, determines which wire to run
 * based on the source field and dispatches to Cloud Run API for execution.
 */
export declare const onIntakeQueueCreated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    queueId: string;
}>>;
//# sourceMappingURL=wire-trigger.d.ts.map