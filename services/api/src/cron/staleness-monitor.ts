// ---------------------------------------------------------------------------
// Source Staleness Monitor — ZRD-D09
// ---------------------------------------------------------------------------
// Daily cron job that checks source_registry for stale entries.
// Stale = lastRefreshDate > 30 days ago (warning) or > 60 days (critical).
// Reports via Slack to MEGAZORD channel / JDM DM for critical.
// ---------------------------------------------------------------------------

import { getFirestore } from 'firebase-admin/firestore'

const STALE_WARNING_DAYS = 30
const STALE_CRITICAL_DAYS = 60
const JDM_SLACK_ID = 'U09BBHTN8F2'

export interface StalenessResult {
  checked: number
  stale_warning: number
  stale_critical: number
  fresh: number
  stale_sources: Array<{
    source_id: string
    carrier: string
    last_refresh: string | null
    days_stale: number
    severity: 'warning' | 'critical'
  }>
  checked_at: string
}

/**
 * Run the staleness monitor. Returns a structured report.
 * Optionally sends Slack notifications if SLACK_BOT_TOKEN is set.
 */
export async function runStalenessMonitor(): Promise<StalenessResult> {
  const db = getFirestore()
  const now = Date.now()
  const snap = await db.collection('source_registry').where('status', '==', 'ACTIVE').get()

  const staleSources: StalenessResult['stale_sources'] = []
  let fresh = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const lastRefresh = data.last_pull || data.lastRefreshDate || data.last_refresh || null

    if (!lastRefresh) {
      // No refresh date = treat as stale critical
      staleSources.push({
        source_id: doc.id,
        carrier: String(data.carrier || doc.id),
        last_refresh: null,
        days_stale: 999,
        severity: 'critical',
      })
      continue
    }

    const refreshTime = new Date(lastRefresh).getTime()
    if (isNaN(refreshTime)) {
      staleSources.push({
        source_id: doc.id,
        carrier: String(data.carrier || doc.id),
        last_refresh: String(lastRefresh),
        days_stale: 999,
        severity: 'critical',
      })
      continue
    }

    const daysSince = Math.floor((now - refreshTime) / (1000 * 60 * 60 * 24))

    if (daysSince > STALE_CRITICAL_DAYS) {
      staleSources.push({
        source_id: doc.id,
        carrier: String(data.carrier || doc.id),
        last_refresh: lastRefresh,
        days_stale: daysSince,
        severity: 'critical',
      })
    } else if (daysSince > STALE_WARNING_DAYS) {
      staleSources.push({
        source_id: doc.id,
        carrier: String(data.carrier || doc.id),
        last_refresh: lastRefresh,
        days_stale: daysSince,
        severity: 'warning',
      })
    } else {
      fresh++
    }
  }

  const result: StalenessResult = {
    checked: snap.size,
    stale_warning: staleSources.filter(s => s.severity === 'warning').length,
    stale_critical: staleSources.filter(s => s.severity === 'critical').length,
    fresh,
    stale_sources: staleSources,
    checked_at: new Date().toISOString(),
  }

  // Send Slack notifications if token is available
  await sendSlackNotifications(result)

  return result
}

async function sendSlackNotifications(result: StalenessResult): Promise<void> {
  const slackToken = process.env.SLACK_BOT_TOKEN
  if (!slackToken) return
  if (result.stale_sources.length === 0) return

  try {
    const warnings = result.stale_sources.filter(s => s.severity === 'warning')
    const criticals = result.stale_sources.filter(s => s.severity === 'critical')

    // Build message
    const lines: string[] = [
      '*MEGAZORD Staleness Monitor*',
      `Checked ${result.checked} sources at ${result.checked_at}`,
      '',
    ]

    if (criticals.length > 0) {
      lines.push(`:red_circle: *${criticals.length} CRITICAL* (>60 days stale):`)
      for (const s of criticals) {
        lines.push(`  • ${s.carrier} — ${s.days_stale === 999 ? 'never refreshed' : `${s.days_stale} days`}`)
      }
      lines.push('')
    }

    if (warnings.length > 0) {
      lines.push(`:large_yellow_circle: *${warnings.length} WARNING* (>30 days stale):`)
      for (const s of warnings) {
        lines.push(`  • ${s.carrier} — ${s.days_stale} days`)
      }
      lines.push('')
    }

    lines.push(`:large_green_circle: ${result.fresh} sources fresh`)

    const text = lines.join('\n')

    // Send to JDM DM for critical alerts
    if (criticals.length > 0) {
      await postSlackMessage(slackToken, JDM_SLACK_ID, text)
    }
  } catch (err) {
    // Non-blocking: log and continue
    console.error('Staleness monitor Slack notification failed:', err)
  }
}

async function postSlackMessage(token: string, channel: string, text: string): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, text }),
  })
}
