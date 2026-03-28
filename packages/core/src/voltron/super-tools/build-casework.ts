// ─── BUILD_CASEWORK Super Tool (Crown Jewel) ───────────────────────────────
// Chain: get_client → run_que_quote → generate_html → save_to_acf → notify_agent
// Output: Interactive casework HTML in ACF + Slack notification to assigned agent
// "Mineart casework → Archer notified → $100k closed"
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'

// ── Result Types ────────────────────────────────────────────────────────────

interface ClientData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  dob: string
  state: string
  [key: string]: unknown
}

interface QueSession {
  session_id: string
  [key: string]: unknown
}

interface CaseworkResult {
  client_id: string
  client_name: string
  product_type: string
  que_session_id: string | null
  casework_html: string
  acf_link: string | null
  acf_file_id: string | null
  slack_notified: boolean
  slack_channel: string | null
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'BUILD_CASEWORK',
  name: 'Build Casework',
  description: 'User-to-close pipeline: generates casework HTML in ACF with Slack notification.',
  tools: ['get_client', 'run_que_quote', 'generate_html', 'save_to_acf', 'notify_agent'],
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

// ── Casework HTML Generator ─────────────────────────────────────────────────

function generateCaseworkHtml(
  client: ClientData,
  productType: string,
  queSessionId: string | null,
  preparedBy: string,
): string {
  const clientName = `${client.first_name} ${client.last_name}`
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="UTF-8">',
    `<title>Casework: ${clientName}</title>`,
    '<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}',
    'h1{color:#1a365d;border-bottom:2px solid #3182ce;padding-bottom:.5rem}',
    'table{width:100%;border-collapse:collapse;margin:1rem 0}',
    'th,td{border:1px solid #e2e8f0;padding:.5rem;text-align:left}',
    'th{background:#f7fafc;color:#2d3748}',
    '.badge{display:inline-block;padding:.25rem .5rem;border-radius:4px;font-size:.85rem;font-weight:600}',
    '.badge-active{background:#c6f6d5;color:#22543d}',
    '</style></head><body>',
    `<h1>Casework: ${clientName}</h1>`,
    '<table>',
    `<tr><th>Client</th><td>${clientName}</td></tr>`,
    `<tr><th>Email</th><td>${client.email || 'N/A'}</td></tr>`,
    `<tr><th>Phone</th><td>${client.phone || 'N/A'}</td></tr>`,
    `<tr><th>DOB</th><td>${client.dob || 'N/A'}</td></tr>`,
    `<tr><th>State</th><td>${client.state || 'N/A'}</td></tr>`,
    `<tr><th>Product</th><td>${productType}</td></tr>`,
    `<tr><th>QUE Session</th><td>${queSessionId ?? 'Pending'}</td></tr>`,
    `<tr><th>Prepared By</th><td>${preparedBy}</td></tr>`,
    `<tr><th>Date</th><td>${new Date().toLocaleDateString()}</td></tr>`,
    '</table>',
    '<p><span class="badge badge-active">Active Casework</span></p>',
    '</body></html>',
  ].join('\n')
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<CaseworkResult>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const productType = (input.params.product_type as string) || 'medicare_supplement'

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

    // ── Stage 2: Create QUE session + add quote ───────────────────────
    const queResult = await callApi<QueSession>(
      '/api/que/sessions',
      'run_que_quote',
      start,
      'POST',
      {
        client_id: input.client_id,
        session_type: productType,
      },
    )
    toolResults.push(queResult)
    const queSessionId = queResult.data?.session_id ?? null

    // ── Stage 3: Generate casework HTML ───────────────────────────────
    const htmlContent = generateCaseworkHtml(client, productType, queSessionId, context.user_email)
    toolResults.push({
      success: true,
      data: {
        client_id: input.client_id,
        html_generated: true,
        html_size: htmlContent.length,
        product_type: productType,
      },
      metadata: { duration_ms: Date.now() - start, tool_id: 'generate_html' },
    })

    // ── Stage 4: Save to ACF ──────────────────────────────────────────
    const clientName = `${client.first_name}_${client.last_name}`.replace(/\s+/g, '_')
    const fileName = `casework_${clientName}_${Date.now()}.html`
    const saveResult = await callApi<{ file_id: string; web_view_link: string }>(
      `/api/drive/acf/${encodeURIComponent(input.client_id)}/upload`,
      'save_to_acf',
      start,
      'POST',
      {
        file_name: fileName,
        content: htmlContent,
        mime_type: 'text/html',
      },
    )
    toolResults.push(saveResult)

    // ── Stage 5: Notify agent via Slack ───────────────────────────────
    const slackChannel = (input.params.slack_channel as string) || 'casework'
    const clientLabel = `${client.first_name} ${client.last_name}`
    const notifyResult = await callApi<{ message_ts: string; channel: string }>(
      '/api/notifications/slack',
      'notify_agent',
      start,
      'POST',
      {
        channel: slackChannel,
        text: `New casework generated: ${clientLabel} — ${productType}`,
        client_id: input.client_id,
      },
    )
    toolResults.push(notifyResult)

    const result: CaseworkResult = {
      client_id: input.client_id,
      client_name: clientLabel,
      product_type: productType,
      que_session_id: queSessionId,
      casework_html: htmlContent,
      acf_link: saveResult.data?.web_view_link ?? null,
      acf_file_id: saveResult.data?.file_id ?? null,
      slack_notified: notifyResult.success,
      slack_channel: notifyResult.data?.channel ?? null,
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: { stages_completed: 5, stages_total: 5, product_type: productType },
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
