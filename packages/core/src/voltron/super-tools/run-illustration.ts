// ─── RUN_ILLUSTRATION Super Tool (Playwright Carrier Automation) ────────────
// Chain: get_client → run_illustration (MDJ single-call) → return result
// Output: Illustration PDF saved to ACF + file link
// NOTE: Server-only on MDJ1. Playwright execution happens on mdj-server.
//
// Architecture:
//   1. Get client demographics from TM API
//   2. Call MDJ agent's single illustration endpoint:
//      POST /api/mdj/illustration/:carrier
//      (handles: portal login → form fill → PDF generate → download → ACF upload)
//   3. Format and return result
//
// The actual browser automation lives in:
//   /home/jdm/mdj-server/src/tools/playwright/carrier-automation.ts
//   /home/jdm/mdj-server/src/tools/playwright/north-american.ts
//   /home/jdm/mdj-server/src/tools/playwright/athene.ts
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'

/** Supported carriers for illustration automation */
export type IllustrationCarrier = 'north_american' | 'athene'

const SUPPORTED_CARRIERS: readonly IllustrationCarrier[] = ['north_american', 'athene'] as const

/** Input parameters for the RUN_ILLUSTRATION super tool */
export interface RunIllustrationParams {
  carrier: IllustrationCarrier
  product_name: string
  premium: number
  payment_mode?: 'single' | 'annual' | 'monthly'
  index_strategy?: string
  rider?: string
  income_start_age?: number
  surrender_years?: number
}

/** Client data resolved from TM API — sent to MDJ for form fill */
interface ResolvedClientData {
  first_name: string
  last_name: string
  date_of_birth: string
  state: string
  gender: 'male' | 'female'
  age?: number
}

/** Response shape from MDJ agent's POST /api/mdj/illustration/:carrier */
interface MdjIllustrationResponse {
  success: boolean
  data?: {
    illustration_id: string
    client_id: string
    carrier: string
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
  error?: string
  duration_ms: number
}

/** Result data from a completed illustration */
export interface RunIllustrationData {
  client_id: string
  carrier: IllustrationCarrier
  product_name: string
  illustration_id: string | null
  illustration_pdf: string | null
  acf_link: string | null
  acf_file_id: string | null
  illustration_data: Record<string, unknown> | null
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'RUN_ILLUSTRATION',
  name: 'Run Illustration',
  description:
    'Browser automation on carrier portals for illustration PDF generation. ' +
    'Supports North American and Athene. Runs Playwright on MDJ1: login → fill form → ' +
    'generate → download PDF → save to ACF. Returns PDF link + illustration summary.',
  tools: ['get_client', 'run_illustration'],
  entitlement_min: 'DIRECTOR',
}

// ── API Helper ──────────────────────────────────────────────────────────────

async function callApi<T>(
  baseUrl: string,
  path: string,
  toolId: string,
  start: number,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<VoltronToolResult<T>> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) options.body = JSON.stringify(body)

    const response = await fetch(`${baseUrl}${path}`, options)

    if (!response.ok) {
      return {
        success: false,
        error: `API ${path} returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: T; error?: string }
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? `API error on ${path}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: toolId },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : `Failed to call ${path}`,
      metadata: { duration_ms: Date.now() - start, tool_id: toolId },
    }
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<RunIllustrationData>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const carrier = (input.params.carrier as IllustrationCarrier) || 'north_american'
  const productName = (input.params.product_name as string) || ''
  const premium = (input.params.premium as number) || 0

  // ── Validate carrier ────────────────────────────────────────────────
  if (!SUPPORTED_CARRIERS.includes(carrier)) {
    return {
      success: false,
      error: `Unsupported carrier: ${carrier}. Supported: ${SUPPORTED_CARRIERS.join(', ')}`,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
    }
  }

  // ── Validate required params ────────────────────────────────────────
  if (!input.client_id || !productName || !premium) {
    return {
      success: false,
      error: 'client_id, carrier, product_name, and premium are required',
      tool_results: toolResults,
      duration_ms: Date.now() - start,
    }
  }

