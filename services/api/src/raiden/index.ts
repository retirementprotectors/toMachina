import { Router } from 'express'

export const raidenRoutes = Router()

let lastRunTimestamp: string | null = null
export function setLastRun(ts: string) { lastRunTimestamp = ts }

raidenRoutes.get('/status', (_req, res) => {
  res.json({ success: true, data: { running: true, lastRun: lastRunTimestamp } })
})
