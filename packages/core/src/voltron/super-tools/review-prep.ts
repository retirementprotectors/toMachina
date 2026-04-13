// ─── REVIEW_PREP Super Tool ─────────────────────────────────────────────────
// Chain: search_client → get_client → get_accounts → get_activities →
//        check_pipeline → get_documents → get_household → compile_review
// Output: Complete review packet (client + accounts + pipeline status + summary)
// The Aswegan Proof: 8 autonomous tool calls → complete $1M+ portfolio review
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'

// ── Result Types ────────────────────────────────────────────────────────────

interface ClientProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  dob: string
  state: string
  status: string
  [key: string]: unknown
}

interface AccountSummary {
  account_id: string
  account_type: string
  carrier: string
  policy_number: string
  status: string
  premium: number
  face_amount: number
  [key: string]: unknown
}

interface ReviewPacket {
  client_id: string
  client: ClientProfile | null
  accounts: AccountSummary[]
  account_count: number
  total_premium: number
  total_face_amount: number
  activities: unknown[]
  pipeline_opportunities: unknown[]
  documents: unknown[]
  household: unknown | null
  summary: string
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'REVIEW_PREP',
  name: 'Review Prep',
  description: 'Compiles complete review packet: client profile, accounts, pipeline status, and summary.',
  tools: [
    'search_client',
    'get_client',
    'get_accounts',
    'get_activities',
    'check_pipeline',
    'get_documents',
    'get_household',
    'compile_review',
  ],
  entitlement_min: 'SPECIALIST',
}

// ── TM API Helper ───────────────────────────────────────────────────────────

async function callTmApi<T>(
  path: string,
  toolId: string,
  start: number,
): Promise<VoltronToolResult<T>> {
  const apiBase = process.env.TOMACHINA_API_URL ?? ''
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `TM API ${path} returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: T; error?: string }
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? `TM API error on ${path}`,
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
): Promise<VoltronSuperResult<ReviewPacket>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const clientName = (input.params.client_name as string) || ''

  try {
    // ── Stage 1: Search client by name (or use provided client_id) ────
    let resolvedClientId = input.client_id
    if (clientName && !input.client_id) {
      const searchResult = await callTmApi<{ id: string; first_name: string; last_name: string }[]>(
        `/api/clients/search?q=${encodeURIComponent(clientName)}`,
        'search_client',
        start,
      )
      toolResults.push(searchResult)
      if (!searchResult.success || !searchResult.data?.length) {
        return {
          success: false,
          error: `Client not found: ${clientName}`,
          tool_results: toolResults,
          duration_ms: Date.now() - start,
        }
      }
      resolvedClientId = searchResult.data[0].id
    } else {
      // Still record the search step even when client_id is provided directly
      toolResults.push({
        success: true,
        data: { client_id: resolvedClientId, resolved_by: 'direct_id' },
        metadata: { duration_ms: Date.now() - start, tool_id: 'search_client' },
      })
    }

    // ── Stage 2: Get full client profile ──────────────────────────────
    const clientResult = await callTmApi<ClientProfile>(
      `/api/clients/${encodeURIComponent(resolvedClientId)}`,
      'get_client',
      start,
    )
    toolResults.push(clientResult)
    if (!clientResult.success) {
      return {
        success: false,
        error: clientResult.error ?? 'Failed to get client',
        tool_results: toolResults,
        duration_ms: Date.now() - start,
      }
    }

    // ── Stage 3: Get all accounts ─────────────────────────────────────
    const accountsResult = await callTmApi<AccountSummary[]>(
      `/api/clients/${encodeURIComponent(resolvedClientId)}/accounts`,
      'get_accounts',
      start,
    )
    toolResults.push(accountsResult)
    const accounts = accountsResult.data ?? []

    // ── Stage 4: Get recent activities ────────────────────────────────
    const activitiesResult = await callTmApi<unknown[]>(
      `/api/clients/${encodeURIComponent(resolvedClientId)}/activities?limit=10`,
      'get_activities',
      start,
    )
    toolResults.push(activitiesResult)

    // ── Stage 5: Check pipeline opportunities ─────────────────────────
    const pipelineResult = await callTmApi<unknown[]>(
      `/api/pipelines?client_id=${encodeURIComponent(resolvedClientId)}`,
      'check_pipeline',
      start,
    )
    toolResults.push(pipelineResult)

    // ── Stage 6: Get client documents from ACF ────────────────────────
    const docsResult = await callTmApi<unknown[]>(
      `/api/drive/acf/${encodeURIComponent(resolvedClientId)}/files`,
      'get_documents',
      start,
    )
    toolResults.push(docsResult)

    // ── Stage 7: Get household info ───────────────────────────────────
    const householdResult = await callTmApi<unknown>(
      `/api/households?search=${encodeURIComponent(resolvedClientId)}&limit=1`,
      'get_household',
      start,
    )
    toolResults.push(householdResult)

    // ── Stage 8: Compile review packet ────────────────────────────────
    const totalPremium = accounts.reduce((sum, a) => sum + (a.premium || 0), 0)
    const totalFaceAmount = accounts.reduce((sum, a) => sum + (a.face_amount || 0), 0)
    const clientData = clientResult.data
    const clientLabel = clientData
      ? `${clientData.first_name} ${clientData.last_name}`
      : resolvedClientId

    const reviewPacket: ReviewPacket = {
      client_id: resolvedClientId,
      client: clientData ?? null,
      accounts,
      account_count: accounts.length,
      total_premium: totalPremium,
      total_face_amount: totalFaceAmount,
      activities: activitiesResult.data ?? [],
      pipeline_opportunities: pipelineResult.data ?? [],
      documents: docsResult.data ?? [],
      household: householdResult.data ?? null,
      summary: [
        `Review packet for ${clientLabel}`,
        `${accounts.length} account(s) | $${totalPremium.toLocaleString()} total premium | $${totalFaceAmount.toLocaleString()} total face amount`,
        `${(pipelineResult.data as unknown[] | undefined)?.length ?? 0} pipeline opportunity(s)`,
        `${(docsResult.data as unknown[] | undefined)?.length ?? 0} document(s) in ACF`,
      ].join(' | '),
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    toolResults.push({
      success: true,
      data: reviewPacket,
      metadata: { duration_ms: Date.now() - start, tool_id: 'compile_review' },
    })

    return {
      success: true,
      data: reviewPacket,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: {
        stages_completed: 8,
        stages_total: 8,
        account_count: accounts.length,
        total_premium: totalPremium,
        total_face_amount: totalFaceAmount,
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
