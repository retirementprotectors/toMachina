// ─── run_illustration — Atomic Tool ───────────────────────────────────────────
// Browser automation on carrier portal. Returns illustration data + PDF.
// North American + Athene first. Delegates to MDJ agent for Playwright execution.
// API: Playwright (MDJ1)  |  Entitlement: DIRECTOR
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type IllustrationCarrier = 'north_american' | 'athene'

export interface IllustrationPdfData {
  illustration_id: string
  client_id: string
  carrier: IllustrationCarrier
  product_name: string
  pdf_file_id?: string
  pdf_link?: string
  acf_folder_id?: string
  status: 'complete' | 'pending' | 'error'
  generated_at: string
  summary?: {
    premium: number
    payment_mode: string
    index_strategy: string
    guaranteed_minimum: number
    projected_value: number
  }
}

export interface RunIllustrationInput {
  client_id: string
  carrier: IllustrationCarrier
  product_params: {
    product_name: string
    premium: number
    payment_mode: string
    index_strategy: string
    rider?: string
    income_start_age?: number
  }
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'run_illustration',
  name: 'run_illustration',
  description:
    'Browser automation on carrier portal (North American + Athene). Returns illustration data and PDF saved to ACF. Server-only — runs on MDJ1.',
  type: 'ATOMIC' as const,
  source: 'VOLTRON' as const,
  entitlement_min: 'DIRECTOR' as const,
  parameters: {
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'The client ID' },
      carrier: {
        type: 'string',
        enum: ['north_american', 'athene'],
        description: 'Target carrier portal',
      },
      product_params: {
        type: 'object',
        description: 'Illustration parameters for the carrier portal',
        properties: {
          product_name: { type: 'string' },
          premium: { type: 'number' },
          payment_mode: { type: 'string' },
          index_strategy: { type: 'string' },
          rider: { type: 'string' },
          income_start_age: { type: 'number' },
        },
        required: ['product_name', 'premium', 'payment_mode', 'index_strategy'],
      },
    },
    required: ['client_id', 'carrier', 'product_params'],
  },
  server_only: true,
}

// ── Carrier Portal URLs (env-driven, no hardcoded secrets) ────────────────────

const CARRIER_ENDPOINTS: Record<IllustrationCarrier, string> = {
  north_american: '/api/mdj/illustration/north-american',
  athene: '/api/mdj/illustration/athene',
}

// ── Execute ───────────────────────────────────────────────────────────────────
// This is a skeleton that delegates to the MDJ agent API for actual Playwright
// browser automation. The MDJ agent handles portal login, form fill, PDF
// download, and ACF upload. This tool orchestrates the request/response.

export async function execute(
  input: RunIllustrationInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<IllustrationPdfData>> {
  const start = Date.now()

  try {
    if (!input.client_id || !input.carrier || !input.product_params) {
      return {
        success: false,
        error: 'client_id, carrier, and product_params are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    // Validate carrier
    if (!CARRIER_ENDPOINTS[input.carrier]) {
      return {
        success: false,
        error: `Unsupported carrier: ${input.carrier}. Supported: north_american, athene`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    // Validate required product params
    const { product_name, premium, payment_mode, index_strategy } = input.product_params
    if (!product_name || !premium || !payment_mode || !index_strategy) {
      return {
        success: false,
        error: 'product_params requires: product_name, premium, payment_mode, index_strategy',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    // Delegate to MDJ agent API for Playwright-based carrier automation
    const mdjBase = process.env.MDJ_AGENT_URL ?? ''
    const endpoint = CARRIER_ENDPOINTS[input.carrier]
    const response = await fetch(`${mdjBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: input.client_id,
        carrier: input.carrier,
        product_name,
        premium,
        payment_mode,
        index_strategy,
        rider: input.product_params.rider,
        income_start_age: input.product_params.income_start_age,
        requested_by: ctx.user_email,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `MDJ Agent returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    const result = (await response.json()) as {
      success: boolean
      data?: IllustrationPdfData
      error?: string
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown MDJ Agent error',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error running illustration',
      metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
    }
  }
}
