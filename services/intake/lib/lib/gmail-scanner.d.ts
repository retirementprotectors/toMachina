/**
 * Gmail API inbox scanning — replaces GAS GmailApp.
 * Scans configured email inboxes for new messages with attachments.
 */
export interface EmailMessage {
    messageId: string;
    threadId: string;
    from: string;
    subject: string;
    date: string;
    snippet: string;
    attachments: EmailAttachment[];
    labels: string[];
}
export interface EmailAttachment {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
}
/**
 * Scan inbox for unread messages since a given date.
 */
export declare function scanInbox(userId: string, afterDate?: string, maxResults?: number): Promise<EmailMessage[]>;
/**
 * Mark a message as read (remove UNREAD label).
 */
export declare function markAsRead(userId: string, messageId: string): Promise<void>;
/**
 * Get attachment content as base64.
 */
export declare function getAttachment(userId: string, messageId: string, attachmentId: string): Promise<string>;
//# sourceMappingURL=gmail-scanner.d.ts.map