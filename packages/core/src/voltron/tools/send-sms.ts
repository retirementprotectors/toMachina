// ─── send_sms — Atomic Tool ───────────────────────────────────────────────────
// Send SMS via Lead Connector. Requires approval gate before execution.
// API: Lead Connector  |  Entitlement: SPECIALIST (gated)
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SmsStatusData {
  message_id: string
  status: 'sent' | 'queued' | 'failed' | 'approval_required'
  client_id: string
  sent_at?: string
}

export interface SendSmsInput {
  client_id: string
  message: string
  /** When true, bypasses approval gate (only valid after explicit wire approval). */
  approved?: boolean
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'send_sms',
  name: 'send_sms',
  description: 'Send SMS via Lead Connector. Requires approval gate before execution — irreversible action.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'SPECIALIST' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID to send SMS to' },
      message: { type: 'string', description: 'The SMS message body' },
      approved: { type: 'boolean', description: 'Whether this send has been approved (wire approval gate)' },
    },
    required: ['client_id', 'message'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: SendSmsInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<SmsStatusData>> {
  const start = Date.now()

  try {
    if (!input.client_id || !input.message) {
      return {
        success: false,
        error: 'client_id and message are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'send_sms' },
      }
    }

    // ── Approval Gate ─────────────────────────────────────────────────────
    // SMS is an irreversible communication action. Must be explicitly approved
    // before execution (either via wire approval gate or direct approval flag).
    if (!input.approved) {
      return {
        success: true,
        data: {
          message_id: '',
          status: 'approval_required',
          client_id: input.client_id,
        },
        metadata: { duration_ms: Date.now() - start, tool_id: 'send_sms' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/lead-connector/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.client_id,
        message: input.message,
        sent_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Lead Connector API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'send_sms' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: SmsStatusData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown Lead Connector error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'send_sms' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'send_sms' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending SMS',
      metadata: { duration_ms: Date.now() - start, tool_id: 'send_sms' },
    }
  }
}
