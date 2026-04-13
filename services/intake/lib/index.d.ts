/**
 * Cloud Function exports for intake channel scanning.
 * Each function is triggered by Cloud Scheduler (5-minute interval)
 * or can be called directly via HTTP for manual triggers.
 */
import { onClientWrite, onAccountWrite } from './notification-triggers.js';
import { onPartnerUserCreate, refreshPartnerClaims } from './onPartnerUserCreate.js';
import { onIntakeQueueCreated } from './wire-trigger.js';
/**
 * SPC Intake — Scan specialist Drive folders for new documents.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export declare const spcIntake: import("firebase-functions/v2/https").HttpsFunction;
/**
 * SPC Intake — Scheduled version (5-minute interval).
 */
export declare const spcIntakeScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Meet Intake — Scan Google Meet recordings folder.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export declare const meetIntake: import("firebase-functions/v2/https").HttpsFunction;
export declare const meetIntakeScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Mail Intake — Scan physical mail scan folder.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export declare const mailIntake: import("firebase-functions/v2/https").HttpsFunction;
export declare const mailIntakeScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Email Intake — Scan configured email inboxes.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export declare const emailIntake: import("firebase-functions/v2/https").HttpsFunction;
export declare const emailIntakeScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Commission Intake — Scan commission statement folder for XLSX/CSV/PDF files.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export declare const commissionIntake: import("firebase-functions/v2/https").HttpsFunction;
export declare const commissionIntakeScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * MEGAZORD Drive Watch — Scan designated intake folder, route to Rangers (ZRD-O10).
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export declare const megazordDriveWatch: import("firebase-functions/v2/https").HttpsFunction;
export declare const megazordDriveWatchScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Queue Dashboard — Get queue depth by status and source.
 * For monitoring and dashboards.
 */
export declare const queueStatus: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Notification Triggers — create notification docs on client/account writes.
 */
export { onClientWrite, onAccountWrite };
/**
 * MT-007: Partner User Create — assign custom claims on new user signup.
 * beforeUserCreated trigger: sets role + partner_id claims based on email domain.
 * refreshPartnerClaims: HTTP trigger for manual claim refresh after partner changes.
 */
export { onPartnerUserCreate, refreshPartnerClaims };
/**
 * Wire Trigger — process intake_queue entries through wire executor.
 * Firestore onCreate on intake_queue/{queueId}.
 * Maps source field to wire ID and calls executeWire().
 */
export { onIntakeQueueCreated };
/**
 * Calendar Busy Sync — BKG-08/09
 * Syncs Google Calendar events to Firestore calendar_busy collection.
 * HTTP trigger for manual runs + scheduled every 30 minutes.
 */
export declare const calendarBusySync: import("firebase-functions/v2/https").HttpsFunction;
export declare const calendarBusySyncScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
//# sourceMappingURL=index.d.ts.map