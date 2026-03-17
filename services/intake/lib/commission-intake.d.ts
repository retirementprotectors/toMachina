/**
 * COMMISSION — Commission PDF/XLSX intake channel.
 * Scans COMMISSION_INTAKE/Incoming folder for carrier commission statements.
 * After queuing, moves files to Processed; on error, moves to Errors.
 */
export interface CommissionScanResult {
    success: boolean;
    new_files: number;
    moved_to_processed: number;
    moved_to_errors: number;
    skipped_duplicates: number;
    skipped_unsupported: number;
    errors: string[];
}
/**
 * Scan COMMISSION_INTAKE/Incoming for new commission statement files.
 * Queues supported files (XLSX, CSV, PDF) and moves them to Processed.
 * Unsupported file types are skipped. Errored files go to Errors subfolder.
 */
export declare function scanCommissionIntake(): Promise<CommissionScanResult>;
//# sourceMappingURL=commission-intake.d.ts.map