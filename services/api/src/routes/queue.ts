// CEO Action Queue — /api/queue
// Mobile-first decision queue for JDM. Items arrive as INT-classified from triage engine.
// Approve -> warrior pipeline (RDN-new / RON-new / VLT-new)
// Decline -> INT-declined with reason
// Reclassify -> change recommendation + re-route
// Comment -> Slack DM to division leader

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  param,
} from '../lib/helpers.js'
import type {
  QueueListDTO,
  QueueApproveResult,
  QueueDeclineResult,
  QueueReclassifyResult,
  QueueCommentResult,
} from '@tomachina/core'

export const queueRoutes = Router()
const COLLECTION = 'tracker_items'

const JDM_SLACK_ID = 'U09BBHTN8F2'

// Division leader routing — used for comment DMs
const DIVISION_LEADERS: Record<string, { name: string; slackId: string }> = {
  'B2E': { name: 'SHINOB1', slackId: JDM_SLACK_ID },
  'Service': { name: 'Nikki Gray', slackId: JDM_SLACK_ID },
  'Sales': { name: 'Vince Vazquez', slackId: JDM_SLACK_ID },
  'B2B': { name: 'Matt McCormick', slackId: JDM_SLACK_ID },
  'Legacy': { name: 'Dr. Aprille Trupiano', slackId: JDM_SLACK_ID },
  'Executive': { name: 'SHINOB1', slackId: JDM_SLACK_ID },
}

// Map triage recommendation to warrior status
const REC_TO_STATUS: Record<string, string> = {
  FIX: 'RDN-new',
  FEATURE: 'RON-new',
  FILE: 'VLT-new',
  TRAIN: 'VLT-new',
}

const REC_TO_WARRIOR: Record<string, string> = {
  FIX: 'RAIDEN',
  FEATURE: 'RONIN',
  FILE: 'VOLTRON',
  TRAIN: 'VOLTRON',
}

// Slack post helper — mirrors channel-notifier.ts pattern
async function slackPost(
  channel: string,
  text: string,
  threadTs?: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) {
    console.warn('[queue] SLACK_BOT_TOKEN not set — skipping post')
    return { success: false, error: 'SLACK_BOT_TOKEN not set' }
  }
  try {
    const payload: Record<string, unknown> = { channel, text }
    if (threadTs) payload.thread_ts = threadTs
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
      body: JSON.stringify(payload),
    })
    const json = (await resp.json()) as { ok: boolean; ts?: string; error?: string }
    if (!json.ok) {
      console.error('[queue] Slack post failed:', json.error)
      return { success: false, error: json.error }
    }
    return { success: true, ts: json.ts }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[queue] Slack post threw:', msg)
    return { success: false, error: msg }
  }
}

