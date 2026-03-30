// ─── sensei_lookup — Atomic Tool ──────────────────────────────────────────────
// Get SENSEI training content for a specific module.
// Queries /api/sensei/content/:moduleId — returns title, description, screenshots.
// API: SENSEI Content API  |  Entitlement: COORDINATOR
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SenseiTrainingContent {
  module_id: string
  title: string
  description: string
  screenshot_urls: string[]
  last_generated?: string
  template_type: string
}

export interface SenseiLookupInput {
  module_id: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'sensei_lookup',
  name: 'sensei_lookup',
  description:
    'Get SENSEI training content for a platform module. Returns the title, description, and screenshot URLs for the specified module. Use this to answer questions about how to use any part of the platform.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'COORDINATOR' as const,
  parameters: {
    type: 'object',
    properties: {
      module_id: {
        type: 'string',
        description:
          'The module ID to look up training content for (e.g. "contacts", "accounts", "pipeline-studio", "forge", "atlas", "dex", "prozone", "comms", "admin", "households").',
      },
    },
    required: ['module_id'],
  },
  server_only: false,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: SenseiLookupInput,
  _ctx: VoltronContext,
): Promise<VoltronToolResult<SenseiTrainingContent>> {
  const start = Date.now()

  try {
    if (!input.module_id) {
      return {
        success: false,
        error: 'module_id is required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'sensei_lookup' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const url = `${apiBase}/api/sensei/content/${encodeURIComponent(input.module_id)}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.status === 404) {
      return {
        success: false,
        error: `No training content found for module "${input.module_id}". Run the SENSEI seed script to populate content.`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'sensei_lookup' },
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: `SENSEI API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'sensei_lookup' },
      }
    }

    const result = (await response.json()) as {
      success: boolean
      data?: SenseiTrainingContent
      error?: string
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown SENSEI API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'sensei_lookup' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'sensei_lookup' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching SENSEI content',
      metadata: { duration_ms: Date.now() - start, tool_id: 'sensei_lookup' },
    }
  }
}
