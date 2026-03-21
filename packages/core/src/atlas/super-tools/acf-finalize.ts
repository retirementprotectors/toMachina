// ---------------------------------------------------------------------------
// Super Tool: ACF_FINALIZE
// Routes source files to ACF subfolder after successful wire execution.
// Updates document_index with classification + extraction metadata.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
} from '../types'
import type { WriteOutput, WriteRecord } from './write'

export const definition: SuperToolDefinition = {
  super_tool_id: 'ACF_FINALIZE',
  name: 'ACF Finalize',
  description:
    'Route source file to correct ACF subfolder and update document_index after successful wire execution. Handles MAIL and SPC_INTAKE file moves; ACF_UPLOAD/ACF_SCAN files are already in place.',
  tools: [],
}

/* ─── Input/Output Types ─── */

export interface FinalizeInput {
  batch: WriteRecord[]
  summary: {
    creates: number
    updates: number
    skips: number
    deletes: number
  }
}

export interface FinalizeOutput {
  routed: boolean
  acf_folder_id?: string
  target_subfolder?: string
  document_index_updated: boolean
  source_file_cleaned: boolean
}

/* ─── ACF Subfolder Mapping ─── */

const DOCUMENT_TYPE_TO_SUBFOLDER: Record<string, string> = {
  // Client subfolder
  id_document: 'Client',
  voided_check: 'Client',
  tax_document: 'Client',
  trust_document: 'Client',
  poa_hipaa: 'Client',
  fact_finder: 'Client',
  // NewBiz subfolder
  application_form: 'NewBiz',
  transfer_form: 'NewBiz',
  delivery_receipt: 'NewBiz',
  replacement_form: 'NewBiz',
  suitability: 'NewBiz',
  // Cases subfolder
  illustration: 'Cases',
  comparison: 'Cases',
  proposal: 'Cases',
  analysis: 'Cases',
  // Account subfolder
  statement: 'Account',
  confirmation: 'Account',
  annual_review: 'Account',
  distribution: 'Account',
}

function resolveSubfolder(acfSubfolder?: string, documentType?: string): string {
  if (acfSubfolder) return acfSubfolder
  if (documentType && DOCUMENT_TYPE_TO_SUBFOLDER[documentType]) {
    return DOCUMENT_TYPE_TO_SUBFOLDER[documentType]
  }
  return 'Reactive'
}

/* ─── Context Callback Types ─── */

interface AcfFinalizeContext extends SuperToolContext {
  /** Pre-matched client ID from ACF_UPLOAD or ACF_SCAN */
  client_id?: string
  /** Source channel: MAIL, SPC_INTAKE, ACF_UPLOAD, ACF_SCAN */
  source?: string
  /** Target ACF subfolder override (from classification) */
  acf_subfolder?: string
  /** Document type from classification */
  document_type?: string
  /** Source file ID to move/update */
  file_id?: string
  /** Folder the source file currently lives in */
  source_folder_id?: string
  /** Wire execution ID for audit trail */
  wire_execution_id?: string
  /** Look up a client's ACF folder ID */
  getClientAcfFolder?: (clientId: string) => Promise<{ acf_folder_id?: string }>
  /** Update the document_index entry for a file */
  updateDocumentIndex?: (fileId: string, updates: Record<string, unknown>) => Promise<void>
  /** List subfolders of a given folder */
  listSubfolders?: (folderId: string) => Promise<Array<{ id: string; name: string }>>
  /** Move a file to a target folder (gets current parent automatically) */
  moveFile?: (fileId: string, toFolderId: string, newName?: string) => Promise<void>
}

/* ─── Execute ─── */

export async function execute(
  input: FinalizeInput,
  context: SuperToolContext
): Promise<SuperToolResult<FinalizeOutput>> {
  try {
    const ctx = context as AcfFinalizeContext

    // Step 1: Extract client_id
    let clientId = ctx.client_id
    if (!clientId) {
      const clientRecord = input.batch.find(
        (r: WriteRecord) => r.collection === 'clients' && r.document_id
      )
      if (clientRecord) {
        clientId = clientRecord.document_id
      }
    }

    if (!clientId) {
      return {
        success: true,
        data: {
          routed: false,
          document_index_updated: false,
          source_file_cleaned: false,
        },
      }
    }

    // Step 2: Look up client's ACF folder
    if (!ctx.getClientAcfFolder) {
      return {
        success: true,
        data: {
          routed: false,
          document_index_updated: false,
          source_file_cleaned: false,
        },
      }
    }

    const acfResult = await ctx.getClientAcfFolder(clientId)
    if (!acfResult.acf_folder_id) {
      return {
        success: true,
        data: {
          routed: false,
          document_index_updated: false,
          source_file_cleaned: false,
        },
      }
    }

    const acfFolderId = acfResult.acf_folder_id

    // Step 3: Determine target subfolder
    const targetSubfolder = resolveSubfolder(ctx.acf_subfolder, ctx.document_type)

    // Step 4: Move file for MAIL and SPC_INTAKE sources
    let routed = false
    let sourceCleaned = false
    const source = ctx.source?.toUpperCase()

    if (
      (source === 'MAIL' || source === 'SPC_INTAKE') &&
      ctx.file_id &&
      ctx.source_folder_id &&
      ctx.listSubfolders &&
      ctx.moveFile
    ) {
      // Find the target subfolder within the ACF
      const subfolders = await ctx.listSubfolders(acfFolderId)
      const targetFolder = subfolders.find(
        (sf) => sf.name.toLowerCase() === targetSubfolder.toLowerCase()
      )

      if (targetFolder) {
        await ctx.moveFile(ctx.file_id, targetFolder.id)
        routed = true
        sourceCleaned = true
      }
    } else if (source === 'ACF_UPLOAD' || source === 'ACF_SCAN') {
      // File is already in the ACF — no move needed
      routed = true
    }

    // Step 5: Update document_index (TRK-503)
    let documentIndexUpdated = false
    if (ctx.updateDocumentIndex && ctx.file_id) {
      const updates: Record<string, unknown> = {
        extraction_queued: false,
        classified_at: new Date().toISOString(),
      }
      if (ctx.document_type) {
        updates.document_type = ctx.document_type
      }
      if (ctx.wire_execution_id) {
        updates.wire_execution_id = ctx.wire_execution_id
      }

      await ctx.updateDocumentIndex(ctx.file_id, updates)
      documentIndexUpdated = true
    }

    return {
      success: true,
      data: {
        routed,
        acf_folder_id: acfFolderId,
        target_subfolder: targetSubfolder,
        document_index_updated: documentIndexUpdated,
        source_file_cleaned: sourceCleaned,
      },
      stats: {
        records_in: input.batch.length,
        records_out: routed ? 1 : 0,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error in ACF_FINALIZE'
    return {
      success: false,
      error: `ACF Finalize failed: ${message}`,
    }
  }
}
