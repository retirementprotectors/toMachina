// ─── run_illustration — Atomic Tool ───────────────────────────────────────────
// Browser automation on carrier portal. Returns illustration data + PDF.
// North American + Athene. Delegates to MDJ agent for Playwright execution.
// API: POST /api/mdj/illustration/:carrier (MDJ1)  |  Entitlement: DIRECTOR
//
// MDJ agent endpoint handles the full flow:
//   portal login → form fill → generate → PDF download → ACF upload
//
// This atomic tool requires client_data (demographics) to be pre-resolved
// by the caller (typically the RUN_ILLUSTRATION super tool).
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronToolResult, VoltronContext } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type IllustrationCarrier = 'north_american' | 'athene'

const SUPPORTED_CARRIERS: readonly IllustrationCarrier[] = ['north_american', 'athene'] as const

/** Client demographics needed for carrier form fill. Resolved by the super tool. */
export interface IllustrationClientData {
  first_name: string
  last_name: string
  dob: string
  state: string
  gender: 'male' | 'female'
  age?: number
}

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
    guaranteed_values?: Record<string, number>
    projected_values?: Record<string, number>
    income_benefit?: { annual_income?: number; start_age?: number; benefit_base?: number }
    death_benefit?: number
  }
}

export interface RunIllustrationInput {
  client_id: string
  carrier: IllustrationCarrier
  product_params: {
    product_name: string
    premium: number
    payment_mode?: string
    index_strategy?: string
    rider?: string
    income_start_age?: number
    surrender_years?: number
  }
  /** Client demographics — required for carrier form fill. */
  client_data?: IllustrationClientData
}

// ── Definition ────────────────────────────────────────────────────────────────

export const definition = {
  tool_id: 'run_illustration',
  name: 'run_illustration',
  description:
    'Browser automation on carrier portal (North American + Athene). ' +
    'Runs Playwright on MDJ1: login → fill form → generate → download PDF → save to ACF. ' +
    'Returns illustration data + PDF link. Server-only.',
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
          payment_mode: { type: 'string', enum: ['single', 'annual', 'monthly'] },
          index_strategy: { type: 'string' },
          rider: { type: 'string' },
          income_start_age: { type: 'number' },
          surrender_years: { type: 'number' },
        },
        required: ['product_name', 'premium'],
      },
      client_data: {
        type: 'object',
        description: 'Client demographics for carrier form fill',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          dob: { type: 'string' },
          state: { type: 'string' },
          gender: { type: 'string', enum: ['male', 'female'] },
          age: { type: 'number' },
        },
        required: ['first_name', 'last_name', 'dob', 'state', 'gender'],
      },
    },
    required: ['client_id', 'carrier', 'product_params', 'client_data'],
  },
  server_only: true,
}

// ── Carrier endpoint mapping (env-driven, no hardcoded secrets) ─────────────

const CARRIER_ENDPOINTS: Record<IllustrationCarrier, string> = {
  north_american: '/api/mdj/illustration/north-american',
  athene: '/api/mdj/illustration/athene',
}

// ── Execute ───────────────────────────────────────────────────────────────────
// Delegates to MDJ agent's single illustration endpoint which handles:
//   portal login → form fill → generate → PDF download → ACF upload
// Returns illustration result with PDF link and optional summary data.

export async function execute(
  input: RunIllustrationInput,
  ctx: VoltronContext,
): Promise<VoltronToolResult<IllustrationPdfData>> {
  const start = Date.now()

  try {
    // ── Validate required fields ──────────────────────────────────────
    if (!input.client_id || !input.carrier || !input.product_params) {
      return {
        success: false,
        error: 'client_id, carrier, and product_params are required',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    if (!SUPPORTED_CARRIERS.includes(input.carrier)) {
      return {
        success: false,
        error: `Unsupported carrier: ${input.carrier}. Supported: ${SUPPORTED_CARRIERS.join(', ')}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    const { product_name, premium } = input.product_params
    if (!product_name || !premium) {
      return {
        success: false,
        error: 'product_params requires: product_name, premium',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    if (!input.client_data) {
      return {
        success: false,
        error: 'client_data is required: { first_name, last_name, dob, state, gender }',
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    // ── Delegate to MDJ agent ─────────────────────────────────────────
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
        payment_mode: input.product_params.payment_mode ?? 'single',
        index_strategy: input.product_params.index_strategy,
        rider: input.product_params.rider,
        income_start_age: input.product_params.income_start_age,
        surrender_years: input.product_params.surrender_years,
        requested_by: ctx.user_email,
        client_data: {
          first_name: input.client_data.first_name,
          last_name: input.client_data.last_name,
          dob: input.client_data.dob,
          state: input.client_data.state,
          gender: input.client_data.gender,
          age: input.client_data.age,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      return {
        success: false,
        error: `MDJ Agent returned ${response.status}: ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`,
        metadata: { duration_ms: Date.now() - start, tool_id: 'run_illustration' },
      }
    }

    const result = (await response.json()) as {
      success: boolean
      data?: IllustrationPdfData
      error?: string
      duration_ms?: number
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'MDJ Agent illustration failed',
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
