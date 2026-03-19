/**
 * COMMISSION — Commission PDF/XLSX intake channel.
 * Scans COMMISSION_INTAKE/Incoming folder for carrier commission statements.
 * After queuing, moves files to Processed; on error, moves to Errors.
 */

import { listFolderFiles, listSubfolders, moveFile } from './lib/drive-scanner.js'
import { processFile, generateContentPreview } from './lib/file-processor.js'
import { createQueueEntry, isFileQueued, setLastScanTime } from './queue.js'

/** Commission intake folder ID — configured via env or default */
const COMMISSION_INTAKE_FOLDER_ID = process.env.COMMISSION_INTAKE_FOLDER_ID || '1_COMMISSION_INTAKE_PLACEHOLDER'

/** Supported commission file extensions */
const COMMISSION_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf']

export interface CommissionScanResult {
  success: boolean
  new_files: number
  moved_to_processed: number
  moved_to_errors: number
  skipped_duplicates: number
  skipped_unsupported: number
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
 * Check if a filename has a supported commission file extension.
 */
function isCommissionFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return COMMISSION_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/**
 * Scan COMMISSION_INTAKE/Incoming for new commission statement files.
 * Queues supported files (XLSX, CSV, PDF) and moves them to Processed.
 * Unsupported file types are skipped. Errored files go to Errors subfolder.
 */
export async function scanCommissionIntake(): Promise<CommissionScanResult> {
  const result: CommissionScanResult = {
    success: true,
    new_files: 0,
    moved_to_processed: 0,
    moved_to_errors: 0,
    skipped_duplicates: 0,
    skipped_unsupported: 0,
    errors: [],
  }

  try {
    // Find subfolders
    const incomingId = await findSubfolderId(COMMISSION_INTAKE_FOLDER_ID, 'Incoming')
    const processedId = await findSubfolderId(COMMISSION_INTAKE_FOLDER_ID, 'Processed')
    const errorsId = await findSubfolderId(COMMISSION_INTAKE_FOLDER_ID, 'Errors')

    if (!incomingId) {
      result.success = false
      result.errors.push('COMMISSION_INTAKE/Incoming subfolder not found')
      return result
    }

    const files = await listFolderFiles(incomingId)

    for (const file of files) {
      try {
        // Skip unsupported file types
        if (!isCommissionFile(file.name)) {
          result.skipped_unsupported++
          continue
        }

        // Dedup check
        const alreadyQueued = await isFileQueued(file.id)
        if (alreadyQueued) {
          result.skipped_duplicates++
          if (processedId) {
            await moveFile(file.id, incomingId, processedId)
            result.moved_to_processed++
          }
          continue
        }

        const meta = processFile(file.id, file.name, file.mimeType, file.size)

        await createQueueEntry('COMMISSION', {
          file_id: file.id,
          file_name: file.name,
          file_type: meta.file_extension,
          file_size: file.size,
          document_type: 'financial_statement',
          content_preview: generateContentPreview(file.name, 'financial_statement'),
        })

        result.new_files++

        // Move to Processed
        if (processedId) {
          await moveFile(file.id, incomingId, processedId)
          result.moved_to_processed++
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        result.errors.push(`File "${file.name}": ${errMsg}`)

        // Move to Errors folder
        if (errorsId) {
          try {
            await moveFile(file.id, incomingId, errorsId)
            result.moved_to_errors++
          } catch { /* can't move -- leave in place */ }
        }
      }
    }

    await setLastScanTime('COMMISSION', new Date().toISOString())
  } catch (err) {
    result.success = false
    result.errors.push(`Root scan error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return result
}
