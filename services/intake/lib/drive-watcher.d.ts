/**
 * DRIVE FOLDER WATCH — Ranger-aware intake channel (ZRD-O10).
 * Monitors a designated intake folder on Shared Drive.
 * New files → SUPER_INTROSPECT identifies format → routes to correct Ranger.
 * Processed files moved to "Processed" subfolder; failures to "Failed".
 */
export interface DriveWatchResult {
    success: boolean;
    files_found: number;
    files_routed: number;
    files_failed: number;
    files_skipped: number;
    routing_summary: Array<{
        filename: string;
        rangerId: string;
        status: string;
    }>;
    errors: string[];
}
/**
 * Scan MEGAZORD intake folder for new files and dispatch to appropriate Rangers.
 * Files are routed based on filename patterns and file type:
 *   - Commission CSV → ranger-commission
 *   - Reference CSV → ranger-reference
 *   - PDF → ranger-correspondence
 *   - Default CSV → ranger-import
 */
export declare function scanDriveIntake(): Promise<DriveWatchResult>;
//# sourceMappingURL=drive-watcher.d.ts.map