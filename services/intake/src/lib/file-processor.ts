/**
 * File type detection and metadata extraction.
 * Determines document category from filename and MIME type.
 */

export interface FileMetadata {
  file_id: string
  file_name: string
  file_type: string
  file_extension: string
  mime_type: string
  file_size: number
  document_category: DocumentCategory
  is_audio: boolean
  is_transcript: boolean
  is_image: boolean
  is_pdf: boolean
}

export type DocumentCategory =
  | 'application_form'
  | 'id_document'
  | 'financial_statement'
  | 'insurance_policy'
  | 'medical_record'
  | 'correspondence'
  | 'recording'
  | 'transcript'
  | 'photo'
  | 'spreadsheet'
  | 'unknown'

const EXTENSION_MAP: Record<string, DocumentCategory> = {
  pdf: 'application_form',
  doc: 'correspondence',
  docx: 'correspondence',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
  jpg: 'photo',
  jpeg: 'photo',
  png: 'photo',
  heic: 'photo',
  tif: 'id_document',
  tiff: 'id_document',
  mp3: 'recording',
  m4a: 'recording',
  wav: 'recording',
  mp4: 'recording',
  webm: 'recording',
  txt: 'transcript',
  vtt: 'transcript',
  srt: 'transcript',
}

const FILENAME_PATTERNS: Array<{ pattern: RegExp; category: DocumentCategory }> = [
  { pattern: /application|app[-_]?form|enrollment/i, category: 'application_form' },
  { pattern: /driver.?licens|passport|id[-_]?card|birth[-_]?cert/i, category: 'id_document' },
  { pattern: /statement|1099|w[-_]?2|tax[-_]?return|k[-_]?1/i, category: 'financial_statement' },
  { pattern: /policy|contract|annuity|declaration|certificate/i, category: 'insurance_policy' },
  { pattern: /medical|health|rx|prescription|diagnosis/i, category: 'medical_record' },
  { pattern: /letter|notice|memo|fax|correspondence/i, category: 'correspondence' },
  { pattern: /recording|audio|call|voicemail/i, category: 'recording' },
  { pattern: /transcript|notes|minutes|summary/i, category: 'transcript' },
]

/**
 * Extract metadata and classify a file.
 */
export function processFile(
  fileId: string,
  fileName: string,
  mimeType: string,
  fileSize: number
): FileMetadata {
  const extension = (fileName.split('.').pop() || '').toLowerCase()
  const isAudio = ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'].includes(extension) ||
    mimeType.startsWith('audio/')
  const isTranscript = ['txt', 'vtt', 'srt'].includes(extension) ||
    /transcript/i.test(fileName)
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'tif', 'tiff', 'bmp', 'webp'].includes(extension) ||
    mimeType.startsWith('image/')
  const isPdf = extension === 'pdf' || mimeType === 'application/pdf'

  // Classify document
  let category: DocumentCategory = EXTENSION_MAP[extension] || 'unknown'

  // Override with filename pattern matching if extension isn't specific enough
  if (category === 'unknown' || category === 'correspondence' || category === 'application_form') {
    for (const { pattern, category: patternCategory } of FILENAME_PATTERNS) {
      if (pattern.test(fileName)) {
        category = patternCategory
        break
      }
    }
  }

  return {
    file_id: fileId,
    file_name: fileName,
    file_type: extension,
    file_extension: extension,
    mime_type: mimeType,
    file_size: fileSize,
    document_category: category,
    is_audio: isAudio,
    is_transcript: isTranscript,
    is_image: isImage,
    is_pdf: isPdf,
  }
}

/**
 * Extract specialist name from a folder name.
 * SPC folders are named like "John Smith" or "Smith, John".
 */
export function extractSpecialistName(folderName: string): string {
  // Handle "Last, First" format
  if (folderName.includes(',')) {
    const [last, first] = folderName.split(',').map(s => s.trim())
    return `${first} ${last}`
  }
  return folderName.trim()
}

/**
 * Generate a content preview from a filename (for queue display).
 */
export function generateContentPreview(fileName: string, category: DocumentCategory): string {
  const name = fileName.replace(/\.[^.]+$/, '') // strip extension
  return `${category.replace(/_/g, ' ')} — ${name}`.slice(0, 200)
}
