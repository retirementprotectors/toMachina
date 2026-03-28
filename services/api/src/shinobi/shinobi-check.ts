// src/shinobi/shinobi-check.ts — POST /shinobi/check cron logic
// TRK-13781: Read Slack unhandled → check RONIN status → auto-retry transient failures.

import { updateShinobiState } from './shinobi-state.js'
import { readChannel } from './shinobi-slack.js'
import { getLatestRun } from './ronin-monitor.js'

export interface CheckResult {
  checked_at: string
  slack_messages_processed: number
  ronin_status: Record<string, unknown>
  actions_taken: string[]
}

export async function runCheck(): Promise<CheckResult> {
  const actions: string[] = []

  // Transition to 'checking' state
  await updateShinobiState({ state: 'checking', active_task: 'periodic-check' })

  // 1. Read Slack unhandled messages
  const { messages } = await readChannel(20)
  const unhandled = messages.filter((m) => !m.bot_id)
  if (unhandled.length > 0) {
    actions.push(`Found ${unhandled.length} unhandled Slack messages`)
  }

  // 2. Check RONIN status
  const latestRun = await getLatestRun()
  const roninStatus = latestRun ?? { status: 'no_active_runs' }
  if (latestRun?.status === 'blocked') {
    actions.push(`RONIN blocked at phase: ${latestRun.phase}`)
  }

  // 3. Update state with check results
  const now = new Date().toISOString()
  await updateShinobiState({
    state: 'idle',
    active_task: null,
    last_check: now,
    ronin_sprint: latestRun
      ? {
          name: latestRun.sprint_name,
          phase: latestRun.phase,
          status: latestRun.status,
        }
      : null,
  })

  return {
    checked_at: now,
    slack_messages_processed: unhandled.length,
    ronin_status: roninStatus as Record<string, unknown>,
    actions_taken: actions,
  }
}