  const tmApiBase = process.env.TOMACHINA_API_URL ?? ''
  const mdjBase = process.env.MDJ_AGENT_URL ?? ''

  try {
    // ── Stage 1: Resolve client demographics from TM API ──────────────
    const clientResult = await callApi<{
      id: string
      first_name: string
      last_name: string
      dob: string
      state: string
      gender?: 'male' | 'female'
      age?: number
    }>(
      tmApiBase,
      `/api/clients/${encodeURIComponent(input.client_id)}`,
      'get_client',
      start,
    )
    toolResults.push(clientResult)

    if (!clientResult.success || !clientResult.data) {
      return {
        success: false,
        error: clientResult.error ?? 'Failed to resolve client for illustration',
        tool_results: toolResults,
        duration_ms: Date.now() - start,
      }
    }

    const clientData: ResolvedClientData = {
      first_name: clientResult.data.first_name,
      last_name: clientResult.data.last_name,
      date_of_birth: clientResult.data.dob,
      state: clientResult.data.state,
      gender: clientResult.data.gender ?? 'male',
      age: clientResult.data.age,
    }

    // ── Stage 2: Run illustration via MDJ agent ───────────────────────
    // Single call to MDJ handles: portal login → form fill → generate
    // → PDF download → ACF upload. Returns PDF link + summary data.
    const carrierSlug = carrier.replace(/_/g, '-')
    const illustrationStart = Date.now()

    const illustrationResult = await callApi<MdjIllustrationResponse['data']>(
      mdjBase,
      `/api/mdj/illustration/${carrierSlug}`,
      'run_illustration',
      illustrationStart,
      'POST',
      {
        client_id: input.client_id,
        carrier,
        product_name: productName,
        premium,
        payment_mode: (input.params.payment_mode as string) ?? 'single',
        index_strategy: (input.params.index_strategy as string) ?? undefined,
        rider: (input.params.rider as string) ?? undefined,
        income_start_age: (input.params.income_start_age as number) ?? undefined,
        surrender_years: (input.params.surrender_years as number) ?? undefined,
        requested_by: context.user_email,
        client_data: clientData,
      },
    )
    toolResults.push(illustrationResult)

    if (!illustrationResult.success || !illustrationResult.data) {
      return {
        success: false,
        error: illustrationResult.error ?? 'MDJ illustration automation failed',
        tool_results: toolResults,
        duration_ms: Date.now() - start,
        stats: { stages_completed: 1, stages_total: 2, carrier },
      }
    }

    // ── Build result ──────────────────────────────────────────────────
    const illData = illustrationResult.data
    const result: RunIllustrationData = {
      client_id: input.client_id,
      carrier,
      product_name: productName,
      illustration_id: illData.illustration_id ?? null,
      illustration_pdf: illData.pdf_file_id ? `${carrier}_${productName.replace(/\s+/g, '_')}_${input.client_id}.pdf` : null,
      acf_link: illData.pdf_link ?? null,
      acf_file_id: illData.pdf_file_id ?? null,
      illustration_data: illData.summary
        ? {
            guaranteed_values: illData.summary.guaranteed_values ?? null,
            projected_values: illData.summary.projected_values ?? null,
            income_benefit: illData.summary.income_benefit ?? null,
            death_benefit: illData.summary.death_benefit ?? null,
            premium,
            payment_mode: input.params.payment_mode ?? 'single',
            index_strategy: input.params.index_strategy ?? null,
            rider: input.params.rider ?? null,
          }
        : {
            premium,
            payment_mode: input.params.payment_mode ?? 'single',
            index_strategy: input.params.index_strategy ?? null,
            rider: input.params.rider ?? null,
          },
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: {
        stages_completed: 2,
        stages_total: 2,
        carrier,
        illustration_id: illData.illustration_id,
        acf_saved: !!illData.pdf_file_id,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      tool_results: toolResults,
      duration_ms: Date.now() - start,
    }
  }
}
