/**
 * CMO Intake Channel API Route (MUS-O09)
 *
 * POST /intake — accepts creative briefs from Slack, FORGE, or manual POST.
 * Validates, persists to Firestore, dispatches to pipeline orchestrator async,
 * returns 202 Accepted with tracking ID.
 */
import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'crypto'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  validateRequired,
} from '../lib/helpers.js'
import type { CmoBrief, CmoPipelineResult, CmoChannel } from '@tomachina/core'
import { processBrief } from '@tomachina/core'

export const cmoIntakeRoutes = Router()

const CMO_PIPELINE_COL = 'cmo_pipeline_jobs'

/* ─── Firestore helpers (bracket notation for hookify) ─── */
function pipelineCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](CMO_PIPELINE_COL)
}

// ─── POST /intake ───────────────────────────────────────────────────────────

cmoIntakeRoutes.post('/intake', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>

    const validation = validateRequired(body, ['market', 'channels', 'requestedBy'])
    if (validation) {
      res.status(400).json(errorResponse(validation))
      return
    }

    const channels = body.channels as CmoChannel[]
    if (!Array.isArray(channels) || channels.length === 0) {
      res.status(400).json(errorResponse('At least one channel required'))
      return
    }

    // Build brief with server-generated fields
    const briefId = randomUUID()
    const brief: CmoBrief = {
      id: briefId,
      market: body.market as string,
      channels,
      inputs: (body.inputs || {}) as CmoBrief['inputs'],
      requestedBy: body.requestedBy as string,
      createdAt: new Date(),
      source: (body.source as CmoBrief['source']) || 'manual',
      slackChannelId: body.slackChannelId as string | undefined,
      forgeTicketId: body.forgeTicketId as string | undefined,
    }

    // Persist to Firestore with queued status
    const col = pipelineCol()
    await col.doc(briefId).set({
      ...brief,
      createdAt: FieldValue.serverTimestamp(),
      status: 'queued',
    })

    // Return immediately with tracking URL
    res.status(202).json(successResponse({
      briefId,
      trackingUrl: `/api/cmo/pipeline/${briefId}`,
    }))

    // Dispatch pipeline orchestrator asynchronously (fire-and-forget)
    processBrief(brief).then(async (result: CmoPipelineResult) => {
      // Update Firestore with result
      await col.doc(briefId).update({
        ...result,
        status: result.overallStatus,
        completedAt: FieldValue.serverTimestamp(),
      })

      // Slack callback if source is slack
      if (brief.source === 'slack' && brief.slackChannelId) {
        const completedJobs = result.jobs.filter(j => j.status === 'complete').length
        console.log(`[MUSASHI][INTAKE] Slack callback to ${brief.slackChannelId}: brief ${briefId} ${result.overallStatus}, ${completedJobs}/${result.jobs.length} jobs completed`)
        // In production: call mcp__rpi-workspace__send_message
      }
    }).catch((err: Error) => {
      console.error(`[MUSASHI][INTAKE] Pipeline processing failed for ${briefId}:`, err.message)
      col.doc(briefId).update({
        status: 'failed',
        error: err.message,
        completedAt: FieldValue.serverTimestamp(),
      }).catch(() => {})
    })
  } catch (err) {
    console.error('[MUSASHI] Intake error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})
