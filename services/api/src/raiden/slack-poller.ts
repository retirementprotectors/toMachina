import type { SlackItem } from './types.js'

const MDJ_URL = process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'
const CHANNEL_ID = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
let lastCheckedTs: string | null = null

export async function pollSlackChannel(): Promise<SlackItem[]> {
  try {
    const res = await fetch(`${MDJ_URL}/dojo/slack/history?channel=${CHANNEL_ID}&limit=100`, {
      headers: { 'X-MDJ-Auth': MDJ_AUTH }
    })
    if (!res.ok) return []
    const json = await res.json() as { data?: { messages?: Array<Record<string, string>> } }
    const messages = json.data?.messages || []
    const newMessages = lastCheckedTs
      ? messages.filter((m) => m.ts > lastCheckedTs!) : messages

    const seen = new Set<string>()
    const items: SlackItem[] = []
    for (const msg of newMessages) {
      if (seen.has(msg.ts) || msg.subtype === 'bot_message') continue
      seen.add(msg.ts)
      items.push({ message_ts: msg.ts, user: msg.user || 'unknown',
        text: msg.text || '', channel: CHANNEL_ID, thread_ts: msg.thread_ts })
    }
    if (messages.length > 0) lastCheckedTs = messages[0].ts
    return items
  } catch (err) {
    console.error('[RAIDEN] Slack poll error:', err)
    return []
  }
}
