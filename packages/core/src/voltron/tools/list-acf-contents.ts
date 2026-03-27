// ─── list_acf_contents — Atomic Tool ──────────────────────────────────────────
// List all files in ACF folder with metadata. Paginated.
// API: Google Drive  |  Entitlement: COORDINATOR
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AcfFileEntry {
  file_id: string
  name: string
  mime_type: string
  created_at: string
  modified_at: string
  size_bytes: number
  web_view_link: string
}

export interface FileListData {
  files: AcfFileEntry[]
  next_page_token?: string
  total_count: number
}

export interface ListAcfContentsInput {
  folder_id: string
  page_token?: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'list_acf_contents',
  name: 'list_acf_contents',
  description: 'List all files in an ACF folder with metadata. Supports pagination via page_token.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'COORDINATOR' as const,
  parameters: {
    type: 'object',
    properties: {
      folder_id: { type: 'string', description: 'The Google Drive folder ID' },
      page_token: { type: 'string', description: 'Optional pagination token for next page' },
    },
    required: ['folder_id'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: ListAcfContentsInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<FileListData>> {
  const start = Date.now()

  try {
    if (!input.folder_id) {
      return {
        success: false,
        error: 'folder_id is required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'list_acf_contents' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const params = new URLSearchParams({ folder_id: input.folder_id })
    if (input.page_token) {
      params.set('page_token', input.page_token)
    }

    const response = await fetch(`${apiBase}/api/drive/acf/contents?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Drive API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'list_acf_contents' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: FileListData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Drive API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'list_acf_contents' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'list_acf_contents' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error listing ACF contents',
      metadata: { duration_ms: Date.now() - start, tool_id: 'list_acf_contents' },
    }
  }
}
