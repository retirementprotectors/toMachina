import type { SlackItem } from './types.js'
import { postThreadReply } from './channel-notifier.js'
import { checkForDuplicate } from './duplicate-guard.js'

// TRK-14239: RAIDEN monitors #dojo-fixes channel — same 15-min interval as Forge board
const MDJ_URL = process.env.MDJ_SERVER_URL || process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'
const CHANNEL_ID = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
const TRACKER_API = process.env.TRACKER_API_BASE || 'https://tm-api-production-run.a.run.app/api'
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

      // TRK-14239: Create tracker_item from Slack message + reply in-thread with TRK ID
      // Only process messages that look like bug reports (not bot confirmations)
      const text = msg.text || ''
      if (text.length > 5 && !text.startsWith('✅') && !text.startsWith('⚠️') && !text.startsWith('🔴') && !text.startsWith('🔧')) {
        try {
          const dupResult = await checkForDuplicate(text.slice(0, 80))
          if (!dupResult.isDuplicate) {
            // Create tracker item with source=slack
            const createRes = await fetch(`${TRACKER_API}/tracker`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
              body: JSON.stringify({
                title: text.slice(0, 120),
                description: text,
                type: 'bug',
                status: 'new',
                agent: 'raiden',
                source: 'slack',
                priority: 'P2',
                portal: 'SHARED',
              }),
            })
            if (createRes.ok) {
              const created = await createRes.json() as { data?: { item_id?: string; id?: string } }
              const trkId = created.data?.item_id || 'TRK-???'
              // Reply in-thread confirming ticket creation (TRK-14239 AC)
              await postThreadReply(msg.ts, trkId, 'new').catch((e: unknown) => {
                console.error('[RAIDEN] Thread reply failed:', e)
              })
              console.log(`[RAIDEN] Slack message → tracker item ${trkId} (source=slack)`)
            }
          }
        } catch (e) {
          console.error('[RAIDEN] Failed to create tracker item from Slack message:', e)
        }
      }

      seen.add(msg.ts)
      items.push({ message_ts: msg.ts, user: msg.user || 'unknown',
        text, channel: CHANNEL_ID, thread_ts: msg.thread_ts })
    }
    if (messages.length > 0) lastCheckedTs = messages[0].ts
    return items
  } catch (err) {
    console.error('[RAIDEN] Slack poll error:', err)
    return []
  }
}
