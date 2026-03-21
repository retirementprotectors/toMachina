/**
 * MAIL — Physical mail scan intake.
 * Scans MAIL_INTAKE/Incoming folder for scanned documents.
 * Files stay in Incoming until ACF_FINALIZE moves them after successful wire.
 * On scanner error (before queuing), files move to Errors.
 */

import { listFolderFiles, listSubfolders } from './lib/drive-scanner.js'
import { processFile, generateContentPreview } from './lib/file-processor.js'
import { createQueueEntry, isFileQueued, setLastScanTime } from './queue.js'

const MAIL_INTAKE_FOLDER_ID = '1LV32r7w1k98B0S_zfJoavzpLQgsAB1Dg'

export interface MailScanResult {
  success: boolean
  new_files: number
  skipped_duplicates: number
  moved_to_errors: number
  errors: string[]
}

/**
 * Find subfolder ID by name within a parent folder.
 */
async function findSubfolderId(parentId: string, name: string): Promise<string | null> {
  const subs = await listSubfolders(parentId)
  const match = subs.find(s => s.name.toLowerCase() === name.toLowerCase())
  return match?.id || null
}

/**
 * Scan MAIL_INTAKE/Incoming for new scanned documents.
 * Files remain in Incoming — ACF_FINALIZE handles post-wire routing.
 * Only scanner-level errors move files to the Errors folder.
 */
export async function scanMailIntake(): Promise<MailScanResult> {
  const result: MailScanResult = {
    success: true,
    new_files: 0,
    skipped_duplicates: 0,
    moved_to_errors: 0,
    errors: [],
  }

  try {
    // Find subfolders
    const incomingId = await findSubfolderId(MAIL_INTAKE_FOLDER_ID, 'Incoming')
    const processedId = await findSubfolderId(MAIL_INTAKE_FOLDER_ID, 'Processed')
    const errorsId = await findSubfolderId(MAIL_INTAKE_FOLDER_ID, 'Errors')

    if (!incomingId) {
      result.success = false
      result.errors.push('MAIL_INTAKE/Incoming subfolder not found')
      return result
    }

    const files = await listFolderFiles(incomingId)

    for (const file of files) {
      try {
        const alreadyQueued = await isFileQueued(file.id)
        if (alreadyQueued) {
          result.skipped_duplicates++
          continue
        }

        const meta = processFile(file.id, file.name, file.mimeType, file.size)

        await createQueueEntry('MAIL', {
          file_id: file.id,
          file_name: file.name,
          file_type: meta.file_extension,
          file_size: file.size,
          document_type: meta.document_category,
          content_preview: generateContentPreview(file.name, meta.document_category),
          source_folder_id: incomingId,
          processed_folder_id: processedId ?? undefined,
          errors_folder_id: errorsId ?? undefined,
        })

        result.new_files++
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        result.errors.push(`File "${file.name}": ${errMsg}`)

        // Move to Errors folder on scanner-level failure only
        if (errorsId) {
          try {
            const { moveFile } = await import('./lib/drive-scanner.js')
            await moveFile(file.id, incomingId, errorsId)
            result.moved_to_errors++
          } catch { /* can't move — leave in place */ }
        }
      }
    }

    await setLastScanTime('MAIL', new Date().toISOString())
  } catch (err) {
    result.success = false
    result.errors.push(`Root scan error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return result
}
