/**
 * SPC_INTAKE — Specialist Drive folder scanner.
 * Scans subfolders under SPC_INTAKE_FOLDER for new files.
 * Each subfolder = one specialist (folder name = specialist name).
 * Files stay in place until ACF_FINALIZE moves them after successful wire.
 */
import { listFolderFiles, listSubfolders, getOrCreateSubfolder } from './lib/drive-scanner.js';
import { processFile, extractSpecialistName, generateContentPreview } from './lib/file-processor.js';
import { createQueueEntry, isFileQueued, getLastScanTime, setLastScanTime } from './queue.js';
const SPC_INTAKE_FOLDER_ID = '1NczjcEifjXuc2uMBN70lHE_ZbtmeFOaU';
/**
 * Scan all SPC specialist folders for new files since last scan.
 * Files remain in the specialist folder — ACF_FINALIZE handles post-wire routing.
 */
export async function scanSpcFolders() {
    const result = {
        success: true,
        scanned_folders: 0,
        new_files: 0,
        skipped_duplicates: 0,
        errors: [],
    };
    try {
        const lastScan = await getLastScanTime('SPC_INTAKE');
        const subfolders = await listSubfolders(SPC_INTAKE_FOLDER_ID);
        for (const folder of subfolders) {
            // Skip Processed subfolders themselves
            if (folder.name.toLowerCase() === 'processed')
                continue;
            try {
                result.scanned_folders++;
                const specialistName = extractSpecialistName(folder.name);
                // Lazy-create Processed subfolder within each specialist folder
                const processedFolder = await getOrCreateSubfolder(folder.id, 'Processed');
                const files = await listFolderFiles(folder.id, lastScan || undefined);
                for (const file of files) {
                    // Skip already-queued files
                    const alreadyQueued = await isFileQueued(file.id);
                    if (alreadyQueued) {
                        result.skipped_duplicates++;
                        continue;
                    }
                    const meta = processFile(file.id, file.name, file.mimeType, file.size);
                    await createQueueEntry('SPC_INTAKE', {
                        file_id: file.id,
                        file_name: file.name,
                        file_type: meta.file_extension,
                        file_size: file.size,
                        specialist_name: specialistName,
                        document_type: meta.document_category,
                        content_preview: generateContentPreview(file.name, meta.document_category),
                        source_folder_id: folder.id,
                        processed_folder_id: processedFolder.id,
                    });
                    result.new_files++;
                }
            }
            catch (err) {
                result.errors.push(`Folder "${folder.name}": ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        await setLastScanTime('SPC_INTAKE', new Date().toISOString());
    }
    catch (err) {
        result.success = false;
        result.errors.push(`Root scan error: ${err instanceof Error ? err.message : String(err)}`);
    }
    return result;
}
//# sourceMappingURL=spc-intake.js.map