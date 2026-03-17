/**
 * MEET_TRANSCRIPT — Google Meet recording scanner.
 * Scans a subfolder for audio files and transcripts from Google Meet.
 */
export interface MeetScanResult {
    success: boolean;
    scanned_meetings: number;
    new_recordings: number;
    new_transcripts: number;
    skipped_duplicates: number;
    errors: string[];
}
/**
 * Scan Meet recordings folder for new audio/transcript files.
 */
export declare function scanMeetRecordings(): Promise<MeetScanResult>;
//# sourceMappingURL=meet-intake.d.ts.map