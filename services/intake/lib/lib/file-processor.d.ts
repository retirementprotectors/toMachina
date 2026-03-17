/**
 * File type detection and metadata extraction.
 * Determines document category from filename and MIME type.
 */
export interface FileMetadata {
    file_id: string;
    file_name: string;
    file_type: string;
    file_extension: string;
    mime_type: string;
    file_size: number;
    document_category: DocumentCategory;
    is_audio: boolean;
    is_transcript: boolean;
    is_image: boolean;
    is_pdf: boolean;
}
export type DocumentCategory = 'application_form' | 'id_document' | 'financial_statement' | 'insurance_policy' | 'medical_record' | 'correspondence' | 'recording' | 'transcript' | 'photo' | 'spreadsheet' | 'unknown';
/**
 * Extract metadata and classify a file.
 */
export declare function processFile(fileId: string, fileName: string, mimeType: string, fileSize: number): FileMetadata;
/**
 * Extract specialist name from a folder name.
 * SPC folders are named like "John Smith" or "Smith, John".
 */
export declare function extractSpecialistName(folderName: string): string;
/**
 * Generate a content preview from a filename (for queue display).
 */
export declare function generateContentPreview(fileName: string, category: DocumentCategory): string;
//# sourceMappingURL=file-processor.d.ts.map