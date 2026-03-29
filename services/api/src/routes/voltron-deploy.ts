// ---------------------------------------------------------------------------
// VOLTRON Mode 1 Deploy API Routes (TRK-13860)
// Agent SDK-powered multi-step task execution endpoints.
//
// POST /api/voltron/deploy                  — Deploy a goal, returns 202 + session_id
// GET  /api/voltron/stream/:sessionId        — SSE real-time event stream
// POST /api/voltron/approve/:sessionId       — Approve a pending tool call
// POST /api/voltron/reject/:sessionId        — Reject a pending tool call
//
// Auth: Firebase JWT enforced on all endpoints (via /api middleware).
// Sessions stored in Firestore voltron_sessions collection.
// NOTE: Uses bracket notation for Firestore writes (hookify-safe).
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { EventEmitter } from 'events'
import {
  successResponse,
  errorResponse,
  validateRequired,
  param,
} from '../lib/helpers.js'

export const voltronDeployRoutes = Router()

// ── Constants ────────────────────────────────────────────────────────────────

const VOLTRON_SESSIONS_COL = 'voltron_sessions'
const SESSION_TIMEOUT_MS = parseInt(process.env['VOLTRON_SESSION_TIMEOUT'] || '1800000', 10) // 30 min default
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// ── SSE Event Types ──────────────────────────────────────────────────────────

interface SseEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'approval_required' | 'error' | 'verification'
  [key: string]: unknown
}

interface ApprovalRequest {
  call_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  resolve: (approved: boolean) => void
  timer: ReturnType<typeof setTimeout>
  resolved: boolean
}

interface VoltronSession {
  session_id: string
  user_id: string
  user_email: string
  goal: string
  status: 'running' | 'complete' | 'error' | 'approval_pending'
  created_at: string
  updated_at: string
  specialist_id: string | null
  emitter: EventEmitter
  events: Array<SseEvent | string>
  pending_approvals: Map<string, ApprovalRequest>
  timeout_timer: ReturnType<typeof setTimeout> | null
}

// ── In-Memory Session Store ──────────────────────────────────────────────────

const activeSessions = new Map<string, VoltronSession>()

// ── Firestore helpers (bracket notation for hookify) ─────────────────────────

function sessionsCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](VOLTRON_SESSIONS_COL)
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// ── MDJ Agent Forwarding ─────────────────────────────────────────────────────

const MDJ_AGENT_URL = process.env['MDJ_AGENT_URL'] || 'http://100.99.181.57:4200'
const MDJ_AUTH_SECRET = process.env['MDJ_AUTH_SECRET'] || 'mdj-alpha-shared-secret-2026'

/**
 * Forward deploy goal to MDJ agent and stream SSE events back into the session.
 * Runs asynchronously after 202 response is sent.
 */
