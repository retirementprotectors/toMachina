// src/shinobi/shinobi-slack.ts — Slack channel reader/poster for Shinobi
// TRK-13779: Read unhandled messages from C0AP2QL9Z6X. Post responses. DM JDM.

const SHINOBI_CHANNEL = 'C0AP2QL9Z6X'
const JDM_SLACK_ID = 'U09BBHTN8F2'

async function slackPost(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[shinobi-slack] SLACK_BOT_TOKEN not set — skipping Slack post')
    return { success: false, error: 'SLACK_BOT_TOKEN not set' }
  }
  try {
    const res = await fetch(`https://slack.com/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as { ok: boolean; error?: string }
    if (!data.ok) {
      console.error(`[shinobi-slack] ${endpoint} failed:`, data.error)
      return { success: false, error: data.error }
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[shinobi-slack] ${endpoint} threw:`, message)
    return { success: false, error: message }
  }
}

/**
 * Read recent messages from the Shinobi channel.
 * Returns up to `limit` messages (default 20), newest first.
 */
export async function readChannel(limit = 20): Promise<{
  messages: Array<Record<string, unknown>>
  error?: string
}> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[shinobi-slack] SLACK_BOT_TOKEN not set — returning empty messages')
    return { messages: [], error: 'SLACK_BOT_TOKEN not set' }
  }
  try {
    const url = `https://slack.com/api/conversations.history?channel=${SHINOBI_CHANNEL}&limit=${limit}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = (await res.json()) as {
      ok: boolean
      messages?: Array<Record<string, unknown>>
      error?: string
    }
    if (!data.ok) {
      console.error('[shinobi-slack] conversations.history failed:', data.error)
      return { messages: [], error: data.error }
    }
    return { messages: data.messages ?? [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[shinobi-slack] conversations.history threw:', message)
    return { messages: [], error: message }
  }
}

/**
 * Post a message to the Shinobi channel, optionally in a thread.
 */
export async function postToChannel(
  text: string,
  thread_ts?: string,
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, unknown> = { channel: SHINOBI_CHANNEL, text }
  if (thread_ts) payload.thread_ts = thread_ts
  return slackPost('chat.postMessage', payload)
}

/**
 * Send a direct message to JDM (U09BBHTN8F2).
 */
export async function dmJdm(
  text: string,
): Promise<{ success: boolean; error?: string }> {
  return slackPost('chat.postMessage', { channel: JDM_SLACK_ID, text })
}
