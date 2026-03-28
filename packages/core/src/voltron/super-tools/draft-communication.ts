// ─── DRAFT_COMMUNICATION Super Tool ─────────────────────────────────────────
// Chain: get_client → compose_message → save_draft
// Output: Saved Gmail draft with link
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'

// ── Result Types ────────────────────────────────────────────────────────────

type CommunicationIntent = 'email' | 'sms' | 'letter'

interface ClientData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  [key: string]: unknown
}

interface DraftResult {
  client_id: string
  client_name: string
  intent: CommunicationIntent
  subject: string
  body: string
  draft_saved: boolean
  draft_link: string | null
  draft_id: string | null
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'DRAFT_COMMUNICATION',
  name: 'Draft Communication',
  description: 'Generates and stores communication templates (email/sms/letter) for client follow-up.',
  tools: ['get_client', 'compose_message', 'save_draft'],
  entitlement_min: 'SPECIALIST',
}

// ── TM API Helper ───────────────────────────────────────────────────────────

async function callApi<T>(
  path: string,
  toolId: string,
  start: number,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<VoltronToolResult<T>> {
  const apiBase = process.env.TOMACHINA_API_URL ?? ''
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) options.body = JSON.stringify(body)

    const response = await fetch(`${apiBase}${path}`, options)

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

// ── Message Composition ─────────────────────────────────────────────────────

function composeEmailSubject(client: ClientData, customSubject?: string): string {
  if (customSubject) return customSubject
  return `Follow-up: ${client.first_name} ${client.last_name} — Retirement Protectors`
}

function composeEmailBody(client: ClientData, customBody?: string): string {
  if (customBody) return customBody
  return [
    `Dear ${client.first_name},`,
    '',
    'Thank you for your time. I wanted to follow up on our recent conversation.',
    '',
    'Please let me know if you have any questions or if there is anything else I can help you with.',
    '',
    'Best regards,',
    'Retirement Protectors Team',
  ].join('\n')
}

function composeSmsBody(client: ClientData, customBody?: string): string {
  if (customBody) return customBody
  return `Hi ${client.first_name}, this is Retirement Protectors following up on our conversation. Reply or call if you have questions.`
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<DraftResult>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const intent = (input.params.intent as CommunicationIntent) || 'email'
  const customSubject = input.params.subject as string | undefined
  const customBody = input.params.body as string | undefined

  try {
    // ── Stage 1: Get client ───────────────────────────────────────────
    const clientResult = await callApi<ClientData>(
      `/api/clients/${encodeURIComponent(input.client_id)}`,
      'get_client',
      start,
    )
    toolResults.push(clientResult)
    if (!clientResult.success || !clientResult.data) {
      return {
        success: false,
        error: clientResult.error ?? 'Failed to get client',
        tool_results: toolResults,
        duration_ms: Date.now() - start,
      }
    }
    const client = clientResult.data

    // ── Stage 2: Compose message ──────────────────────────────────────
    let subject = ''
    let body = ''

    if (intent === 'email' || intent === 'letter') {
      subject = composeEmailSubject(client, customSubject)
      body = composeEmailBody(client, customBody)
    } else {
      subject = `SMS to ${client.first_name} ${client.last_name}`
      body = composeSmsBody(client, customBody)
    }

    toolResults.push({
      success: true,
      data: {
        client_id: input.client_id,
        intent,
        subject,
        body_length: body.length,
        composed: true,
      },
      metadata: { duration_ms: Date.now() - start, tool_id: 'compose_message' },
    })

    // ── Stage 3: Save draft ───────────────────────────────────────────
    const draftResult = await callApi<{ draft_id: string; draft_link: string }>(
      '/api/communications/drafts',
      'save_draft',
      start,
      'POST',
      {
        client_id: input.client_id,
        intent,
        to: intent === 'sms' ? client.phone : client.email,
        subject,
        body,
      },
    )
    toolResults.push(draftResult)

    const clientName = `${client.first_name} ${client.last_name}`
    const result: DraftResult = {
      client_id: input.client_id,
      client_name: clientName,
      intent,
      subject,
      body,
      draft_saved: draftResult.success,
      draft_link: draftResult.data?.draft_link ?? null,
      draft_id: draftResult.data?.draft_id ?? null,
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: { stages_completed: 3, stages_total: 3, intent },
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
