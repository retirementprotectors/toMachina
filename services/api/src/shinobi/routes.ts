// src/shinobi/routes.ts — Shinobi Express router
// TRK-13777 (scaffold) + TRK-13786 (full /status implementation)

import { Router, type Request, type Response } from 'express'
import { getShinobiState } from './shinobi-state.js'
import { getLatestRun } from './ronin-monitor.js'
import { startSprint } from './shinobi-sprint.js'
import { handleEscalation } from './shinobi-escalate.js'
import { shinobiQuery } from './shinobi-agent.js'
import { postToChannel } from './shinobi-slack.js'
import { runCheck } from './shinobi-check.js'

export const shinobiRoutes = Router()

const SERVER_START = Date.now()

// POST /shinobi/message — TRK-13783: Receive Slack message → shinobiQuery → post response
shinobiRoutes.post('/message', async (req: Request, res: Response) => {
  try {
    const { channel_id, user_id, text, thread_ts } = req.body
    if (!text) {
      res.status(400).json({ success: false, error: 'Missing required field: text' })
      return
    }
    const context: Record<string, unknown> = { channel_id, user_id, thread_ts }
    const { response, actions_taken } = await shinobiQuery(text, context)
    await postToChannel(response, thread_ts)
    res.json({ success: true, data: { response_text: response, actions_taken } })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

// POST /shinobi/check — TRK-13781: Cron logic — read Slack, check RONIN, auto-retry transient
shinobiRoutes.post('/check', async (_req: Request, res: Response) => {
  try {
    const result = await runCheck()
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

// POST /shinobi/escalate — TRK-13784: Accept escalation from RONIN/RAIDEN
shinobiRoutes.post('/escalate', async (req: Request, res: Response) => {
  try {
    const result = await handleEscalation(req.body)
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

// POST /shinobi/sprint — TRK-13785: Accept sprint name + discovery URL, validate, start RONIN
shinobiRoutes.post('/sprint', async (req: Request, res: Response) => {
  try {
    const result = await startSprint(req.body)
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('Missing required') || message.includes('must be a valid') ? 400 : 500
    res.status(status).json({ success: false, error: message })
  }
})

// GET /shinobi/status — TRK-13786: Full implementation
// Returns: current state, active task, last check time, RONIN sprint status, uptime
shinobiRoutes.get('/status', async (_req: Request, res: Response) => {
  try {
    const state = await getShinobiState()
    const latestRun = await getLatestRun()

    res.json({
      success: true,
      data: {
        state: state.state,
        active_task: state.active_task,
        last_check: state.last_check,
        ronin_sprint: latestRun ? {
          name: latestRun.sprint_name,
          phase: latestRun.phase,
          status: latestRun.status,
        } : state.ronin_sprint,
        uptime: Date.now() - SERVER_START,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})
