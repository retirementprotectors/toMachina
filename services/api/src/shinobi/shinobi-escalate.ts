// src/shinobi/shinobi-escalate.ts — Escalation handler for RONIN/RAIDEN gates
// TRK-13784: Accept escalation, analyze: transient → auto-resolve, strategic → DM JDM.

import { updateShinobiState } from './shinobi-state.js'
import { dmJdm, postToChannel } from './shinobi-slack.js'
import { shinobiQuery } from './shinobi-agent.js'

const STRATEGIC_GATES = new Set(['plan_approval', 'build_approval'])

const TRANSIENT_PATTERNS = [
  /ci.*(fail|error)/i, /timeout/i, /ECONNRESET/i, /rate.?limit/i, /503|502|504/,
]

function isTransient(issue: string): boolean {
  return TRANSIENT_PATTERNS.some(p => p.test(issue))
}

export async function handleEscalation(body: {
  source: 'ronin' | 'raiden'
  sprint_id?: string
  issue: string
  context: Record<string, unknown>
}): Promise<{
  resolution: 'resolved' | 'escalated_to_jdm'
  action_taken: string
  message?: string
}> {
  await updateShinobiState({ state: 'escalating', active_task: `escalation-from-${body.source}` })
  const { source, sprint_id, issue, context } = body
  const gateType = (context.gate_type as string) ?? ''

  // Strategic gates ALWAYS go to JDM
  if (STRATEGIC_GATES.has(gateType)) {
    const msg = `*SHINOBI Escalation* (${source})\n*Sprint:* ${sprint_id ?? 'N/A'}\n*Gate:* ${gateType}\n*Issue:* ${issue}`
    await dmJdm(msg)
    await postToChannel(`Escalated ${gateType} gate to JDM for approval.`)
    await updateShinobiState({ state: 'idle', active_task: null })
    return { resolution: 'escalated_to_jdm', action_taken: `DM sent to JDM for ${gateType}` }
  }

  // Transient issues: auto-resolve
  if (isTransient(issue)) {
    await postToChannel(`Auto-resolving transient issue: ${issue.slice(0, 100)}`)
    await updateShinobiState({ state: 'idle', active_task: null })
    return {
      resolution: 'resolved',
      action_taken: 'auto_retry_transient',
      message: 'Transient failure detected, auto-retrying',
    }
  }

  // Unknown: agent analysis, default escalate to JDM
  const analysis = await shinobiQuery(
    `Analyze this escalation. Source: ${source}, Sprint: ${sprint_id}, Issue: ${issue}, Context: ${JSON.stringify(context)}`,
    { escalation: true },
  )
  await dmJdm(
    `*SHINOBI Escalation* (${source})\n*Issue:* ${issue}\n*Analysis:* ${analysis.response.slice(0, 500)}`,
  )
  await updateShinobiState({ state: 'idle', active_task: null })
  return { resolution: 'escalated_to_jdm', action_taken: 'agent_analysis_escalated', message: analysis.response }
}
