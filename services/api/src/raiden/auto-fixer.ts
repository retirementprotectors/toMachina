import type { SlackItem, ForgeItem, FixRecord } from './types.js'

const MDJ_URL = process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'

export async function executeAutoFix(
  item: SlackItem | ForgeItem, reasoning: string
): Promise<FixRecord | null> {
  const title = 'title' in item ? item.title : item.text.slice(0, 80)
  const description = 'description' in item ? item.description : item.text

  try {
    // Delegate to MDJ_SERVER which has claudeInvoke capability
    const res = await fetch(`${MDJ_URL}/raiden/auto-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
      body: JSON.stringify({ title, description, reasoning })
    })
    if (!res.ok) return null
    const json = await res.json() as { data?: { pr?: number; branch?: string } }
    return {
      issue: title,
      pr: json.data?.pr || 0,
      branch: json.data?.branch || `fix/raiden-${Date.now()}`
    }
  } catch (err) {
    console.error('[RAIDEN] Auto-fix delegation failed:', err)
    return null
  }
}
