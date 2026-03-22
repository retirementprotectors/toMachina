/**
 * Shared intake queue management — Firestore `intake_queue` collection.
 * Status flow: QUEUED → EXTRACTING → REVIEWING → APPROVED → WRITING → COMPLETE
 */
export type QueueStatus = 'QUEUED' | 'EXTRACTING' | 'REVIEWING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'WRITING' | 'COMPLETE' | 'ERROR' | 'SKIPPED';
export type IntakeSource = 'SPC_INTAKE' | 'COMMISSION' | 'MEET_TRANSCRIPT' | 'MAIL' | 'EMAIL';
export interface QueueEntry {
    queue_id: string;
    source: IntakeSource;
    file_id: string;
    file_name: string;
    file_type: string;
    file_size?: number;
    status: QueueStatus;
    specialist_name?: string;
    document_type?: string;
    content_preview?: string;
    extracted_data?: Record<string, unknown> | null;
    approval_batch_id?: string | null;
    meet_event_id?: string | null;
    email_from?: string;
    email_subject?: string;
    email_priority?: 'high' | 'normal' | 'low';
    /** Folder the source file currently resides in (for post-wire moves) */
    source_folder_id?: string;
    /** Processed folder ID (ACF_FINALIZE moves here on success) */
    processed_folder_id?: string;
    /** Errors folder ID (error handler moves here on wire failure) */
    errors_folder_id?: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
}
/**
 * Create a new queue entry for an incoming file/document.
 */
export declare function createQueueEntry(source: IntakeSource, fileData: {
    file_id: string;
    file_name: string;
    file_type: string;
    file_size?: number;
    specialist_name?: string;
    document_type?: string;
    content_preview?: string;
    meet_event_id?: string;
    email_from?: string;
    email_subject?: string;
    email_priority?: 'high' | 'normal' | 'low';
    source_folder_id?: string;
    processed_folder_id?: string;
    errors_folder_id?: string;
}): Promise<QueueEntry>;
/**
 * Check if a file is already queued (prevent duplicates).
 */
export declare function isFileQueued(fileId: string): Promise<boolean>;
/**
 * Update queue entry status with transition validation.
 */
export declare function updateQueueStatus(queueId: string, status: QueueStatus, extra?: Record<string, unknown>): Promise<void>;
/**
 * Get queue depth grouped by status.
 */
export declare function getQueueDepth(): Promise<Record<QueueStatus, number>>;
/**
 * Get queue depth grouped by source.
 */
export declare function getQueueDepthBySource(): Promise<Record<IntakeSource, number>>;
/**
 * Get next pending queue entry (oldest QUEUED).
 */
export declare function getNextPending(): Promise<QueueEntry | null>;
/**
 * Get all entries for a given source with status filter.
 */
export declare function getQueueEntries(source?: IntakeSource, status?: QueueStatus, limit?: number): Promise<QueueEntry[]>;
/**
 * Store the last scan timestamp for a given channel.
 */
export declare function setLastScanTime(channel: IntakeSource, timestamp: string): Promise<void>;
/**
 * Get the last scan timestamp for a given channel.
 */
export declare function getLastScanTime(channel: IntakeSource): Promise<string | null>;
//# sourceMappingURL=queue.d.ts.map