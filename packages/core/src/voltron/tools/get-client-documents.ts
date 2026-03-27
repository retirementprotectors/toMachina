// ─── get_client_documents — Atomic Tool ───────────────────────────────────────
// List all docs in client ACF folder. Returns file metadata + links.
// API: Google Drive  |  Entitlement: COORDINATOR
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileMetadata {
  file_id: string
  name: string
  mime_type: string
  created_at: string
  modified_at: string
  size_bytes: number
  web_view_link: string
  folder_path: string
}

export interface GetClientDocumentsInput {
  client_id: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'get_client_documents',
  name: 'get_client_documents',
  description: 'List all documents in a client ACF folder. Returns file metadata and Drive links.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'COORDINATOR' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID to fetch documents for' },
    },
    required: ['client_id'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: GetClientDocumentsInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<FileMetadata[]>> {
  const start = Date.now()

  try {
    if (!input.client_id) {
      return {
        success: false,
        error: 'client_id is required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'get_client_documents' },
      }
    }

    // Drive API call to list files in client ACF folder
    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/drive/acf/${encodeURIComponent(input.client_id)}/files`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Drive API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'get_client_documents' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: FileMetadata[]; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Drive API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'get_client_documents' },
      }
    }

    return {
      success: true,
      data: result.data ?? [],
      metadata: { duration_ms: Date.now() - start, tool_id: 'get_client_documents' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching client documents',
      metadata: { duration_ms: Date.now() - start, tool_id: 'get_client_documents' },
    }
  }
}
