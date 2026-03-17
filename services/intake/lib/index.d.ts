/**
 * Cloud Function exports for intake channel scanning.
 * Each function is triggered by Cloud Scheduler (5-minute interval)
 * or can be called directly via HTTP for manual triggers.
 */
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
 * Queue Dashboard — Get queue depth by status and source.
 * For monitoring and dashboards.
 */
export declare const queueStatus: import("firebase-functions/v2/https").HttpsFunction;
//# sourceMappingURL=index.d.ts.map