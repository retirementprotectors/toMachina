// ─── create_acf_folder — Atomic Tool ──────────────────────────────────────────
// Create ACF subfolder for new client/agency. Returns folder ID.
// API: Google Drive  |  Entitlement: SPECIALIST
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FolderIdData {
  folder_id: string
  folder_name: string
  web_view_link: string
}

export interface CreateAcfFolderInput {
  client_id: string
  agency_id: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'create_acf_folder',
  name: 'create_acf_folder',
  description: 'Create an ACF subfolder for a new client or agency. Returns folder ID and link.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'SPECIALIST' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID' },
      agency_id: { type: 'string', description: 'The agency ID' },
    },
    required: ['client_id', 'agency_id'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: CreateAcfFolderInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<FolderIdData>> {
  const start = Date.now()

  try {
    if (!input.client_id || !input.agency_id) {
      return {
        success: false,
        error: 'client_id and agency_id are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'create_acf_folder' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/drive/acf/create-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.client_id,
        agency_id: input.agency_id,
        created_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Drive API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'create_acf_folder' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: FolderIdData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Drive API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'create_acf_folder' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'create_acf_folder' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating ACF folder',
      metadata: { duration_ms: Date.now() - start, tool_id: 'create_acf_folder' },
    }
  }
}
