// ---------------------------------------------------------------------------
// Scheduled Wire Runs — ZRD-D10
// ---------------------------------------------------------------------------
// Configures recurring wire executions via Rangers.
// ACF Cleanup: weekly (Sunday 2am CT)
// Commission Sync: monthly (1st of month)
// Reference Seed: quarterly
// ---------------------------------------------------------------------------

import { getFirestore } from 'firebase-admin/firestore'

export type WireScheduleId = 'acf_weekly' | 'commission_monthly' | 'reference_quarterly'

export interface WireScheduleConfig {
  scheduleId: WireScheduleId
  rangerId: string
  wireId: string
  description: string
  cronExpression: string
  timezone: string
  enabled: boolean
}

export interface ScheduledRunResult {
  scheduleId: WireScheduleId
  rangerId: string
  dispatched: boolean
  runId?: string
  error?: string
  timestamp: string
}

// Default schedule configurations
export const WIRE_SCHEDULES: WireScheduleConfig[] = [
  {
    scheduleId: 'acf_weekly',
    rangerId: 'ranger-acf',
    wireId: 'WIRE_ACF_CLEANUP',
    description: 'ACF Cleanup — weekly folder/doc hygiene',
    cronExpression: '0 2 * * 0',  // Sunday 2am
    timezone: 'America/Chicago',
    enabled: true,
  },
  {
    scheduleId: 'commission_monthly',
    rangerId: 'ranger-commission',
    wireId: 'WIRE_COMMISSION_SYNC',
    description: 'Commission Sync — monthly per carrier',
    cronExpression: '0 3 1 * *',  // 1st of month, 3am
    timezone: 'America/Chicago',
    enabled: true,
  },
  {
    scheduleId: 'reference_quarterly',
    rangerId: 'ranger-reference',
    wireId: 'WIRE_REFERENCE_SEED',
    description: 'Reference Seed — quarterly carrier/product refresh',
    cronExpression: '0 4 1 1,4,7,10 *',  // 1st of Jan/Apr/Jul/Oct, 4am
    timezone: 'America/Chicago',
    enabled: true,
  },
]

/**
 * Check if a schedule should run based on current time.
 * Simple day-of-week / day-of-month check (not full cron parser).
 */
export function shouldRunNow(schedule: WireScheduleConfig, now: Date = new Date()): boolean {
  if (!schedule.enabled) return false

  const dayOfWeek = now.getDay()  // 0=Sunday
  const dayOfMonth = now.getDate()
  const month = now.getMonth() + 1  // 1-indexed

  switch (schedule.scheduleId) {
    case 'acf_weekly':
      return dayOfWeek === 0  // Sunday
    case 'commission_monthly':
      return dayOfMonth === 1  // 1st of month
    case 'reference_quarterly':
      return dayOfMonth === 1 && [1, 4, 7, 10].includes(month)
    default:
      return false
  }
}

/**
 * Run all scheduled wires that are due. Returns results for each dispatched wire.
 * This function is meant to be called once per day (e.g., from a cron job at 2am CT).
 */
export async function runScheduledWires(now: Date = new Date()): Promise<ScheduledRunResult[]> {
  const results: ScheduledRunResult[] = []

  // Load schedule overrides from Firestore config (if any)
  const schedules = await loadScheduleConfigs()

  for (const schedule of schedules) {
    if (!shouldRunNow(schedule, now)) continue

    const result = await dispatchScheduledWire(schedule)
    results.push(result)
  }

  // Notify on failures
  const failures = results.filter(r => !r.dispatched)
  if (failures.length > 0) {
    await notifyScheduleFailures(failures)
  }

  return results
}

/**
 * Load schedule configs from Firestore, falling back to defaults.
 */
async function loadScheduleConfigs(): Promise<WireScheduleConfig[]> {
  try {
    const db = getFirestore()
    const doc = await db.collection('config_registry').doc('wire_schedules').get()
    if (doc.exists) {
      const data = doc.data()
      if (data?.schedules && Array.isArray(data.schedules)) {
        return data.schedules as WireScheduleConfig[]
      }
    }
  } catch {
    // Fall back to defaults
  }
  return [...WIRE_SCHEDULES]
}

/**
 * Dispatch a single scheduled wire via the Ranger registry.
 */
async function dispatchScheduledWire(schedule: WireScheduleConfig): Promise<ScheduledRunResult> {
  const timestamp = new Date().toISOString()

  try {
    // Dynamic import to avoid circular deps with rangers
    const { getRanger } = await import('../rangers/registry.js')
    const entry = getRanger(schedule.rangerId)

    if (!entry) {
      return {
        scheduleId: schedule.scheduleId,
        rangerId: schedule.rangerId,
        dispatched: false,
        error: `Ranger "${schedule.rangerId}" not found in registry`,
        timestamp,
      }
    }

    const executionResult = await entry.executor(
      { params: { scheduled: true, scheduleId: schedule.scheduleId } },
      `cron:${schedule.scheduleId}`
    )

    return {
      scheduleId: schedule.scheduleId,
      rangerId: schedule.rangerId,
      dispatched: true,
      runId: executionResult.runId,
      timestamp,
    }
  } catch (err) {
    return {
      scheduleId: schedule.scheduleId,
      rangerId: schedule.rangerId,
      dispatched: false,
      error: err instanceof Error ? err.message : String(err),
      timestamp,
    }
  }
}

/**
 * Send Slack notification for failed scheduled runs.
 */
async function notifyScheduleFailures(failures: ScheduledRunResult[]): Promise<void> {
  const slackToken = process.env.SLACK_BOT_TOKEN
  if (!slackToken) return

  try {
    const lines = [
      ':red_circle: *MEGAZORD Scheduled Wire Failures*',
      '',
      ...failures.map(f => `• *${f.scheduleId}* (${f.rangerId}): ${f.error || 'Unknown error'}`),
    ]

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${slackToken}` },
      body: JSON.stringify({ channel: 'U09BBHTN8F2', text: lines.join('\n') }),
    })
  } catch (err) {
    console.error('Scheduled wire failure notification failed:', err)
  }
}
