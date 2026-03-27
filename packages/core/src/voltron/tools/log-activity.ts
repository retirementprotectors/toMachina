// ─── log_activity — Atomic Tool ───────────────────────────────────────────────
// Write activity log entry to Firestore for audit trail.
// API: Firestore API  |  Entitlement: COORDINATOR
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LogEntryData {
  log_id: string
  client_id: string
  activity_type: string
  details: string
  logged_by: string
  logged_at: string
}

export interface LogActivityInput {
  client_id: string
  activity_type: string
  details: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'log_activity',
  name: 'log_activity',
  description: 'Write an activity log entry to Firestore for audit trail.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'COORDINATOR' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID this activity relates to' },
      activity_type: { type: 'string', description: 'Type of activity (e.g., call, email, meeting, note)' },
      details: { type: 'string', description: 'Description of the activity' },
    },
    required: ['client_id', 'activity_type', 'details'],
  },
  server_only: false,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: LogActivityInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<LogEntryData>> {
  const start = Date.now()

  try {
    if (!input.client_id || !input.activity_type || !input.details) {
      return {
        success: false,
        error: 'client_id, activity_type, and details are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'log_activity' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/activity/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.client_id,
        activity_type: input.activity_type,
        details: input.details,
        logged_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Activity API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'log_activity' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: LogEntryData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Activity API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'log_activity' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'log_activity' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error logging activity',
      metadata: { duration_ms: Date.now() - start, tool_id: 'log_activity' },
    }
  }
}
