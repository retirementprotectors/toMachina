/**
 * MAIL — Physical mail scan intake.
 * Scans MAIL_INTAKE/Incoming folder for scanned documents.
 * Files stay in Incoming until ACF_FINALIZE moves them after successful wire.
 * On scanner error (before queuing), files move to Errors.
 */
export interface MailScanResult {
    success: boolean;
    new_files: number;
    skipped_duplicates: number;
    moved_to_errors: number;
    errors: string[];
}
/**
 * Scan MAIL_INTAKE/Incoming for new scanned documents.
 * Files remain in Incoming — ACF_FINALIZE handles post-wire routing.
 * Only scanner-level errors move files to the Errors folder.
 */
export declare function scanMailIntake(): Promise<MailScanResult>;
//# sourceMappingURL=mail-intake.d.ts.map