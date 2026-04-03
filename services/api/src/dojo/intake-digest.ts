// Hourly DM digest — sends JDM a summary of pending intake items
// Only fires if there are items waiting. Runs as interval in server.ts.

import { getFirestore } from 'firebase-admin/firestore'

const JDM_SLACK_ID = 'U09BBHTN8F2'
const DIGEST_INTERVAL = 60 * 60 * 1000 // 1 hour

export function startIntakeDigest(): void {
  console.log('[intake-digest] Active — hourly DM to JDM when items pending')
  // Initial check after 2 minutes (let scheduler populate first)
  setTimeout(sendDigest, 2 * 60 * 1000)
  setInterval(sendDigest, DIGEST_INTERVAL)
}

export async function sendDigest(): Promise<void> {
  try {
    const db = getFirestore()
    const snapshot = await db
      .collection('tracker_items')
      .where('status', 'in', ['INT-new', 'INT-classified'])
      .get()

    if (snapshot.empty) {
      console.log('[intake-digest] No pending items — skipping DM')
      return
    }

    const items = snapshot.docs.map(d => d.data())

    // Count by recommendation
    const counts: Record<string, number> = {}
    const priorities: Record<string, number> = {}
    for (const item of items) {
      const rec = (item.triage_recommendation as string) || 'unclassified'
      counts[rec] = (counts[rec] || 0) + 1
      const p = (item.priority as string) || 'P2'
      priorities[p] = (priorities[p] || 0) + 1
    }

    // Build summary
    const lines: string[] = [
      `INTAKE: ${items.length} item${items.length === 1 ? '' : 's'} waiting for triage`,
      '',
    ]

    const recLabels: Record<string, string> = { FIX: 'Fixes', FEATURE: 'Features', FILE: 'Files', TRAIN: 'Training', unclassified: 'Unclassified' }
    for (const [rec, count] of Object.entries(counts)) {
      const pDetails = Object.entries(priorities).map(([p, c]) => `${c}x ${p}`).join(', ')
      lines.push(`${count} ${recLabels[rec] || rec} (${pDetails})`)
    }

    lines.push('')
    lines.push('https://prodash.tomachina.com/q')

    const text = lines.join('\n')

    // Send DM to JDM
    const botToken = process.env.SLACK_BOT_TOKEN
    if (!botToken) {
      console.warn('[intake-digest] SLACK_BOT_TOKEN not set — skipping')
      return
    }

    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
      body: JSON.stringify({ channel: JDM_SLACK_ID, text }),
    })
    const json = (await resp.json()) as { ok: boolean; error?: string }
    if (json.ok) {
      console.log(`[intake-digest] Sent DM: ${items.length} items`)
    } else {
      console.error('[intake-digest] Slack DM failed:', json.error)
    }
  } catch (err) {
    console.error('[intake-digest] Error:', err)
  }
}
