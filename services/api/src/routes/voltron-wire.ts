// ---------------------------------------------------------------------------
// VOLTRON Wire Execution API Routes
// Execute wires, check status, SSE streaming, and approval resumption.
//
// POST /api/voltron/wire/execute    — Execute a VOLTRON wire
// GET  /api/voltron/wire/:id/status — Check wire execution status
// GET  /api/voltron/wire/:id/stream — SSE real-time stage updates
// POST /api/voltron/wire/:id/approve — Resume after approval gate
//
// NOTE: Uses bracket notation for Firestore writes (hookify-safe).
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  validateRequired,
  param,
} from '../lib/helpers.js'
import {
  VOLTRON_ROLE_RANK,
  getVoltronWireById,
  classifyLionDomain,
  type VoltronUserRole,
  type VoltronWireResult,
  type VoltronLionDomain,
  type IntakeChannel,
} from '@tomachina/core'

export const voltronWireRoutes = Router()

const WIRE_EXECUTIONS_COL = 'wire_executions'
const VOLTRON_CASES_COL = 'voltron_cases'

/* ─── Firestore helpers (bracket notation for hookify) ─── */

function wireExecCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](WIRE_EXECUTIONS_COL)
}

function casesCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](VOLTRON_CASES_COL)
}

/* ─── VOL-O08: Auto-create voltron_cases doc on wire execution ─── */

async function createCaseFromWire(params: {
  wire_id: string
  client_id: string
  lion_domain: VoltronLionDomain
  agent_email: string
  intake_channel: IntakeChannel
}): Promise<string> {
  const col = casesCol()
  const docRef = col.doc()
  const now = new Date().toISOString()

  const caseDoc = {
    case_id: docRef.id,
    client_id: params.client_id,
    client_name: '', // Denormalized later or by caller
    wire_name: params.wire_id,
    lion_domain: params.lion_domain,
    agent_id: params.agent_email,
    status: 'intake',
    intake_channel: params.intake_channel,
    wire_output: null,
    outcome: null,
    revision_notes: null,
    created_at: now,
    updated_at: now,
    resolved_at: null,
  }

  await docRef.set(caseDoc)
  return docRef.id
}

async function updateCaseStatus(caseId: string, status: string, wireOutput?: unknown) {
  const col = casesCol()
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (wireOutput !== undefined) {
    updates.wire_output = wireOutput
  }
  await col.doc(caseId).update(updates)
}

/** Determine Lion domain for a wire. Uses wire_id naming convention. */
function inferDomainFromWire(wireId: string): VoltronLionDomain {
  const lower = wireId.toLowerCase()
  // Use classifyLionDomain with a synthetic registry entry for keyword matching
  const domain = classifyLionDomain({
    tool_id: lower,
    name: lower,
    description: lower,
    type: 'WIRE',
    source: 'VOLTRON',
    entitlement_min: 'DIRECTOR',
    parameters: {},
    server_only: true,
    generated_at: '',
  })
  return domain
}

/* ─── Load wire executor (not exported from barrel) ─── */

async function loadVoltronWireExecutor() {
  const mod = await import('@tomachina/core/voltron/wire-executor')
  return mod
}

// ─── GET /api/voltron/wire/log ────────────────────────────────────────────
// VOL-C14: Returns most recent wire execution events for Command Center.
// MUST be defined before /:id routes to avoid Express matching "log" as :id.

voltronWireRoutes.get('/log', async (_req: Request, res: Response) => {
  try {
    const col = wireExecCol()
    const snapshot = await col
      .orderBy('started_at', 'desc')
      .limit(100)
      .get()

    const entries = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const d = doc.data()
      return {
        id: doc.id,
        timestamp: d.started_at || d.completed_at || '',
        toolName: d.wire_id || 'unknown',
        lion: d.domain || 'general',
        status: d.status === 'complete' ? 'success'
          : d.status === 'failed' ? 'error'
          : d.status === 'approval_pending' ? 'pending'
          : d.status || 'pending',
        clientId: d.client_id || null,
        errorMessage: d.status === 'failed' ? (d.error || null) : null,
      }
    })

    res.json(successResponse(entries))
  } catch (err) {
    console.error('GET /api/voltron/wire/log error:', err)
    res.status(500).json(errorResponse('Failed to fetch wire log'))
  }
})

