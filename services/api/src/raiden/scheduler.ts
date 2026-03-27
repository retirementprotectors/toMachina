import { setLastRun } from './index.js'

const CYCLE_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

let intervalId: ReturnType<typeof setInterval> | null = null

export function startRaidenScheduler(): void {
  if (intervalId) return // already running

  console.log('[RAIDEN] Scheduler started — 15-minute cycle')

  intervalId = setInterval(async () => {
    const now = new Date().toISOString()
    console.log(`[RAIDEN] Cycle started at ${now}`)
    // Future tickets will add: poll Slack, poll FORGE, triage, execute, log
    setLastRun(now)
  }, CYCLE_INTERVAL_MS)
}

export function stopRaidenScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[RAIDEN] Scheduler stopped')
  }
}
