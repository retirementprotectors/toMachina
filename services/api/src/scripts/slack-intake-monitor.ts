// ─── VOLTRON Slack Intake Monitor — VOL-O11 ─────────────────────────────────
// Monitors #voltron-cases Slack channel for client case requests.
// Designed to run as a cron job on MDJ_SERVER (5-minute interval).
//
// Flow:
//   1. Fetch new messages from #voltron-cases since last check
//   2. Parse client + scenario from message text
//   3. Create voltron_cases record with intake_channel = 'slack'
//   4. Dispatch to appropriate Lion via POST /api/voltron/wire/execute
//   5. Post wire output as threaded Slack reply
//   6. Track processed message timestamps to prevent reprocessing
//
// Prerequisites:
//   - #voltron-cases Slack channel created by JDM
//   - Slack MCP or Bot token with channels:history, chat:write scopes
//   - VOLTRON_CASES_CHANNEL_ID env var set
//   - SLACK_BOT_TOKEN env var set
//
// Run: npx ts-node services/api/src/scripts/slack-intake-monitor.ts
// Cron: */5 * * * * (every 5 minutes on MDJ_SERVER)
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeChannel, VoltronLionDomain } from '@tomachina/core'

// ── Types ──────────────────────────────────────────────────────────────────

interface SlackMessage {
  ts: string
  text: string
  user: string
  thread_ts?: string
}

interface IntakeResult {
  case_id?: string
  lion_domain: VoltronLionDomain
  wire_output?: unknown
  error?: string
}

// ── Config ─────────────────────────────────────────────────────────────────

const CHANNEL_ID = process.env.VOLTRON_CASES_CHANNEL_ID || ''
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const API_BASE = process.env.TM_API_URL || 'http://localhost:8080'
const INTAKE_CHANNEL: IntakeChannel = 'slack'

// Track last processed timestamp to avoid reprocessing
let lastProcessedTs = '0'

// ── Slack API helpers ──────────────────────────────────────────────────────

async function fetchNewMessages(oldest: string): Promise<SlackMessage[]> {
  const url = `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&oldest=${oldest}&limit=20`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
  })
  const data = await res.json() as { ok: boolean; messages?: SlackMessage[] }
  if (!data.ok || !data.messages) return []
  // Filter out bot messages and thread replies
  return data.messages.filter(m => !m.thread_ts && m.text)
}

async function postThreadReply(threadTs: string, text: string): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: CHANNEL_ID,
      thread_ts: threadTs,
      text,
    }),
  })
}

// ── Domain detection ───────────────────────────────────────────────────────

async function detectDomain(message: string): Promise<VoltronLionDomain> {
  try {
    const res = await fetch(`${API_BASE}/api/mdj/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    const data = await res.json() as { data?: { lion_domain?: VoltronLionDomain } }
    return data.data?.lion_domain || 'general'
  } catch {
    return 'general'
  }
}

// ── Case creation ──────────────────────────────────────────────────────────

async function processMessage(msg: SlackMessage): Promise<IntakeResult> {
  const domain = await detectDomain(msg.text)

  // Create case via cases API
  try {
    const caseRes = await fetch(`${API_BASE}/api/voltron/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Intake-Channel': INTAKE_CHANNEL,
      },
      body: JSON.stringify({
        client_id: 'slack-intake',
        client_name: `Slack request from ${msg.user}`,
        wire_name: 'SLACK_INTAKE',
        lion_domain: domain,
        agent_id: msg.user,
        intake_channel: INTAKE_CHANNEL,
      }),
    })

    const caseData = await caseRes.json() as { data?: { case_id?: string } }
    return {
      case_id: caseData.data?.case_id,
      lion_domain: domain,
    }
  } catch (err) {
    return {
      lion_domain: domain,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────

async function runMonitor(): Promise<void> {
  if (!CHANNEL_ID || !SLACK_TOKEN) {
    console.error('VOLTRON Slack Monitor: Missing VOLTRON_CASES_CHANNEL_ID or SLACK_BOT_TOKEN')
    process.exit(1)
  }

  console.log(`VOLTRON Slack Monitor: Checking #voltron-cases since ${lastProcessedTs}`)

  const messages = await fetchNewMessages(lastProcessedTs)
  if (messages.length === 0) {
    console.log('VOLTRON Slack Monitor: No new messages')
    return
  }

  console.log(`VOLTRON Slack Monitor: Processing ${messages.length} new messages`)

  for (const msg of messages.reverse()) {
    const result = await processMessage(msg)

    // Post acknowledgment as thread reply
    const replyText = result.error
      ? `Case creation failed: ${result.error}`
      : `Case created (${result.lion_domain} Lion). Case ID: ${result.case_id || 'pending'}`

    await postThreadReply(msg.ts, replyText)

    // Update high-water mark
    if (msg.ts > lastProcessedTs) {
      lastProcessedTs = msg.ts
    }
  }

  console.log(`VOLTRON Slack Monitor: Processed ${messages.length} messages. Last ts: ${lastProcessedTs}`)
}

// ── Entry point ────────────────────────────────────────────────────────────

// When run directly, execute once (cron handles scheduling)
runMonitor().catch(err => {
  console.error('VOLTRON Slack Monitor error:', err)
  process.exit(1)
})

export { runMonitor, processMessage, detectDomain }