// GET /api/queue — list items awaiting CEO triage (INT-new + INT-classified)
queueRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db
      .collection(COLLECTION)
      .where('status', 'in', ['INT-new', 'INT-classified'])
      .get()

    // Sort in memory — avoids composite index requirement
    const toSortable = (v: unknown): string => {
      if (typeof v === 'string') return v
      if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate().toISOString()
      return ''
    }
    const items = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
      .sort((a, b) => toSortable(b.created_at).localeCompare(toSortable(a.created_at)))

    res.json(successResponse<QueueListDTO>(items as unknown as QueueListDTO))
  } catch (err) {
    console.error('GET /api/queue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /api/queue/count — lightweight count for digest / badge
queueRoutes.get('/count', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db
      .collection(COLLECTION)
      .where('status', 'in', ['INT-new', 'INT-classified'])
      .count()
      .get()

    const count = snapshot.data().count
    res.json(successResponse<{ count: number }>({ count }))
  } catch (err) {
    console.error('GET /api/queue/count error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /api/queue/:id/approve — approve item, route to warrior pipeline
// Body: { recommendation?: 'FIX' | 'FEATURE' | 'FILE' }
queueRoutes.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const docRef = db.collection(COLLECTION).doc(param(req.params.id))
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Queue item not found'))
      return
    }

    const data = doc.data() as Record<string, unknown>
    const rec = (req.body.recommendation || data.triage_recommendation || 'FIX') as string
    const newStatus = REC_TO_STATUS[rec] || 'RDN-new'
    const warrior = REC_TO_WARRIOR[rec] || 'RAIDEN'
    const now = new Date().toISOString()
    const user = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    await docRef.update({
      status: newStatus,
      approved_by: user,
      approved_at: now,
      approved_recommendation: rec,
      updated_at: now,
      _updated_by: user,
    })

    // Post to dojo-fixes channel
    const dojoChannel = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
    await slackPost(
      dojoChannel,
      `${data.item_id} classified as ${rec} (${data.priority || 'P2'}). On it. -- ${warrior}`,
    )

    const updated = { ...data, id: doc.id, status: newStatus, approved_by: user, approved_at: now, updated_at: now }
    res.json(successResponse<QueueApproveResult>({
      item: updated as unknown as QueueApproveResult['item'],
      routed_to: warrior,
      new_status: newStatus,
    }))
  } catch (err) {
    console.error('POST /api/queue/:id/approve error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /api/queue/:id/decline — decline item with reason
// Body: { reason: string }
queueRoutes.post('/:id/decline', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const docRef = db.collection(COLLECTION).doc(param(req.params.id))
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Queue item not found'))
      return
    }

    const data = doc.data() as Record<string, unknown>
    const reason = (req.body.reason as string) || 'Declined by CEO'
    const now = new Date().toISOString()
    const user = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    await docRef.update({
      status: 'INT-declined',
      declined_by: user,
      declined_at: now,
      decline_reason: reason,
      updated_at: now,
      _updated_by: user,
    })

    const dojoChannel = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
    await slackPost(dojoChannel, `${data.item_id} declined: ${reason} -- Sensei`)

    const updated = { ...data, id: doc.id, status: 'INT-declined', decline_reason: reason, updated_at: now }
    res.json(successResponse<QueueDeclineResult>({
      item: updated as unknown as QueueDeclineResult['item'],
      reason,
    }))
  } catch (err) {
    console.error('POST /api/queue/:id/decline error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /api/queue/:id/reclassify — change recommendation and re-route
// Body: { recommendation: 'FIX' | 'FEATURE' | 'FILE' }
queueRoutes.post('/:id/reclassify', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const docRef = db.collection(COLLECTION).doc(param(req.params.id))
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Queue item not found'))
      return
    }

    if (!req.body.recommendation) {
      res.status(400).json(errorResponse('recommendation is required (FIX, FEATURE, or FILE)'))
      return
    }

    const data = doc.data() as Record<string, unknown>
    const oldRec = (data.triage_recommendation as string) || 'unknown'
    const newRec = req.body.recommendation as string
    const newStatus = REC_TO_STATUS[newRec] || 'RDN-new'
    const warrior = REC_TO_WARRIOR[newRec] || 'RAIDEN'
    const now = new Date().toISOString()
    const user = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    await docRef.update({
      status: newStatus,
      triage_recommendation: newRec,
      reclassified_by: user,
      reclassified_at: now,
      reclassified_from: oldRec,
      approved_by: user,
      approved_at: now,
      updated_at: now,
      _updated_by: user,
    })

    const dojoChannel = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
    await slackPost(
      dojoChannel,
      `${data.item_id} reclassified: ${oldRec} -> ${newRec}. Routed to ${warrior}. -- Sensei`,
    )

    const updated = { ...data, id: doc.id, status: newStatus, triage_recommendation: newRec, updated_at: now }
    res.json(successResponse<QueueReclassifyResult>({
      item: updated as unknown as QueueReclassifyResult['item'],
      old_recommendation: oldRec,
      new_recommendation: newRec,
      new_status: newStatus,
    }))
  } catch (err) {
    console.error('POST /api/queue/:id/reclassify error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /api/queue/:id/comment — send comment to division leader via Slack DM
// Body: { message: string, recipient?: string }
queueRoutes.post('/:id/comment', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const docRef = db.collection(COLLECTION).doc(param(req.params.id))
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Queue item not found'))
      return
    }

    if (!req.body.message) {
      res.status(400).json(errorResponse('message is required'))
      return
    }

    const data = doc.data() as Record<string, unknown>
    const division = (data.division as string) || 'Executive'
    const leader = DIVISION_LEADERS[division] || DIVISION_LEADERS['Executive']
    const recipientId = (req.body.recipient as string) || leader.slackId
    const recipientName = leader.name
    const message = req.body.message as string

    const slackText = `Re: ${data.item_id} "${data.title}"\n\nFrom JDM: ${message}`
    const result = await slackPost(recipientId, slackText)

    // Attach comment as note on the tracker item
    const now = new Date().toISOString()
    const existingNotes = ((data.notes as string) || '').trim()
    const newNote = `[${now}] JDM to ${recipientName}: ${message}`
    const notes = existingNotes ? `${existingNotes}\n${newNote}` : newNote
    await docRef.update({ notes, updated_at: now })

    res.json(successResponse<QueueCommentResult>({
      sent: result.success,
      recipient: recipientName,
      channel: recipientId,
      ts: result.ts,
    }))
  } catch (err) {
    console.error('POST /api/queue/:id/comment error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
