/**
 * Cloud Function exports for intake channel scanning.
 * Each function is triggered by Cloud Scheduler (5-minute interval)
 * or can be called directly via HTTP for manual triggers.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onClientWrite, onAccountWrite } from './notification-triggers.js';
import { onIntakeQueueCreated } from './wire-trigger.js';
import { scanSpcFolders } from './spc-intake.js';
import { scanMeetRecordings } from './meet-intake.js';
import { scanMailIntake } from './mail-intake.js';
import { scanEmailInboxes } from './email-intake.js';
import { scanCommissionIntake } from './commission-intake.js';
import { getQueueDepth, getQueueDepthBySource } from './queue.js';
// Initialize Firebase Admin
if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' });
}
/**
 * SPC Intake — Scan specialist Drive folders for new documents.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export const spcIntake = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async (_req, res) => {
    const result = await scanSpcFolders();
    console.log(`SPC Intake: ${result.new_files} new, ${result.skipped_duplicates} dupes, ${result.errors.length} errors`);
    res.json({ success: result.success, data: result });
});
/**
 * SPC Intake — Scheduled version (5-minute interval).
 */
export const spcIntakeScheduled = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async () => {
    const result = await scanSpcFolders();
    console.log(`SPC Intake (scheduled): ${result.new_files} new, ${result.errors.length} errors`);
});
/**
 * Meet Intake — Scan Google Meet recordings folder.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export const meetIntake = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async (_req, res) => {
    const result = await scanMeetRecordings();
    console.log(`Meet Intake: ${result.new_recordings} recordings, ${result.new_transcripts} transcripts`);
    res.json({ success: result.success, data: result });
});
export const meetIntakeScheduled = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async () => {
    const result = await scanMeetRecordings();
    console.log(`Meet Intake (scheduled): ${result.new_recordings} recordings, ${result.errors.length} errors`);
});
/**
 * Mail Intake — Scan physical mail scan folder.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export const mailIntake = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async (_req, res) => {
    const result = await scanMailIntake();
    console.log(`Mail Intake: ${result.new_files} new, ${result.skipped_duplicates} skipped`);
    res.json({ success: result.success, data: result });
});
export const mailIntakeScheduled = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async () => {
    const result = await scanMailIntake();
    console.log(`Mail Intake (scheduled): ${result.new_files} new, ${result.errors.length} errors`);
});
/**
 * Email Intake — Scan configured email inboxes.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export const emailIntake = onRequest({ region: 'us-central1', timeoutSeconds: 180, memory: '512MiB' }, async (_req, res) => {
    const result = await scanEmailInboxes();
    console.log(`Email Intake: ${result.attachments_queued} attachments from ${result.inboxes_scanned} inboxes`);
    res.json({ success: result.success, data: result });
});
export const emailIntakeScheduled = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 180, memory: '512MiB' }, async () => {
    const result = await scanEmailInboxes();
    console.log(`Email Intake (scheduled): ${result.attachments_queued} attachments, ${result.errors.length} errors`);
});
/**
 * Commission Intake — Scan commission statement folder for XLSX/CSV/PDF files.
 * Trigger: Cloud Scheduler every 5 minutes.
 */
export const commissionIntake = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async (_req, res) => {
    const result = await scanCommissionIntake();
    console.log(`Commission Intake: ${result.new_files} new, ${result.moved_to_processed} processed`);
    res.json({ success: result.success, data: result });
});
export const commissionIntakeScheduled = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 120, memory: '256MiB' }, async () => {
    const result = await scanCommissionIntake();
    console.log(`Commission Intake (scheduled): ${result.new_files} new, ${result.errors.length} errors`);
});
/**
 * Queue Dashboard — Get queue depth by status and source.
 * For monitoring and dashboards.
 */
export const queueStatus = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '128MiB' }, async (_req, res) => {
    const [byStatus, bySource] = await Promise.all([getQueueDepth(), getQueueDepthBySource()]);
    res.json({ success: true, data: { by_status: byStatus, by_source: bySource } });
});
/**
 * Notification Triggers — create notification docs on client/account writes.
 */
export { onClientWrite, onAccountWrite };
/**
 * Wire Trigger — process intake_queue entries through wire executor.
 * Firestore onCreate on intake_queue/{queueId}.
 * Maps source field to wire ID and calls executeWire().
 */
export { onIntakeQueueCreated };
//# sourceMappingURL=index.js.map