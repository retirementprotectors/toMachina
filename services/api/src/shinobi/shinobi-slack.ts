// src/shinobi/shinobi-slack.ts — Slack channel reader/poster for Shinobi
// Stub: TRK-13779. Minimal exports to unblock TRK-13784 (escalate) and TRK-13783 (message).

const SHINOBI_CHANNEL = 'C0AP2QL9Z6X'
const JDM_SLACK_ID = 'U09BBHTN8F2'

async function slackPost(endpoint: string, payload: Record<string, unknown>): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[shinobi-slack] SLACK_BOT_TOKEN not set — skipping Slack post')
    return
  }
  const res = await fetch(`https://slack.com/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const data = (await res.json()) as { ok: boolean; error?: string }
  if (!data.ok) console.error(`[shinobi-slack] ${endpoint} failed:`, data.error)
}

/**
 * Read recent messages from the Shinobi channel.
 * Returns up to `limit` messages (default 20), newest first.
 */
export async function readChannel(limit = 20): Promise<{ messages: Array<Record<string, unknown>> }> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[shinobi-slack] SLACK_BOT_TOKEN not set — returning empty messages')
    return { messages: [] }
  }
  const url = `https://slack.com/api/conversations.history?channel=${SHINOBI_CHANNEL}&limit=${limit}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json()) as { ok: boolean; messages?: Array<Record<string, unknown>>; error?: string }
  if (!data.ok) {
    console.error('[shinobi-slack] conversations.history failed:', data.error)
    return { messages: [] }
  }
  return { messages: data.messages ?? [] }
}

export async function postToChannel(text: string, thread_ts?: string): Promise<void> {
  const payload: Record<string, unknown> = { channel: SHINOBI_CHANNEL, text }
  if (thread_ts) payload.thread_ts = thread_ts
  await slackPost('chat.postMessage', payload)
}

export async function dmJdm(text: string): Promise<void> {
  await slackPost('chat.postMessage', { channel: JDM_SLACK_ID, text })
}
