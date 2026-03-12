/**
 * SPC_INTAKE — Specialist Drive folder scanner.
 * Scans subfolders under SPC_INTAKE_FOLDER for new files.
 * Each subfolder = one specialist (folder name = specialist name).
 */
export interface SpcScanResult {
    success: boolean;
    scanned_folders: number;
    new_files: number;
    skipped_duplicates: number;
    errors: string[];
}
/**
 * Scan all SPC specialist folders for new files since last scan.
 */
export declare function scanSpcFolders(): Promise<SpcScanResult>;
//# sourceMappingURL=spc-intake.d.ts.map