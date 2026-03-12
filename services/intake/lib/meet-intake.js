/**
 * MEET_TRANSCRIPT — Google Meet recording scanner.
 * Scans a subfolder for audio files and transcripts from Google Meet.
 */
import { listFolderFiles, listSubfolders } from './lib/drive-scanner.js';
import { processFile, generateContentPreview } from './lib/file-processor.js';
import { createQueueEntry, isFileQueued, getLastScanTime, setLastScanTime } from './queue.js';
// Meet recordings land in a shared folder — subfolder per meeting
const MEET_RECORDINGS_FOLDER_ID = process.env.MEET_RECORDINGS_FOLDER_ID || '';
/**
 * Scan Meet recordings folder for new audio/transcript files.
 */
export async function scanMeetRecordings() {
    const result = {
        success: true,
        scanned_meetings: 0,
        new_recordings: 0,
        new_transcripts: 0,
        skipped_duplicates: 0,
        errors: [],
    };
    if (!MEET_RECORDINGS_FOLDER_ID) {
        result.success = false;
        result.errors.push('MEET_RECORDINGS_FOLDER_ID not configured');
        return result;
    }
    try {
        const lastScan = await getLastScanTime('MEET_TRANSCRIPT');
        // Meet recordings may be in subfolders (per meeting) or flat
        const subfolders = await listSubfolders(MEET_RECORDINGS_FOLDER_ID);
        const foldersToScan = [
            { id: MEET_RECORDINGS_FOLDER_ID, name: 'root' },
            ...subfolders,
        ];
        for (const folder of foldersToScan) {
            try {
                result.scanned_meetings++;
                const files = await listFolderFiles(folder.id, lastScan || undefined);
                for (const file of files) {
                    const meta = processFile(file.id, file.name, file.mimeType, file.size);
                    // Only process audio/video and transcript files
                    if (!meta.is_audio && !meta.is_transcript)
                        continue;
                    const alreadyQueued = await isFileQueued(file.id);
                    if (alreadyQueued) {
                        result.skipped_duplicates++;
                        continue;
                    }
                    // Extract meeting event ID from folder name if present
                    const meetEventId = folder.name !== 'root' ? folder.name : undefined;
                    await createQueueEntry('MEET_TRANSCRIPT', {
                        file_id: file.id,
                        file_name: file.name,
                        file_type: meta.file_extension,
                        file_size: file.size,
                        document_type: meta.is_audio ? 'recording' : 'transcript',
                        content_preview: generateContentPreview(file.name, meta.document_category),
                        meet_event_id: meetEventId,
                    });
                    if (meta.is_audio)
                        result.new_recordings++;
                    else
                        result.new_transcripts++;
                }
            }
            catch (err) {
                result.errors.push(`Meeting "${folder.name}": ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        await setLastScanTime('MEET_TRANSCRIPT', new Date().toISOString());
    }
    catch (err) {
        result.success = false;
        result.errors.push(`Root scan error: ${err instanceof Error ? err.message : String(err)}`);
    }
    return result;
}
//# sourceMappingURL=meet-intake.js.map