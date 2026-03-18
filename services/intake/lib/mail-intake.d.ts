/**
 * MAIL — Physical mail scan intake.
 * Scans MAIL_INTAKE/Incoming folder for scanned documents.
 * After queuing, moves files to Processed; on error, moves to Errors.
 */
export interface MailScanResult {
    success: boolean;
    new_files: number;
    moved_to_processed: number;
    moved_to_errors: number;
    skipped_duplicates: number;
    errors: string[];
}
/**
 * Scan MAIL_INTAKE/Incoming for new scanned documents.
 * Moves processed files to Processed subfolder, errored to Errors.
 */
export declare function scanMailIntake(): Promise<MailScanResult>;
//# sourceMappingURL=mail-intake.d.ts.map