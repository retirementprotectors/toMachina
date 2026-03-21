// ---------------------------------------------------------------------------
// Super Tool: PREPARE
// Downloads file from Drive, converts PDF → page images via pdftoppm.
// Bridges the gap between intake_queue (file_id) and SUPER_CLASSIFY (image_paths).
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
} from '../types'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_PREPARE',
  name: 'File Download + PDF-to-Image Conversion',
  description:
    'Downloads a file from Google Drive, converts PDF pages to PNG images using pdftoppm, and loads the document taxonomy. Produces the image_paths array that SUPER_CLASSIFY expects.',
  tools: ['download-file', 'pdf-to-images', 'load-taxonomy'],
}

/* ─── Input/Output Types ─── */

export interface PrepareInput {
  file_id?: string
  file_ids?: string[]
  mode: 'document' | 'csv' | 'commission'
  _meta?: {
    file_name?: string
    client_id?: string
    source?: string
    mime_type?: string
  }
}

export interface PrepareOutput {
  image_paths: string[]
  file_name: string
  file_path: string
  taxonomy_types: Array<{ document_type: string; pipeline?: string; owner_role?: string }>
  source_file_id: string
  client_id?: string
  source?: string
}

/* ─── Execute ─── */

export async function execute(
  input: PrepareInput,
  context: SuperToolContext
): Promise<SuperToolResult<PrepareOutput>> {
  const toolResults: Record<string, { success: boolean; processed?: number; passed?: number; error?: string }> = {}

  try {
    // Resolve file_id
    const fileId = input.file_ids?.[0] ?? input.file_id
    if (!fileId) {
      return { success: false, error: 'No file_id or file_ids provided' }
    }

    // Verify downloadFile callback is available
    if (!context.downloadFile) {
      return { success: false, error: 'downloadFile callback not provided — SUPER_PREPARE requires Cloud Run context' }
    }

    // Create temp directory
    const fs = await import('fs')
    const path = await import('path')
    const tmpDir = `/tmp/wire-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    fs.mkdirSync(tmpDir, { recursive: true })

    // Store tmp_dir on context for cleanup
    context.tmp_dir = tmpDir

    // ──── Step 1: Download file from Drive ────
    const downloaded = await context.downloadFile(fileId)

    toolResults['download-file'] = {
      success: true,
      processed: 1,
      passed: 1,
    }

    const fileName = input._meta?.file_name ?? downloaded.name
    const mimeType = downloaded.mimeType
    const localFilePath = path.join(tmpDir, fileName)

    // Save buffer to temp dir
    fs.writeFileSync(localFilePath, downloaded.buffer)

    // ──── Step 2: Convert to page images ────
    let imagePaths: string[] = []

    const isPdf = mimeType.includes('pdf')
    const isImage = mimeType.startsWith('image/')
    // Google-native files are already exported to PDF by downloadFile (drive-client.ts exportMap)
    const isExportedPdf = mimeType.includes('pdf') && !isImage

    if (isPdf || isExportedPdf) {
      // PDF → PNG via pdftoppm
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      const pagePrefix = path.join(tmpDir, 'page')

      await execFileAsync('pdftoppm', [
        '-png',
        '-r', '150',
        '-scale-to', '1568',
        localFilePath,
        pagePrefix,
      ])

      // List all .png files sorted by name
      const files = fs.readdirSync(tmpDir)
        .filter((f: string) => f.endsWith('.png'))
        .sort()
        .map((f: string) => path.join(tmpDir, f))

      imagePaths = files

      toolResults['pdf-to-images'] = {
        success: true,
        processed: 1,
        passed: files.length,
      }
    } else if (isImage) {
      // Image file — use directly
      imagePaths = [localFilePath]

      toolResults['pdf-to-images'] = {
        success: true,
        processed: 1,
        passed: 1,
      }
    } else {
      // Unsupported file type for image conversion
      toolResults['pdf-to-images'] = {
        success: false,
        processed: 1,
        passed: 0,
        error: `Unsupported mimeType for image conversion: ${mimeType}`,
      }

      return {
        success: false,
        error: `Cannot convert mimeType "${mimeType}" to images — expected PDF or image`,
        tool_results: toolResults,
      }
    }

    if (imagePaths.length === 0) {
      return {
        success: false,
        error: 'pdftoppm produced no output images',
        tool_results: toolResults,
      }
    }

    // ──── Step 3: Load taxonomy ────
    let taxonomyTypes: Array<{ document_type: string; pipeline?: string; owner_role?: string }> = []

    if (context.loadTaxonomy) {
      taxonomyTypes = await context.loadTaxonomy()

      toolResults['load-taxonomy'] = {
        success: true,
        processed: 1,
        passed: taxonomyTypes.length,
      }
    } else {
      // No taxonomy callback — return empty (SUPER_CLASSIFY will handle)
      toolResults['load-taxonomy'] = {
        success: true,
        processed: 0,
        passed: 0,
      }
    }

    // Propagate context fields for downstream super tools
    context.source_file_id = fileId
    if (input._meta?.client_id) context.client_id = input._meta.client_id
    if (input._meta?.source) context.source = input._meta.source

    const output: PrepareOutput = {
      image_paths: imagePaths,
      file_name: fileName,
      file_path: localFilePath,
      taxonomy_types: taxonomyTypes,
      source_file_id: fileId,
      client_id: input._meta?.client_id,
      source: input._meta?.source,
    }

    return {
      success: true,
      data: output,
      tool_results: toolResults,
      stats: {
        records_in: 1,
        records_out: imagePaths.length,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error in SUPER_PREPARE'
    return {
      success: false,
      error: message,
      tool_results: toolResults,
    }
  }
}
