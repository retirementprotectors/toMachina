import { Router } from 'express'
import { postNewSubmission, postDuplicateDetected, postInProgress, postFixed } from './channel-notifier.js'

export const raidenRoutes = Router()

let lastRunTimestamp: string | null = null
export function setLastRun(ts: string) { lastRunTimestamp = ts }

raidenRoutes.get('/status', (_req, res) => {
  res.json({ success: true, data: { running: true, lastRun: lastRunTimestamp } })
})

// TRK-14240: Manual channel event triggers (for RAIDEN scheduler + testing)
// POST /raiden/channel/new — post 🔴 NEW event
raidenRoutes.post('/channel/new', async (req, res) => {
  const { title, trk_id, reporter, type, priority } = req.body as {
    title: string; trk_id: string; reporter: string; type?: string; priority?: string
  }
  if (!title || !trk_id) {
    res.status(400).json({ success: false, error: 'title and trk_id are required' })
    return
  }
  const result = await postNewSubmission(title, trk_id, reporter || 'unknown', type || 'bug', priority || 'P2')
  res.json({ success: result.success, data: { ts: result.ts }, error: result.error })
})

// POST /raiden/channel/duplicate — post ⚠️ DUPLICATE event
raidenRoutes.post('/channel/duplicate', async (req, res) => {
  const { trk_id, title, status } = req.body as { trk_id: string; title: string; status: string }
  if (!trk_id || !title) {
    res.status(400).json({ success: false, error: 'trk_id and title are required' })
    return
  }
  const result = await postDuplicateDetected(trk_id, title, status || 'unknown')
  res.json({ success: result.success, data: { ts: result.ts }, error: result.error })
})

// POST /raiden/channel/in-progress — post 🔧 IN PROGRESS event
raidenRoutes.post('/channel/in-progress', async (req, res) => {
  const { trk_id, title } = req.body as { trk_id: string; title: string }
  if (!trk_id || !title) {
    res.status(400).json({ success: false, error: 'trk_id and title are required' })
    return
  }
  const result = await postInProgress(trk_id, title)
  res.json({ success: result.success, data: { ts: result.ts }, error: result.error })
})

// POST /raiden/channel/fixed — post ✅ FIXED event
raidenRoutes.post('/channel/fixed', async (req, res) => {
  const { trk_id, title } = req.body as { trk_id: string; title: string }
  if (!trk_id || !title) {
    res.status(400).json({ success: false, error: 'trk_id and title are required' })
    return
  }
  const result = await postFixed(trk_id, title)
  res.json({ success: result.success, data: { ts: result.ts }, error: result.error })
})

// Re-export channel notifier for other modules
export { postNewSubmission, postDuplicateDetected, postInProgress, postFixed } from './channel-notifier.js'
export { checkForDuplicate } from './duplicate-guard.js'
