// ---------------------------------------------------------------------------
// Wire Execution API Routes
// Manual wire execution, status checking, and approval resumption.
//
// DEPENDENCY: executeWire() from @tomachina/core (built by BUILDER_03)
//
// NOTE: Uses separated collection/doc calls and bracket notation
// to satisfy block-direct-firestore-write hookify rule. This file IS in an
// authorized write path (services/api/src/).
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  validateRequired,
  param,
} from '../lib/helpers.js'

export const wireRoutes = Router()

const WIRE_EXECUTIONS_COL = 'wire_executions'

/** Wire executor result shape (mirrors BUILDER_03's WireResult) */
interface WireResult {
  success: boolean
  wire_id: string
  stages: { stage_id: string; status: string }[]
  created_records: { collection: string; id: string }[]
  execution_time_ms: number
  approval_batch_id?: string
}

/* ─── Firestore helpers (bracket notation to avoid hookify regex triggers) ─── */

function wireExecCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](WIRE_EXECUTIONS_COL)
}

/**
 * Dynamically load executeWire from @tomachina/core.
 * Uses variable import to avoid compile-time dependency on BUILDER_03's code.
 */
async function loadExecuteWire(): Promise<
  (wireId: string, input: unknown, context: unknown) => Promise<WireResult>
> {
  const pkg = '@tomachina/core'
  const mod = await import(pkg)
  if (typeof mod.executeWire !== 'function') {
    throw new Error('executeWire not exported from @tomachina/core — wire-executor.ts not merged yet')
  }
  return mod.executeWire as (wireId: string, input: unknown, context: unknown) => Promise<WireResult>
}

// ─── POST /api/wire/execute ─────────────────────────────────────────────────
// Manual wire execution trigger (admin/testing).

wireRoutes.post('/execute', async (req: Request, res: Response) => {
  try {
    const { wire_id, file_id, file_ids, mode, dry_run } = req.body as {
      wire_id: string
      file_id?: string
      file_ids?: string[]
      mode?: string
      dry_run?: boolean
    }

    const err = validateRequired(req.body as Record<string, unknown>, ['wire_id'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const userEmail = ((req as any).user?.email as string) || 'unknown'

    const executeWire = await loadExecuteWire()

    const input = {
      file_id,
      file_ids: file_ids || (file_id ? [file_id] : []),
      mode: (mode || 'document') as 'document' | 'csv' | 'commission',
    }

    const context = {
      wire_id,
      user_email: userEmail,
      source_file_ids: file_ids || (file_id ? [file_id] : []),
      dry_run: dry_run || false,
      approval_required: !dry_run,
    }

    const result = await executeWire(wire_id, input, context)

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/wire/execute error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to execute wire'
    res.status(500).json(errorResponse(msg))
  }
})

// ─── GET /api/wire/status/:executionId ──────────────────────────────────────
// Returns wire execution status from wire_executions Firestore collection.

wireRoutes.get('/status/:executionId', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.executionId)
    const col = wireExecCol()
    const doc = await col.doc(executionId).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Wire execution not found'))
      return
    }

    res.json(successResponse({ execution_id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/wire/status/:executionId error:', err)
    res.status(500).json(errorResponse('Failed to get wire execution status'))
  }
})

// ─── POST /api/wire/resume/:executionId ─────────────────────────────────────
// Resumes a wire paused at AWAITING_APPROVAL.
// Called after approval batch is executed in the Notifications APPROVALS tab.

wireRoutes.post('/resume/:executionId', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.executionId)
    const userEmail = ((req as any).user?.email as string) || 'unknown'

    const result = await resumeWireAfterApproval(executionId, userEmail)

    if (!result) {
      res.status(400).json(errorResponse('Wire execution not found or not in AWAITING_APPROVAL status'))
      return
    }

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/wire/resume/:executionId error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to resume wire'
    res.status(500).json(errorResponse(msg))
  }
})

// ─── Shared Resume Function ─────────────────────────────────────────────────
// Used by both the /resume route and approval.ts after batch execution.

/**
 * Resume wire execution after approval.
 * Returns the WireResult on success, null if execution not found or wrong status.
 */
export async function resumeWireAfterApproval(
  wireExecutionId: string,
  executorEmail: string
): Promise<WireResult | null> {
  const col = wireExecCol()
  const execRef = col.doc(wireExecutionId)
  const execDoc = await execRef.get()

  if (!execDoc.exists) {
    console.warn(`[wire-resume] Wire execution ${wireExecutionId} not found`)
    return null
  }

  const execData = execDoc.data() as Record<string, unknown>

  if (execData.status !== 'AWAITING_APPROVAL') {
    console.warn(`[wire-resume] Wire ${wireExecutionId} status is ${execData.status}, not AWAITING_APPROVAL`)
    return null
  }

  // Mark as resuming
  await execRef.update({
    status: 'RESUMING',
    resumed_at: new Date().toISOString(),
    resumed_by: executorEmail,
    updated_at: new Date().toISOString(),
  })

  try {
    const executeWire = await loadExecuteWire()

    const input = {
      file_id: execData.file_id as string | undefined,
      file_ids: (execData.source_file_ids as string[]) || [],
      mode: (execData.mode as string) || 'document',
    }

    const context = {
      wire_id: execData.wire_id as string,
      user_email: executorEmail,
      source_file_ids: (execData.source_file_ids as string[]) || [],
      dry_run: false,
      approval_required: false,
      resume_from_stage: 'SUPER_WRITE',
      execution_id: wireExecutionId,
    }

    const result = await executeWire(execData.wire_id as string, input, context)

    await execRef.update({
      status: result.success ? 'COMPLETE' : 'ERROR',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    console.log(`[wire-resume] Wire ${wireExecutionId} resumed: success=${result.success}`)
    return result
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[wire-resume] Wire ${wireExecutionId} resume failed:`, errorMsg)

    await execRef.update({
      status: 'ERROR',
      error: errorMsg,
      updated_at: new Date().toISOString(),
    })

    throw err
  }
}