// ─── POST /api/voltron/wire/execute ─────────────────────────────────────────
// Execute a VOLTRON wire. Requires entitlement matching wire's minimum.

voltronWireRoutes.post('/execute', async (req: Request, res: Response) => {
  try {
    const { wire_id, client_id, params, simulation } = req.body as {
      wire_id: string
      client_id: string
      params?: Record<string, unknown>
      simulation?: boolean
    }

    const err = validateRequired(req.body as Record<string, unknown>, ['wire_id', 'client_id'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const userEmail = ((req as any).user?.email as string) || 'unknown'
    const userRole = ((req as any).user?.role as string) || 'ADMIN'
    const entitlement = VOLTRON_ROLE_RANK[userRole as VoltronUserRole] ?? 1

    // Validate wire exists
    const wireDef = getVoltronWireById(wire_id)
    if (!wireDef) {
      res.status(404).json(errorResponse(`Wire not found: ${wire_id}`))
      return
    }

    // Entitlement check
    const requiredRank = VOLTRON_ROLE_RANK[wireDef.entitlement_min]
    if (entitlement < requiredRank) {
      res.status(403).json(errorResponse(`Insufficient entitlement: ${wireDef.entitlement_min}+ required`))
      return
    }

    const { executeVoltronWire } = await loadVoltronWireExecutor()

    const wireInput = {
      wire_id,
      client_id,
      params: params || {},
      entitlement,
    }

    const context = {
      client_id,
      user_role: userRole as VoltronUserRole,
      wire_id,
      entitlement,
      user_email: userEmail,
    }

    // Audit writer: writes to wire_executions Firestore collection
    const writeAudit = async (doc: Record<string, unknown>): Promise<string> => {
      const executionId = doc.execution_id as string
      const col = wireExecCol()
      await col.doc(executionId).set(doc)
      return executionId
    }

    // VOL-O08: Determine intake channel from request header or default
    const intakeChannel = (req.headers['x-intake-channel'] as IntakeChannel) || 'command_center'
    const lionDomain = inferDomainFromWire(wire_id)

    // VOL-O08: Create case record at intake
    let caseId: string | undefined
    try {
      caseId = await createCaseFromWire({
        wire_id,
        client_id,
        lion_domain: lionDomain,
        agent_email: userEmail,
        intake_channel: intakeChannel,
      })
      // Transition to wire_running
      await updateCaseStatus(caseId, 'wire_running')
    } catch (caseErr) {
      // Case creation failure should not block wire execution
      console.error('VOL-O08: Case creation failed (non-blocking):', caseErr)
    }

    const result: VoltronWireResult = await executeVoltronWire(wireInput, context, {
      simulate: simulation || false,
      writeAudit,
    })

    // VOL-O08: Update case with wire output
    if (caseId) {
      try {
        const isSuccess = result.status === 'complete' || result.status === 'simulated'
        await updateCaseStatus(
          caseId,
          isSuccess ? 'output_ready' : 'output_ready',
          { execution_id: result.execution_id, status: result.status, artifacts: result.artifacts },
        )
      } catch (caseErr) {
        console.error('VOL-O08: Case update failed (non-blocking):', caseErr)
      }
    }

    res.json(successResponse({ ...result, case_id: caseId }))
  } catch (err) {
    console.error('POST /api/voltron/wire/execute error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to execute wire'
    res.status(500).json(errorResponse(msg))
  }
})

// ─── GET /api/voltron/wire/:id/status ───────────────────────────────────────
// Returns wire execution status from wire_executions Firestore collection.

voltronWireRoutes.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.id)
    const col = wireExecCol()
    const doc = await col.doc(executionId).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Wire execution not found'))
      return
    }

    res.json(successResponse({ execution_id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/voltron/wire/:id/status error:', err)
    res.status(500).json(errorResponse('Failed to get wire execution status'))
  }
})

// ─── GET /api/voltron/wire/:id/stream ───────────────────────────────────────
// Server-Sent Events for real-time wire execution progress.

voltronWireRoutes.get('/:id/stream', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.id)

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Subscribe to wire execution updates
    const { subscribeToWire } = await loadVoltronWireExecutor()

    // WireSSEEvent is now typed — use `event` field name for clarity
    const unsubscribe = subscribeToWire(executionId, (event: unknown) => {
      const sseEvent = event as Record<string, unknown>
      // Use SSE named events so EventSource.addEventListener works on the client
      const eventType = (sseEvent.type as string) || 'message'
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(sseEvent)}\n\n`)

      // Auto-close stream on terminal events
      if (eventType === 'wire_complete' || eventType === 'wire_error') {
        res.end()
        unsubscribe()
      }
    })

    // Also check Firestore for completed executions
    const col = wireExecCol()
    const doc = await col.doc(executionId).get()
    if (doc.exists) {
      const data = doc.data() as Record<string, unknown>
      if (data.status === 'complete' || data.status === 'failed' || data.status === 'simulated') {
        res.write(`data: ${JSON.stringify({ type: 'complete', status: data.status, data })}\n\n`)
        res.end()
        unsubscribe()
        return
      }
    }

    // Cleanup on client disconnect
    req.on('close', () => {
      unsubscribe()
      res.end()
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'timeout' })}\n\n`)
      res.end()
      unsubscribe()
    }, 5 * 60 * 1000)
  } catch (err) {
    console.error('GET /api/voltron/wire/:id/stream error:', err)
    res.status(500).json(errorResponse('Failed to stream wire execution'))
  }
})

