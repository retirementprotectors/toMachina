// ─── create_calendar_event — Atomic Tool ──────────────────────────────────────
// Direct calendar event creation with attendees. Wraps google-calendar MCP.
// API: Calendar MCP  |  Entitlement: SPECIALIST
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEventData {
  event_id: string
  title: string
  calendar_link: string
  scheduled_at: string
  attendees: string[]
}

export interface CreateCalendarEventInput {
  title: string
  time: string
  attendees: string[]
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'create_calendar_event',
  name: 'create_calendar_event',
  description: 'Direct calendar event creation with attendees. Wraps google-calendar MCP.',
  type: 'ATOMIC' as const,
  source: 'MCP' as const,
  entitlement_min: 'SPECIALIST' as const,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Event title' },
      time: { type: 'string', description: 'ISO 8601 date/time for the event' },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of attendees',
      },
    },
    required: ['title', 'time', 'attendees'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: CreateCalendarEventInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<CalendarEventData>> {
  const start = Date.now()

  try {
    if (!input.title || !input.time || !input.attendees?.length) {
      return {
        success: false,
        error: 'title, time, and at least one attendee are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'create_calendar_event' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        time: input.time,
        attendees: input.attendees,
        created_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Calendar API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'create_calendar_event' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: CalendarEventData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Calendar API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'create_calendar_event' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'create_calendar_event' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating calendar event',
      metadata: { duration_ms: Date.now() - start, tool_id: 'create_calendar_event' },
    }
  }
}
