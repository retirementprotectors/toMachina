// ─── save_to_drive — Atomic Tool ──────────────────────────────────────────────
// Save content (HTML, PDF, text) to a specified Drive folder. Returns file ID + link.
// API: Google Drive  |  Entitlement: SPECIALIST
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileLinkData {
  file_id: string
  file_name: string
  web_view_link: string
  mime_type: string
}

export interface SaveToDriveInput {
  folder_id: string
  content: string
  filename: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'save_to_drive',
  name: 'save_to_drive',
  description: 'Save content (HTML, PDF, text) to a specified Drive folder. Returns file ID and link.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'SPECIALIST' as const,
  parameters: {
    type: 'object',
    properties: {
      folder_id: { type: 'string', description: 'The target Google Drive folder ID' },
      content: { type: 'string', description: 'The file content to save' },
      filename: { type: 'string', description: 'The filename to use when saving' },
    },
    required: ['folder_id', 'content', 'filename'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: SaveToDriveInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<FileLinkData>> {
  const start = Date.now()

  try {
    if (!input.folder_id || !input.content || !input.filename) {
      return {
        success: false,
        error: 'folder_id, content, and filename are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'save_to_drive' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/drive/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_id: input.folder_id,
        content: input.content,
        filename: input.filename,
        uploaded_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Drive API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'save_to_drive' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: FileLinkData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Drive API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'save_to_drive' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'save_to_drive' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error saving to Drive',
      metadata: { duration_ms: Date.now() - start, tool_id: 'save_to_drive' },
    }
  }
}