// ─── POST /api/voltron/wire/:id/approve ─────────────────────────────────────
// Resume wire after approval gate. Updates Firestore and continues execution.

voltronWireRoutes.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const executionId = param(req.params.id)
    const userEmail = ((req as any).user?.email as string) || 'unknown'

    // Load execution from Firestore
    const col = wireExecCol()
    const execRef = col.doc(executionId)
    const execDoc = await execRef.get()

    if (!execDoc.exists) {
      res.status(404).json(errorResponse('Wire execution not found'))
      return
    }

    const execData = execDoc.data() as Record<string, unknown>

    if (execData.status !== 'approval_pending') {
      res.status(400).json(errorResponse(`Wire status is '${execData.status}', not 'approval_pending'`))
      return
    }

    // Find the gate stage to resume from
    const stageResults = (execData.stage_results as Array<{ status: string; super_tool_id: string }>) || []
    const gateStage = stageResults.find(s => s.status === 'approval_pending')
    if (!gateStage) {
      res.status(400).json(errorResponse('No approval-pending stage found'))
      return
    }

    // Mark as resuming
    await execRef.update({
      status: 'resuming',
      approved_by: userEmail,
      approved_at: new Date().toISOString(),
    })

    const { resumeVoltronWireAfterApproval } = await loadVoltronWireExecutor()
    const userRole = ((req as any).user?.role as string) || 'ADMIN'
    const entitlement = VOLTRON_ROLE_RANK[userRole as VoltronUserRole] ?? 1

    const result = await resumeVoltronWireAfterApproval(
      executionId,
      {
        wire_id: execData.wire_id as string,
        client_id: execData.client_id as string,
        params: (execData.params as Record<string, unknown>) || {},
        entitlement,
      },
      {
        client_id: execData.client_id as string,
        user_role: userRole as VoltronUserRole,
        wire_id: execData.wire_id as string,
        entitlement,
        user_email: userEmail,
      },
      gateStage.super_tool_id,
      {
        writeAudit: async (doc: Record<string, unknown>) => {
          await execRef.update(doc)
          return executionId
        },
      },
    )

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/voltron/wire/:id/approve error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to approve wire'
    res.status(500).json(errorResponse(msg))
  }
})

