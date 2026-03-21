/**
 * Intake API Routes — execute-wire, approve, reject
 * Called by the wire-trigger Cloud Function (execute-wire) and by
 * portal UI for human-in-the-loop approval/rejection.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import { executeWire, resumeWireAfterApproval } from '@tomachina/core/src/atlas/wire-executor.js'
import type { WireInput, WireContext } from '@tomachina/core/src/atlas/wire-executor.js'

export const intakeRoutes = Router()

// ---------------------------------------------------------------------------
// POST /api/intake/execute-wire
// Called by wire-trigger Cloud Function. Receives normalized input and runs
// the full wire pipeline on Cloud Run where poppler-utils is available.
// ---------------------------------------------------------------------------
intakeRoutes.post('/execute-wire', async (req: Request, res: Response) => {
  try {
    const { wire_id, input, queue_id } = req.body as {
      wire_id: string
      input: Record<string, unknown>
      queue_id: string
    }

    if (!wire_id || !input) {
      res.status(400).json(errorResponse('wire_id and input are required'))
      return
    }

    const db = getFirestore()

    // Build wire context
    const context: WireContext = {
      wire_id,
      user_email: 'system@retireprotected.com',
      source_file_ids: (input.file_ids as string[]) || [],
      dry_run: false,
      approval_required: true,
    }

    // Build wire input
    const wireInput: WireInput = {
      file_id: input.file_id as string | undefined,
      file_ids: (input.file_ids as string[]) || [],
      data: input._meta,
      mode: (input.mode as 'document' | 'csv' | 'commission') || 'document',
    }

    // Audit writer callback — persists execution trail to Firestore
    const writeAudit = async (doc: Record<string, unknown>): Promise<string> => {
      const execColl = db.collection('wire_executions')
      const ref = execColl.doc()
      await ref.set(doc)
      return ref.id
    }

    const result = await executeWire(wire_id, wireInput, context, writeAudit)

    // Update intake_queue with result
    const now = new Date().toISOString()
    if (queue_id) {
      const queueColl = db.collection('intake_queue')
      const queueRef = queueColl.doc(queue_id)
      await queueRef.update({
        status: result.success ? (result.status === 'awaiting_approval' ? 'AWAITING_APPROVAL' : 'COMPLETE') : 'ERROR',
        wire_result: {
          success: result.success,
          execution_id: result.execution_id,
          stages: result.stages?.length || 0,
          created_records: result.created_records?.length || 0,
          execution_time_ms: result.execution_time_ms,
          status: result.status,
        },
        completed_at: now,
        updated_at: now,
      })
    }

    // TRK-528: Wire completion summary → Notifications DATA tab
    const meta = (input._meta || {}) as Record<string, unknown>
    const stageNames = (result.stages || []).map((s: { stage: string; status: string }) => `${s.stage}: ${s.status}`)
    await db.collection('notifications').add({
      type: 'wire_completion',
      source_type: 'wire',
      title: result.success
        ? `Document processed — ${(meta.file_name as string) || 'Unknown file'}`
        : `Wire failed — ${(meta.file_name as string) || 'Unknown file'}`,
      body: result.success
        ? `${result.created_records?.length || 0} records created/updated via ${wire_id}. ${(result.execution_time_ms / 1000).toFixed(1)}s.`
        : `Wire stopped at stage ${stageNames[stageNames.length - 1] || 'unknown'}. ${(result.execution_time_ms / 1000).toFixed(1)}s.`,
      metadata: {
        wire_id,
        execution_id: result.execution_id,
        source: (meta.source as string) || 'unknown',
        file_name: (meta.file_name as string) || null,
        client_id: (meta.client_id as string) || null,
        status: result.status,
        stages_completed: (result.stages || []).filter((s: { status: string }) => s.status === 'complete').length,
        stages_total: (result.stages || []).length,
        created_records: result.created_records?.length || 0,
        execution_time_ms: result.execution_time_ms,
      },
      read: false,
      created_at: now,
    })

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/intake/execute-wire error:', err)
    res.status(500).json(errorResponse('Wire execution failed'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/intake/:executionId/approve
// Resume a paused wire execution after human approval.
// ---------------------------------------------------------------------------
intakeRoutes.post('/:executionId/approve', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.executionId)
    const { approved_data, wire_id } = req.body as {
      approved_data: unknown
      wire_id: string
    }

    if (!wire_id || !executionId) {
      res.status(400).json(errorResponse('wire_id and executionId are required'))
      return
    }

    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    const context: WireContext = {
      wire_id,
      user_email: userEmail,
      source_file_ids: [],
      dry_run: false,
      approval_required: false, // Already approved
    }

    const db = getFirestore()

    const writeAudit = async (doc: Record<string, unknown>): Promise<string> => {
      const execColl = db.collection('wire_executions')
      const ref = execColl.doc()
      await ref.set(doc)
      return ref.id
    }

    const result = await resumeWireAfterApproval(wire_id, executionId, approved_data, context, writeAudit)

    // Update intake_queue
    const queueColl = db.collection('intake_queue')
    const queueSnap = await queueColl
      .where('wire_result.execution_id', '==', executionId)
      .limit(1)
      .get()

    if (!queueSnap.empty) {
      await queueSnap.docs[0].ref.update({
        status: result.success ? 'COMPLETE' : 'ERROR',
        approved_by: userEmail,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/intake/:executionId/approve error:', err)
    res.status(500).json(errorResponse('Approval failed'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/intake/:executionId/reject
// Reject a paused wire execution. Marks queue entry as REJECTED.
// ---------------------------------------------------------------------------
intakeRoutes.post('/:executionId/reject', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.executionId)
    const { reason } = req.body as { reason?: string }
    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    const db = getFirestore()
    const queueColl = db.collection('intake_queue')
    const queueSnap = await queueColl
      .where('wire_result.execution_id', '==', executionId)
      .limit(1)
      .get()

    if (!queueSnap.empty) {
      await queueSnap.docs[0].ref.update({
        status: 'REJECTED',
        rejected_by: userEmail,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || '',
        updated_at: new Date().toISOString(),
      })
    }

    res.json(successResponse({ rejected: true, execution_id: executionId }))
  } catch (err) {
    console.error('POST /api/intake/:executionId/reject error:', err)
    res.status(500).json(errorResponse('Rejection failed'))
  }
})