async function forwardToAgent(session: VoltronSession, body: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(`${MDJ_AGENT_URL}/api/voltron/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MDJ-Auth': MDJ_AUTH_SECRET,
      },
      body: JSON.stringify({
        goal: body['goal'],
        user_context: body['user_context'],
        specialist_id: body['specialist_id'] || null,
        client_id: body['client_id'] || null,
        page_path: body['page_path'] || null,
        model: body['model'] || null,
        session_id: session.session_id,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      emitSessionEvent(session, { type: 'error', message: `Agent returned ${response.status}: ${errText}`, code: 'AGENT_ERROR' })
      finalizeSession(session, 'error')
      return
    }

    // If agent returns SSE stream, consume it
    if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6)
            if (data === '[DONE]') {
              emitSessionDone(session)
              finalizeSession(session, 'complete')
              return
            }
            try {
              const event = JSON.parse(data) as SseEvent
              emitSessionEvent(session, event)

              // Handle approval_required events from agent
              if (event.type === 'approval_required') {
                session.status = 'approval_pending'
                updateSessionFirestore(session)
              }
            } catch {
              // Non-JSON data line — emit as text
              emitSessionEvent(session, { type: 'text', text: data })
            }
          }
        }
      }

      // Stream ended without [DONE]
      if (session.status === 'running') {
        emitSessionDone(session)
        finalizeSession(session, 'complete')
      }
    } else {
      // Non-streaming response — agent returned JSON
      const result = await response.json() as Record<string, unknown>
      if (result['data']) {
        emitSessionEvent(session, { type: 'text', text: JSON.stringify(result['data']) })
      }
      emitSessionDone(session)
      finalizeSession(session, 'complete')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reach agent'
    emitSessionEvent(session, { type: 'error', message, code: 'AGENT_UNREACHABLE' })
    finalizeSession(session, 'error')
  }
}

// ── Session Helpers ──────────────────────────────────────────────────────────

function emitSessionEvent(session: VoltronSession, event: SseEvent): void {
  session.events.push(event)
  session.emitter.emit('event', event)
}

function emitSessionDone(session: VoltronSession): void {
  session.events.push('[DONE]')
  session.emitter.emit('done')
}

function finalizeSession(session: VoltronSession, status: 'complete' | 'error'): void {
  session.status = status
  session.updated_at = new Date().toISOString()

  // Clear session timeout
  if (session.timeout_timer) {
    clearTimeout(session.timeout_timer)
    session.timeout_timer = null
  }

  // Clear any pending approvals
  for (const [, approval] of session.pending_approvals) {
    if (!approval.resolved) {
      clearTimeout(approval.timer)
      approval.resolved = true
      approval.resolve(false)
    }
  }

  updateSessionFirestore(session)

  // Cleanup after 60s to allow late SSE subscribers
  setTimeout(() => activeSessions.delete(session.session_id), 60_000)
}

function updateSessionFirestore(session: VoltronSession): void {
  const col = sessionsCol()
  const docRef = col.doc(session.session_id)
  docRef.set({
    session_id: session.session_id,
    user_id: session.user_id,
    user_email: session.user_email,
    goal: session.goal,
    status: session.status,
    created_at: session.created_at,
    updated_at: new Date().toISOString(),
    specialist_id: session.specialist_id,
    event_count: session.events.length,
    approval_pending: session.status === 'approval_pending',
  }, { merge: true }).catch((err: unknown) => {
    console.error(`[voltron-deploy] Firestore write error for ${session.session_id}:`, err)
  })
}

// ── POST /api/voltron/deploy ─────────────────────────────────────────────────
// Deploy a goal via Mode 1 Agent SDK execution.
// Returns 202 Accepted with session_id immediately, async execution follows.

voltronDeployRoutes.post('/deploy', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>

    // Validate required fields
    const err = validateRequired(body, ['goal', 'user_context'])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const userContext = body['user_context'] as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqUser = (req as any).user as Record<string, unknown> | undefined
    const userEmail = (reqUser?.['email'] as string) || 'unknown'
    const userId = (reqUser?.['uid'] as string) || 'unknown'

    // Create session
    const sessionId = generateSessionId()
    const now = new Date().toISOString()

    const session: VoltronSession = {
      session_id: sessionId,
      user_id: userId,
      user_email: userEmail,
      goal: body['goal'] as string,
      status: 'running',
      created_at: now,
      updated_at: now,
      specialist_id: (body['specialist_id'] as string) || null,
      emitter: new EventEmitter(),
      events: [],
      pending_approvals: new Map(),
      timeout_timer: null,
    }

    // Set session timeout
    session.timeout_timer = setTimeout(() => {
      if (session.status === 'running' || session.status === 'approval_pending') {
        emitSessionEvent(session, { type: 'error', message: 'Session timed out', code: 'SESSION_TIMEOUT' })
        emitSessionDone(session)
        finalizeSession(session, 'error')
      }
    }, SESSION_TIMEOUT_MS)

    activeSessions.set(sessionId, session)

    // Write initial session to Firestore
    const col = sessionsCol()
    await col.doc(sessionId).set({
      session_id: sessionId,
      user_id: userId,
      user_email: userEmail,
      goal: body['goal'],
      status: 'running',
      created_at: now,
      updated_at: now,
      specialist_id: session.specialist_id,
      client_id: (body['client_id'] as string) || null,
      page_path: (body['page_path'] as string) || null,
      model: (body['model'] as string) || null,
      events: [],
      approval_pending: false,
      user_context: {
        user_id: userContext['user_id'] || userId,
        email: userContext['email'] || userEmail,
        user_level: userContext['user_level'] ?? 1,
        org_id: userContext['org_id'] || null,
      },
    })

    // Return 202 immediately
    res.status(202).json(successResponse({ session_id: sessionId }))

    // Fire async execution (do NOT await — runs after response)
    forwardToAgent(session, body).catch((fwdErr: unknown) => {
      console.error(`[voltron-deploy] Forward error for ${sessionId}:`, fwdErr)
      emitSessionEvent(session, { type: 'error', message: 'Agent forwarding failed', code: 'FORWARD_ERROR' })
      finalizeSession(session, 'error')
    })
  } catch (err) {
    console.error('POST /api/voltron/deploy error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to deploy goal'
    res.status(500).json(errorResponse(msg))
  }
})

// ── GET /api/voltron/deploy/stream/:sessionId ────────────────────────────────
// Server-Sent Events stream for real-time Mode 1 execution progress.

voltronDeployRoutes.get('/stream/:sessionId', (req: Request, res: Response): void => {
  try {
    const sessionId = param(req.params['sessionId'])
    const session = activeSessions.get(sessionId)

    if (!session) {
      res.status(404).json(errorResponse('Session not found'))
      return
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Replay existing events
    for (const event of session.events) {
      if (event === '[DONE]') {
        res.write('data: [DONE]\n\n')
      } else {
        const sseEvent = event as SseEvent
        res.write(`data: ${JSON.stringify(sseEvent)}\n\n`)
      }
    }

    // If session already complete, close immediately
    if (session.status === 'complete' || session.status === 'error') {
      // Check if [DONE] was already replayed
      const hasDone = session.events.includes('[DONE]')
      if (!hasDone) {
        res.write('data: [DONE]\n\n')
      }
      res.end()
      return
    }

    // Subscribe to live events
    const onEvent = (event: SseEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const onDone = () => {
      res.write('data: [DONE]\n\n')
      res.end()
      cleanup()
    }

    session.emitter.on('event', onEvent)
    session.emitter.on('done', onDone)

    const cleanup = () => {
      session.emitter.off('event', onEvent)
      session.emitter.off('done', onDone)
    }

    // Cleanup on client disconnect
    req.on('close', cleanup)

    // Session stream timeout (matches session timeout)
    setTimeout(() => {
      cleanup()
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream timeout', code: 'STREAM_TIMEOUT' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }, SESSION_TIMEOUT_MS)
  } catch (err) {
    console.error('GET /api/voltron/deploy/stream error:', err)
    if (!res.headersSent) {
      res.status(500).json(errorResponse('Failed to stream session'))
    }
  }
})

// ── POST /api/voltron/deploy/approve/:sessionId ──────────────────────────────
// Approve a pending tool call in a Mode 1 session.

voltronDeployRoutes.post('/approve/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = param(req.params['sessionId'])
    const { call_id } = req.body as { call_id?: string }

    if (!call_id) {
      res.status(400).json(errorResponse('Missing required field: call_id'))
      return
    }

    const session = activeSessions.get(sessionId)

    // Check in-memory first
    if (session) {
      const approval = session.pending_approvals.get(call_id)
      if (!approval) {
        // Forward to agent for server-side approval resolution
        const agentResult = await forwardApprovalToAgent(sessionId, call_id, true)
        if (agentResult.success) {
          session.status = 'running'
          updateSessionFirestore(session)
          res.json(successResponse({ status: 'resumed' }))
          return
        }
        res.status(404).json(errorResponse('Approval request not found'))
        return
      }

      if (approval.resolved) {
        res.status(409).json(errorResponse('Approval already resolved'))
        return
      }

      // Resolve the approval
      clearTimeout(approval.timer)
      approval.resolved = true
      approval.resolve(true)
      session.status = 'running'
      updateSessionFirestore(session)

      res.json(successResponse({ status: 'resumed' }))
      return
    }

    // Session not in memory — try forwarding to agent
    const agentResult = await forwardApprovalToAgent(sessionId, call_id, true)
    if (agentResult.success) {
      // Update Firestore
      const col = sessionsCol()
      await col.doc(sessionId).set({
        status: 'running',
        approval_pending: false,
        updated_at: new Date().toISOString(),
      }, { merge: true })
      res.json(successResponse({ status: 'resumed' }))
      return
    }

    res.status(404).json(errorResponse('Session not found'))
  } catch (err) {
    console.error('POST /api/voltron/deploy/approve error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to approve'
    res.status(500).json(errorResponse(msg))
  }
})

// ── POST /api/voltron/deploy/reject/:sessionId ──────────────────────────────
// Reject a pending tool call in a Mode 1 session.

voltronDeployRoutes.post('/reject/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = param(req.params['sessionId'])
    const { call_id } = req.body as { call_id?: string }

    if (!call_id) {
      res.status(400).json(errorResponse('Missing required field: call_id'))
      return
    }

    const session = activeSessions.get(sessionId)

    // Check in-memory first
    if (session) {
      const approval = session.pending_approvals.get(call_id)
      if (!approval) {
        // Forward to agent for server-side rejection
        const agentResult = await forwardApprovalToAgent(sessionId, call_id, false)
        if (agentResult.success) {
          updateSessionFirestore(session)
          res.json(successResponse({ status: 'rejected' }))
          return
        }
        res.status(404).json(errorResponse('Approval request not found'))
        return
      }

      if (approval.resolved) {
        res.status(409).json(errorResponse('Approval already resolved'))
        return
      }

      // Reject the approval
      clearTimeout(approval.timer)
      approval.resolved = true
      approval.resolve(false)

      emitSessionEvent(session, {
        type: 'tool_result',
        tool_name: approval.tool_name,
        result: { rejected: true, reason: 'User rejected tool call' },
      })

      updateSessionFirestore(session)
      res.json(successResponse({ status: 'rejected' }))
      return
    }

    // Session not in memory — try forwarding to agent
    const agentResult = await forwardApprovalToAgent(sessionId, call_id, false)
    if (agentResult.success) {
      const col = sessionsCol()
      await col.doc(sessionId).set({
        approval_pending: false,
        updated_at: new Date().toISOString(),
      }, { merge: true })
      res.json(successResponse({ status: 'rejected' }))
      return
    }

    res.status(404).json(errorResponse('Session not found'))
  } catch (err) {
    console.error('POST /api/voltron/deploy/reject error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to reject'
    res.status(500).json(errorResponse(msg))
  }
})

// ── Agent Approval Forwarding ────────────────────────────────────────────────

async function forwardApprovalToAgent(
  sessionId: string,
  callId: string,
  approved: boolean,
): Promise<{ success: boolean }> {
  try {
    const endpoint = approved ? 'approve' : 'reject'
    const response = await fetch(`${MDJ_AGENT_URL}/api/voltron/${endpoint}/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MDJ-Auth': MDJ_AUTH_SECRET,
      },
      body: JSON.stringify({ approved, call_id: callId }),
    })
    return { success: response.ok }
  } catch {
    return { success: false }
  }
}
