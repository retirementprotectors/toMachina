// ─── PULL_DOCUMENTS Super Tool ──────────────────────────────────────────────
// Chain: get_client → get_acf_folder → list_acf_contents → return_links
// Output: Structured file list with Drive links by category
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'

// ── Result Types ────────────────────────────────────────────────────────────

interface AcfFile {
  file_id: string
  name: string
  mime_type: string
  created_at: string
  modified_at: string
  size_bytes: number
  web_view_link: string
  folder_path: string
}

interface DocumentCategory {
  category: string
  files: AcfFile[]
  count: number
}

interface PullDocumentsResult {
  client_id: string
  client_name: string
  documents: AcfFile[]
  categories: Record<string, DocumentCategory>
  total_files: number
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'PULL_DOCUMENTS',
  name: 'Pull Documents',
  description: 'Retrieves all client documents from ACF folders with metadata and Drive links.',
  tools: ['get_client', 'get_acf_folder', 'list_acf_contents', 'return_links'],
  entitlement_min: 'COORDINATOR',
}

// ── TM API Helper ───────────────────────────────────────────────────────────

async function callApi<T>(
  path: string,
  toolId: string,
  start: number,
): Promise<VoltronToolResult<T>> {
  const apiBase = process.env.TOMACHINA_API_URL ?? ''
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `API ${path} returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: T; error?: string }
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? `API error on ${path}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: toolId },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : `Failed to call ${path}`,
      metadata: { duration_ms: Date.now() - start, tool_id: toolId },
    }
  }
}

// ── Category Classification ─────────────────────────────────────────────────

function classifyDocument(fileName: string, mimeType: string): string {
  const lower = fileName.toLowerCase()
  if (lower.includes('illustration') || lower.includes('quote')) return 'Illustrations'
  if (lower.includes('application') || lower.includes('app_')) return 'Applications'
  if (lower.includes('casework')) return 'Casework'
  if (lower.includes('policy') || lower.includes('contract')) return 'Policies'
  if (lower.includes('id') || lower.includes('license') || lower.includes('passport')) return 'Identification'
  if (lower.includes('meeting') || lower.includes('agenda') || lower.includes('review')) return 'Meeting Notes'
  if (mimeType.startsWith('image/')) return 'Images'
  if (mimeType === 'application/pdf') return 'PDFs'
  return 'Other'
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<PullDocumentsResult>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []

  try {
    // ── Stage 1: Get client profile ───────────────────────────────────
    const clientResult = await callApi<{ id: string; first_name: string; last_name: string }>(
      `/api/clients/${encodeURIComponent(input.client_id)}`,
      'get_client',
      start,
    )
    toolResults.push(clientResult)
    const clientName = clientResult.data
      ? `${clientResult.data.first_name} ${clientResult.data.last_name}`
      : input.client_id

    // ── Stage 2: Get ACF folder info ──────────────────────────────────
    const folderResult = await callApi<{ folder_id: string; folder_name: string }>(
      `/api/drive/acf/${encodeURIComponent(input.client_id)}`,
      'get_acf_folder',
      start,
    )
    toolResults.push(folderResult)

    // ── Stage 3: List ACF contents ────────────────────────────────────
    const filesResult = await callApi<AcfFile[]>(
      `/api/drive/acf/${encodeURIComponent(input.client_id)}/files`,
      'list_acf_contents',
      start,
    )
    toolResults.push(filesResult)
    const files = filesResult.data ?? []

    // ── Stage 4: Organize by category and return links ────────────────
    const categories: Record<string, DocumentCategory> = {}
    for (const file of files) {
      const cat = classifyDocument(file.name, file.mime_type)
      if (!categories[cat]) {
        categories[cat] = { category: cat, files: [], count: 0 }
      }
      categories[cat].files.push(file)
      categories[cat].count++
    }

    const result: PullDocumentsResult = {
      client_id: input.client_id,
      client_name: clientName,
      documents: files,
      categories,
      total_files: files.length,
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    toolResults.push({
      success: true,
      data: result,
      metadata: { duration_ms: Date.now() - start, tool_id: 'return_links' },
    })

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: {
        stages_completed: 4,
        stages_total: 4,
        total_files: files.length,
        categories: Object.keys(categories).length,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      tool_results: toolResults,
      duration_ms: Date.now() - start,
    }
  }
}
