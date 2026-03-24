/**
 * MDJ Routes — MyDigitalJosh AI Assistant
 * Proxies chat requests to MDJ1 agent service via Tailscale.
 * Handles conversation CRUD and specialist listing from Firestore.
 * TRK-003: Wire Cloud Run → MDJ1
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'

export const mdjRoutes = Router()

const db = getFirestore()

// MDJ1 agent service URL via Tailscale
const MDJ1_URL = process.env.MDJ1_URL || 'https://tail7845ea.ts.net'
const MDJ_AUTH_SECRET = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'

/**
 * POST /api/mdj/chat
 * SSE streaming endpoint — proxies to MDJ1 agent service.
 * Forwards user context (email, level, permissions) from Firebase auth.
 */
mdjRoutes.post('/chat', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const message = String(body.message || '').trim()
    const portal = String(body.portal || 'prodash')
    const conversationId = body.conversation_id as string | undefined
    const context = body.context as Record<string, unknown> | undefined

    if (!message) {
      res.status(400).json(errorResponse('message is required'))
      return
    }

    // Build user context from authenticated request
    const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined
    const userContext = {
      display_name: user?.name || user?.email || 'Unknown',
      email: user?.email || '',
      level: 3, // Default to USER, will be enriched by agent
      portal,
    }

    // Try to load user level from Firestore
    if (user?.email) {
      try {
        const userDoc = await db.collection('users').doc(String(user.email)).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          userContext.level = typeof userData?.level === 'number' ? userData.level : 3
          userContext.display_name = userData?.display_name || userData?.first_name || String(user.email)
        }
      } catch {
        // Fall through with defaults
      }
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Proxy to MDJ1 agent service
    const agentUrl = `${MDJ1_URL}/agent/chat`

    try {
      const agentRes = await fetch(agentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MDJ-Auth': MDJ_AUTH_SECRET,
        },
        body: JSON.stringify({
          message,
          user_context: userContext,
          conversation_history: [],
          conversation_id: conversationId,
          context,
        }),
      })

      if (!agentRes.ok) {
        res.write(`data: ${JSON.stringify({ text: `MDJ agent error: ${agentRes.status}` })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }

      // Stream SSE from MDJ1 back to client
      if (agentRes.body) {
        const reader = agentRes.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          res.write(chunk)
        }
      }

      if (!res.writableEnded) {
        res.end()
      }
    } catch (proxyErr) {
      // MDJ1 unreachable — fall back to placeholder
      const fallback = `I'm having trouble connecting to my brain (MDJ1 server). ` +
        `The agent service at ${MDJ1_URL} may be down. ` +
        `Check: ssh mdj1 "sudo systemctl status mdj-agent"`
      res.write(`data: ${JSON.stringify({ text: fallback })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (err) {
    console.error('POST /api/mdj/chat error:', err)
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: '\n\nSorry, something went wrong.' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.status(500).json(errorResponse(String(err)))
    }
  }
})

/**
 * GET /api/mdj/conversations
 * List current user's conversations.
 */
mdjRoutes.get('/conversations', async (req: Request, res: Response) => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined
    const email = String(user?.email || '')

    if (!email) {
      res.status(401).json(errorResponse('Not authenticated'))
      return
    }

    const snap = await db.collection('mdj_conversations')
      .where('user_email', '==', email)
      .where('status', '==', 'active')
      .orderBy('last_message_at', 'desc')
      .limit(50)
      .get()

    const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(conversations))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/mdj/conversations/:id
 * Get a single conversation with its messages.
 */
mdjRoutes.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const convDoc = await db.collection('mdj_conversations').doc(req.params.id).get()
    if (!convDoc.exists) {
      res.status(404).json(errorResponse('Conversation not found'))
      return
    }

    const messagesSnap = await db.collection('mdj_conversations')
      .doc(req.params.id)
      .collection('messages')
      .orderBy('created_at', 'asc')
      .get()

    const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    res.json(successResponse({
      ...convDoc.data(),
      id: convDoc.id,
      messages,
    }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/mdj/conversations/:id
 * Archive a conversation (soft delete).
 */
mdjRoutes.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    await db.collection('mdj_conversations').doc(req.params.id).update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    res.json(successResponse({ archived: true }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/mdj/conversations/:id/approve
 * Approve a pending tool call.
 */
mdjRoutes.post('/conversations/:id/approve', async (req: Request, res: Response) => {
  try {
    const { call_id } = req.body as { call_id: string }
    const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined

    // Forward approval to MDJ1 agent
    const agentRes = await fetch(`${MDJ1_URL}/agent/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MDJ-Auth': MDJ_AUTH_SECRET,
      },
      body: JSON.stringify({
        conversation_id: req.params.id,
        call_id,
        approved_by: user?.email,
      }),
    })

    const result = await agentRes.json()
    res.json(result)
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/mdj/conversations/:id/reject
 * Reject a pending tool call.
 */
mdjRoutes.post('/conversations/:id/reject', async (req: Request, res: Response) => {
  try {
    const { call_id, reason } = req.body as { call_id: string; reason?: string }
    const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined

    const agentRes = await fetch(`${MDJ1_URL}/agent/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MDJ-Auth': MDJ_AUTH_SECRET,
      },
      body: JSON.stringify({
        conversation_id: req.params.id,
        call_id,
        rejected_by: user?.email,
        reason,
      }),
    })

    const result = await agentRes.json()
    res.json(result)
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/mdj/specialists
 * List available specialist configurations.
 */
mdjRoutes.get('/specialists', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('mdj_specialist_configs')
      .where('status', '==', 'active')
      .get()

    const specialists = snap.docs.map(d => ({
      id: d.id,
      specialist_name: d.data().specialist_name,
      display_name: d.data().display_name,
      icon: d.data().icon,
      routing_keywords: d.data().routing_keywords,
      required_level: d.data().required_level,
    }))

    res.json(successResponse(specialists))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})
