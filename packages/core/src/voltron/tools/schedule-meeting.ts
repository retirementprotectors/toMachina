// ─── schedule_meeting — Atomic Tool ───────────────────────────────────────────
// Create calendar event + send invites via Google Calendar MCP.
// API: Calendar MCP  |  Entitlement: SPECIALIST
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventIdData {
  event_id: string
  calendar_link: string
  scheduled_at: string
  attendees: string[]
}

export interface ScheduleMeetingInput {
  client_id: string
  date: string
  attendees: string[]
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'schedule_meeting',
  name: 'schedule_meeting',
  description: 'Create a calendar event and send invites via Google Calendar MCP.',
  type: 'ATOMIC' as const,
  source: 'MCP' as const,
  entitlement_min: 'SPECIALIST' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID for the meeting' },
      date: { type: 'string', description: 'ISO 8601 date/time for the meeting' },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of attendees',
      },
    },
    required: ['client_id', 'date', 'attendees'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: ScheduleMeetingInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<EventIdData>> {
  const start = Date.now()

  try {
    if (!input.client_id || !input.date || !input.attendees?.length) {
      return {
        success: false,
        error: 'client_id, date, and at least one attendee are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'schedule_meeting' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.client_id,
        date: input.date,
        attendees: input.attendees,
        created_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Calendar API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'schedule_meeting' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: EventIdData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Calendar API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'schedule_meeting' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'schedule_meeting' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error scheduling meeting',
      metadata: { duration_ms: Date.now() - start, tool_id: 'schedule_meeting' },
    }
  }
}
