// ─── get_document — Atomic Tool ───────────────────────────────────────────────
// Retrieve single document by Drive file ID. Returns content or download URL.
// API: Google Drive  |  Entitlement: COORDINATOR
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentContent {
  file_id: string
  name: string
  mime_type: string
  content?: string
  download_url?: string
  web_view_link: string
  size_bytes: number
}

export interface GetDocumentInput {
  file_id: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'get_document',
  name: 'get_document',
  description: 'Retrieve a single document by Drive file ID. Returns content or download URL.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'COORDINATOR' as const,
  parameters: {
    type: 'object',
    properties: {
      file_id: { type: 'string', description: 'The Google Drive file ID' },
    },
    required: ['file_id'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: GetDocumentInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<DocumentContent>> {
  const start = Date.now()

  try {
    if (!input.file_id) {
      return {
        success: false,
        error: 'file_id is required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'get_document' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/drive/files/${encodeURIComponent(input.file_id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Drive API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'get_document' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: DocumentContent; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Drive API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'get_document' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'get_document' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching document',
      metadata: { duration_ms: Date.now() - start, tool_id: 'get_document' },
    }
  }
}
