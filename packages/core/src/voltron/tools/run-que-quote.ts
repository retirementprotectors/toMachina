// ─── run_que_quote — Atomic Tool ──────────────────────────────────────────────
// Execute QUE Medicare quote for a client. Returns plan comparison data.
// API: QUE  |  Entitlement: SPECIALIST
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlanOption {
  carrier: string
  plan_name: string
  plan_type: string
  monthly_premium: number
  annual_premium: number
  rating: string
  highlights: string[]
}

export interface PlanComparisonData {
  client_id: string
  quote_id: string
  age: number
  health_profile: string
  plans: PlanOption[]
  generated_at: string
}

export interface RunQueQuoteInput {
  client_id: string
  age: number
  health_profile: string
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'run_que_quote',
  name: 'run_que_quote',
  description: 'Execute QUE Medicare quote for a client. Returns plan comparison data.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'SPECIALIST' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID' },
      age: { type: 'number', description: 'Client age for quoting' },
      health_profile: { type: 'string', description: 'Health profile summary for underwriting' },
    },
    required: ['client_id', 'age', 'health_profile'],
  },
  server_only: true,
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function execute(
  input: RunQueQuoteInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<PlanComparisonData>> {
  const start = Date.now()

  try {
    if (!input.client_id || !input.age || !input.health_profile) {
      return {
        success: false,
        error: 'client_id, age, and health_profile are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_que_quote' },
      }
    }

    const apiBase = process.env.TOMACHINA_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/que/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.client_id,
        age: input.age,
        health_profile: input.health_profile,
        requested_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `QUE API returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_que_quote' },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: PlanComparisonData; error?: string }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown QUE API error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_que_quote' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'run_que_quote' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error running QUE quote',
      metadata: { duration_ms: Date.now() - start, tool_id: 'run_que_quote' },
    }
  }
}
