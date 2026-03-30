import type { SlackItem, ForgeItem, RouteRecord } from './types.js'

const TM_API_URL = process.env.TM_API_BASE || ''
const MDJ_URL = process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'
const JDM_USER_ID = 'U09BBHTN8F2'
const CHANNEL_ID = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'

async function postSlack(channel: string, text: string): Promise<void> {
  try {
    await fetch(`${MDJ_URL}/dojo/slack/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
      body: JSON.stringify({ channel, text })
    })
  } catch { /* silent */ }
}

export async function routeToRonin(
  item: SlackItem | ForgeItem, reasoning: string
): Promise<RouteRecord | null> {
  const title = 'title' in item ? item.title : item.text.slice(0, 120)
  const description = 'description' in item ? item.description : item.text
  try {
    const resp = await fetch(`${MDJ_URL}/api/tracker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
      body: JSON.stringify({ title, description, type: 'bug', status: 'open',
        source: 'raiden', agent: 'raiden', raiden_action: 'routed_to_ronin', resolution: reasoning })
    })
    const json = await resp.json() as { success: boolean; data?: { item_id?: string } }
    if (!json.success) return null
    const trkId = json.data?.item_id || 'unknown'

    await postSlack(JDM_USER_ID, `RAIDEN\n\nROUTED TO RONIN: ${title}\n\nWhy: ${reasoning}\nTicket: ${trkId}\n\n- @RAIDEN`)
    await postSlack(CHANNEL_ID, `ROUTED TO RONIN: ${title} -> ${trkId}\nReason: ${reasoning}\n- @RAIDEN`)
    return { issue: title, trk: trkId, reason: reasoning }
  } catch (err) { console.error('[RAIDEN] Route failed:', err); return null }
}
