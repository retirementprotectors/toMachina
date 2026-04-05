/**
 * SLACK INTAKE — Ranger-aware Slack channel intake (ZRD-O11).
 * Team posts to #megazord-intake with file attachment.
 * MEGAZORD acknowledges, routes to Ranger, posts results back.
 * Supports CSV, XLSX, PDF attachments.
 */
export interface SlackIntakeResult {
    success: boolean;
    files_received: number;
    files_dispatched: number;
    files_queued_review: number;
    errors: string[];
}
export interface SlackFileAttachment {
    id: string;
    name: string;
    mimetype: string;
    size: number;
    url_private_download: string;
}
export interface SlackMessage {
    channel: string;
    user: string;
    text: string;
    files?: SlackFileAttachment[];
    ts: string;
}
/**
 * Process a Slack message from #megazord-intake.
 * Extracts file attachments, routes to Rangers, posts acknowledgments.
 */
export declare function processSlackIntake(message: SlackMessage): Promise<SlackIntakeResult>;
/**
 * Get the channel ID for #megazord-intake.
 */
export declare function getMegazordIntakeChannel(): string;
//# sourceMappingURL=slack-intake.d.ts.map