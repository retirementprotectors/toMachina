/**
 * EMAIL — Gmail inbox scanning.
 * Reads inbox config from Firestore `email_inbox_config` collection.
 * For each configured inbox: scans for new unread messages since last check.
 */
export interface EmailInboxConfig {
    address: string;
    matrix: string;
    team: string;
    description: string;
    active: boolean;
}
export interface EmailScanResult {
    success: boolean;
    inboxes_scanned: number;
    messages_processed: number;
    attachments_queued: number;
    messages_without_attachments: number;
    skipped_duplicates: number;
    errors: string[];
}
/**
 * Scan all configured email inboxes for new messages with attachments.
 */
export declare function scanEmailInboxes(): Promise<EmailScanResult>;
//# sourceMappingURL=email-intake.d.ts.map