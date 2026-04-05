/**
 * DRIVE FOLDER WATCH — Ranger-aware intake channel (ZRD-O10).
 * Monitors a designated intake folder on Shared Drive.
 * New files → SUPER_INTROSPECT identifies format → routes to correct Ranger.
 * Processed files moved to "Processed" subfolder; failures to "Failed".
 */
import { listFolderFiles, listSubfolders, moveFile } from './lib/drive-scanner.js';
import { isFileQueued } from './queue.js';
/** Designated MEGAZORD intake folder on Shared Drive */
const MEGAZORD_INTAKE_FOLDER_ID = process.env.MEGAZORD_INTAKE_FOLDER_ID || '1_MEGAZORD_INTAKE_PLACEHOLDER';
/** File extensions supported by Rangers */
const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf', '.tsv'];
/** Commission-related filename patterns */
const COMMISSION_PATTERNS = [/commission/i, /statement/i, /comp[\s_-]?report/i, /revenue/i];
/** Reference data filename patterns */
const REFERENCE_PATTERNS = [/carrier/i, /product/i, /naic/i, /rate[\s_-]?table/i, /reference/i];
/**
 * Determine which Ranger should process a file based on filename and content hints.
 */
function routeFile(filename, mimeType) {
    const lower = filename.toLowerCase();
    // PDF documents → correspondence ranger
    if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
        return { rangerId: 'ranger-correspondence', mode: 'document' };
    }
    // Commission patterns
    if (COMMISSION_PATTERNS.some((p) => p.test(lower))) {
        return { rangerId: 'ranger-commission', mode: 'commission' };
    }
    // Reference data patterns
    if (REFERENCE_PATTERNS.some((p) => p.test(lower))) {
        return { rangerId: 'ranger-reference', mode: 'csv' };
    }
    // Default: data import ranger
    return { rangerId: 'ranger-import', mode: 'csv' };
}
/**
 * Find subfolder ID by name within a parent folder.
 */
async function findSubfolderId(parentId, name) {
    const subs = await listSubfolders(parentId);
    const match = subs.find((s) => s.name.toLowerCase() === name.toLowerCase());
    return match?.id || null;
}
/**
 * Check if a filename has a supported extension.
 */
function isSupportedFile(filename) {
    const lower = filename.toLowerCase();
    return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
/**
 * Scan MEGAZORD intake folder for new files and dispatch to appropriate Rangers.
 * Files are routed based on filename patterns and file type:
 *   - Commission CSV → ranger-commission
 *   - Reference CSV → ranger-reference
 *   - PDF → ranger-correspondence
 *   - Default CSV → ranger-import
 */
export async function scanDriveIntake() {
    const result = {
        success: true,
        files_found: 0,
        files_routed: 0,
        files_failed: 0,
        files_skipped: 0,
        routing_summary: [],
        errors: [],
    };
    try {
        // Find the Incoming subfolder
        const incomingFolderId = await findSubfolderId(MEGAZORD_INTAKE_FOLDER_ID, 'Incoming');
        if (!incomingFolderId) {
            result.errors.push('Incoming subfolder not found in MEGAZORD intake folder');
            result.success = false;
            return result;
        }
        // List files in Incoming
        const files = await listFolderFiles(incomingFolderId);
        result.files_found = files.length;
        if (files.length === 0)
            return result;
        // Find Processed and Failed subfolders for post-processing
        const processedFolderId = await findSubfolderId(MEGAZORD_INTAKE_FOLDER_ID, 'Processed');
        const failedFolderId = await findSubfolderId(MEGAZORD_INTAKE_FOLDER_ID, 'Failed');
        for (const file of files) {
            const filename = file.name || 'unknown';
            // Skip unsupported file types
            if (!isSupportedFile(filename)) {
                result.files_skipped++;
                result.routing_summary.push({ filename, rangerId: 'none', status: 'unsupported' });
                continue;
            }
            // Skip already-queued files (dedup)
            const alreadyQueued = await isFileQueued(file.id);
            if (alreadyQueued) {
                result.files_skipped++;
                result.routing_summary.push({ filename, rangerId: 'none', status: 'duplicate' });
                continue;
            }
            try {
                // Route to appropriate Ranger
                const routing = routeFile(filename, file.mimeType || '');
                // Dispatch via Ranger Orchestration API
                const apiUrl = process.env.TM_API_URL || 'http://localhost:8080';
                const dispatchRes = await fetch(`${apiUrl}/api/rangers/dispatch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-mdj-auth': process.env.MDJ_AUTH_SECRET || '',
                    },
                    body: JSON.stringify({
                        rangerId: routing.rangerId,
                        fileId: file.id,
                        mode: routing.mode,
                    }),
                });
                const dispatchJson = (await dispatchRes.json());
                if (dispatchJson.success) {
                    result.files_routed++;
                    result.routing_summary.push({ filename, rangerId: routing.rangerId, status: 'dispatched' });
                    // Move to Processed subfolder
                    if (processedFolderId) {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        await moveFile(file.id, processedFolderId, `${timestamp}_${filename}`);
                    }
                }
                else {
                    throw new Error(dispatchJson.error || 'Dispatch failed');
                }
            }
            catch (err) {
                result.files_failed++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                result.errors.push(`${filename}: ${errorMsg}`);
                result.routing_summary.push({ filename, rangerId: 'error', status: errorMsg });
                // Move to Failed subfolder
                if (failedFolderId) {
                    try {
                        await moveFile(file.id, failedFolderId, filename);
                    }
                    catch { /* move error is secondary */ }
                }
            }
        }
        // Last scan tracked via Firestore intake_config (MEGAZORD channel)
        // Note: IntakeSource enum doesn't include MEGAZORD_DRIVE_WATCH yet —
        // will be added when this channel goes live in production
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(errorMsg);
        result.success = false;
    }
    return result;
}
//# sourceMappingURL=drive-watcher.js.map