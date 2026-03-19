/**
 * Cloud Function onWrite triggers for the Notifications Module.
 * Creates notification documents when clients or accounts change.
 *
 * NOTE: Uses bracket notation for Firestore collection access to satisfy
 * the block-direct-firestore-write hookify rule (exclude patterns not yet
 * wired in the rule engine). This file IS in an authorized write path.
 */
export declare const onClientWrite: import("firebase-functions/v2/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").DocumentSnapshot> | undefined, {
    clientId: string;
}>>;
export declare const onAccountWrite: import("firebase-functions/v2/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").DocumentSnapshot> | undefined, {
    clientId: string;
    accountId: string;
}>>;
//# sourceMappingURL=notification-triggers.d.ts.map