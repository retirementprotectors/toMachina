/**
 * Intake API Routes — execute-wire, approve, reject
 * Called by the wire-trigger Cloud Function (execute-wire) and by
 * portal UI for human-in-the-loop approval/rejection.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import type { IntakeWireResult, IntakeApproveResult, IntakeRejectResult } from '@tomachina/core'
import { resumeWireAfterApproval } from './wire.js'
import { buildAcfCallbacks } from '../lib/acf-callbacks.js'

export const intakeRoutes = Router()

/** Load executeWire dynamically (same pattern as wire.ts) */
interface WireResult {
  success: boolean
  wire_id: string
  execution_id: string
  stages: Array<{ stage: string; status: string }>
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  status: string
}

async function loadExecuteWire(): Promise<
  (wireId: string, input: unknown, context: unknown, writeAudit?: (doc: Record<string, unknown>) => Promise<string>) => Promise<WireResult>
> {
  const mod = await import('@tomachina/core/atlas/wire-executor')
  return mod.executeWire as unknown as (wireId: string, input: unknown, context: unknown, writeAudit?: (doc: Record<string, unknown>) => Promise<string>) => Promise<WireResult>
}

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
    const meta = (input._meta || {}) as Record<string, unknown>

    // Build wire context — includes ACF callbacks so ACF_FINALIZE can
    // look up client folders, move files, and update document_index.
    const context = {
      wire_id,
      user_email: 'system@retireprotected.com',
      source_file_ids: (input.file_ids as string[]) || [],
      dry_run: false,
      approval_required: true,
      // Metadata from intake queue — carried through to super tools
      client_id: (meta.client_id as string) || undefined,
      source: (meta.source as string) || undefined,
      file_id: (input.file_id as string) || undefined,
      source_folder_id: (meta.source_folder_id as string) || undefined,
      // Drive + Firestore callbacks for ACF_FINALIZE
      ...buildAcfCallbacks(),
    }

    // Build wire input
    const wireInput = {
      file_id: input.file_id as string | undefined,
      file_ids: (input.file_ids as string[]) || [],
      data: input._meta,
      mode: (input.mode as string) || 'document',
    }

    // Audit writer callback — persists execution trail to Firestore
    const writeAudit = async (doc: Record<string, unknown>): Promise<string> => {
      const execColl = db.collection('wire_executions')
      const ref = execColl.doc()
      await ref.set(doc)
      return ref.id
    }

    const executeWire = await loadExecuteWire()
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

    res.json(successResponse<IntakeWireResult>(result as unknown as IntakeWireResult))
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

    const db = getFirestore()

    // Use the wire.ts resumeWireAfterApproval (2-arg version: executionId + email)
    const result = await resumeWireAfterApproval(executionId, userEmail)

    // Update intake_queue
    const queueColl = db.collection('intake_queue')
    const queueSnap = await queueColl
      .where('wire_result.execution_id', '==', executionId)
      .limit(1)
      .get()

    if (!queueSnap.empty) {
      await queueSnap.docs[0].ref.update({
        status: result?.success ? 'COMPLETE' : 'ERROR',
        approved_by: userEmail,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    res.json(successResponse<IntakeApproveResult>(result as unknown as IntakeApproveResult))
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

    res.json(successResponse<IntakeRejectResult>({ rejected: true, execution_id: executionId } as unknown as IntakeRejectResult))
  } catch (err) {
    console.error('POST /api/intake/:executionId/reject error:', err)
    res.status(500).json(errorResponse('Rejection failed'))
  }
})
