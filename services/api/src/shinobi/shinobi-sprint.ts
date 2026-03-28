// src/shinobi/shinobi-sprint.ts — POST /shinobi/sprint handler
// TRK-13785: Accept sprint name + discovery URL. Validate doc. Start RONIN.
// Calls mdj-agent's /forge/sprint endpoint via HTTP (same pattern as mdj.ts proxy).

import { updateShinobiState } from './shinobi-state.js'

// mdj-agent (VOLTRON/RONIN) service URL — reuse same env vars as mdj routes
const MDJ_AGENT_URL =
  process.env.VOLTRON_URL || process.env.MDJ1_URL || 'https://mdjserver.tail7845ea.ts.net'
const MDJ_AUTH_SECRET = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'

export async function startSprint(body: {
  sprint_name: string
  discovery_url: string
}): Promise<{ sprint_id: string; tickets_seeded: number; ronin_started: boolean }> {
  const { sprint_name, discovery_url } = body

  // Validate required fields
  if (!sprint_name || !discovery_url) {
    throw new Error('Missing required fields: sprint_name, discovery_url')
  }
  if (!discovery_url.startsWith('http')) {
    throw new Error('discovery_url must be a valid HTTP(S) URL')
  }

  // Validate discovery doc is reachable before kicking off RONIN
  try {
    const headRes = await fetch(discovery_url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    })
    if (!headRes.ok) {
      throw new Error(`Discovery doc returned HTTP ${headRes.status}`)
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Discovery doc returned')) throw err
    throw new Error(`Discovery doc unreachable: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Call mdj-agent /forge/sprint to start RONIN (fire-and-forget on their side, returns 202)
  const forgeRes = await fetch(`${MDJ_AGENT_URL}/forge/sprint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MDJ-Auth': MDJ_AUTH_SECRET,
    },
    body: JSON.stringify({
      name: sprint_name,
      discovery_doc: discovery_url,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!forgeRes.ok) {
    const errText = await forgeRes.text().catch(() => 'unknown')
    throw new Error(`RONIN /forge/sprint returned ${forgeRes.status}: ${errText}`)
  }

  const forgeData = (await forgeRes.json()) as {
    success: boolean
    data?: { run_id?: string; status?: string }
    error?: string
  }

  if (!forgeData.success) {
    throw new Error(`RONIN rejected sprint: ${forgeData.error ?? 'unknown error'}`)
  }

  const runId = forgeData.data?.run_id ?? `shinobi-${Date.now()}`

  // Update Shinobi state with the new sprint info
  await updateShinobiState({
    ronin_sprint: { name: sprint_name, phase: 'create_sprint', status: 'running' },
  })

  return { sprint_id: runId, tickets_seeded: 0, ronin_started: true }
}
