import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import type { SyncAgentData, SyncClientData, SyncAccountData } from '@tomachina/core'

export const syncRoutes = Router()

// ============================================================================
// SYNC AGENT
// ============================================================================

/**
 * POST /api/sync/agent
 * Sync agent data with related records
 */
syncRoutes.post('/agent', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { agent_id } = req.body

    if (!agent_id) {
      res.status(400).json(errorResponse('agent_id is required'))
      return
    }

    const agentDoc = await db.collection('agents').doc(agent_id).get()
    if (!agentDoc.exists) {
      res.status(404).json(errorResponse(`Agent not found: ${agent_id}`))
      return
    }

    const agent = { id: agentDoc.id, ...agentDoc.data() } as Record<string, unknown>

    // Get related clients
    const clientSnap = await db
      .collection('clients')
      .where('agent_id', '==', agent_id)
      .get()

    const clients = clientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))

    // Get related revenue
    const revenueSnap = await db
      .collection('revenue')
      .where('agent_id', '==', agent_id)
      .get()

    const revenue = revenueSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
    const totalRevenue = revenue.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)

    // Get accounts for these clients
    let accountCount = 0
    for (const client of clients) {
      const accountSnap = await db
        .collection('clients')
        .doc(client.id as string)
        .collection('accounts')
        .get()
      accountCount += accountSnap.size
    }

    res.json(successResponse<unknown>({
      agent,
      stats: {
        clients: clients.length,
        accounts: accountCount,
        revenue_records: revenue.length,
        total_revenue: totalRevenue,
      },
      related: {
        clients,
        revenue,
      },
    }))
  } catch (err) {
    console.error('POST /api/sync/agent error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SYNC CLIENT
// ============================================================================

/**
 * POST /api/sync/client
 * Sync client data with related records
 */
syncRoutes.post('/client', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { client_id } = req.body

    if (!client_id) {
      res.status(400).json(errorResponse('client_id is required'))
      return
    }

    const clientDoc = await db.collection('clients').doc(client_id).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse(`Client not found: ${client_id}`))
      return
    }

    const client = { id: clientDoc.id, ...clientDoc.data() } as Record<string, unknown>

    // Get accounts
    const accountSnap = await db
      .collection('clients')
      .doc(client_id)
      .collection('accounts')
      .get()

    const accounts = accountSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))

    // Get revenue for these accounts
    const accountIds = accounts.map((a) => a.id as string).filter(Boolean)
    let revenue: Record<string, unknown>[] = []

    if (accountIds.length > 0) {
      // Firestore 'in' query supports up to 30 values
      const chunks = []
      for (let i = 0; i < accountIds.length; i += 30) {
        chunks.push(accountIds.slice(i, i + 30))
      }
      for (const chunk of chunks) {
        const revSnap = await db
          .collection('revenue')
          .where('account_id', 'in', chunk)
          .get()
        revenue.push(...revSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>)))
      }
    }

    const totalRevenue = revenue.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)

    // Get agent if linked
    let agent: Record<string, unknown> | null = null
    if (client.agent_id) {
      const agentDoc = await db.collection('agents').doc(client.agent_id as string).get()
      if (agentDoc.exists) {
        agent = { id: agentDoc.id, ...agentDoc.data() } as Record<string, unknown>
      }
    }

    res.json(successResponse<unknown>({
      client,
      agent,
      stats: {
        accounts: accounts.length,
        revenue_records: revenue.length,
        total_revenue: totalRevenue,
      },
      related: {
        accounts,
        revenue,
      },
    }))
  } catch (err) {
    console.error('POST /api/sync/client error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SYNC ACCOUNT
// ============================================================================

/**
 * POST /api/sync/account
 * Sync account data with related records
 */
syncRoutes.post('/account', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { account_id, client_id } = req.body

    if (!account_id) {
      res.status(400).json(errorResponse('account_id is required'))
      return
    }

    // Account lives as subcollection under client — need client_id
    // If not provided, search for it
    let resolvedClientId = client_id

    if (!resolvedClientId) {
      // Search across all clients for this account (expensive but necessary)
      const clientsSnap = await db.collection('clients').select().get()
      for (const clientDoc of clientsSnap.docs) {
        const accountDoc = await db
          .collection('clients')
          .doc(clientDoc.id)
          .collection('accounts')
          .doc(account_id)
          .get()
        if (accountDoc.exists) {
          resolvedClientId = clientDoc.id
          break
        }
      }
    }

    if (!resolvedClientId) {
      res.status(404).json(errorResponse(`Account not found: ${account_id}`))
      return
    }

    const accountDoc = await db
      .collection('clients')
      .doc(resolvedClientId)
      .collection('accounts')
      .doc(account_id)
      .get()

    if (!accountDoc.exists) {
      res.status(404).json(errorResponse(`Account not found: ${account_id}`))
      return
    }

    const account = { id: accountDoc.id, ...accountDoc.data() } as Record<string, unknown>

    // Get client
    const clientDoc = await db.collection('clients').doc(resolvedClientId).get()
    const client = clientDoc.exists ? { id: clientDoc.id, ...clientDoc.data() } : null

    // Get agent
    let agent: Record<string, unknown> | null = null
    if (client && (client as Record<string, unknown>).agent_id) {
      const agentDoc = await db.collection('agents').doc((client as Record<string, unknown>).agent_id as string).get()
      if (agentDoc.exists) {
        agent = { id: agentDoc.id, ...agentDoc.data() } as Record<string, unknown>
      }
    }

    // Get revenue
    const revenueSnap = await db
      .collection('revenue')
      .where('account_id', '==', account_id)
      .get()

    const revenue = revenueSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
    const totalRevenue = revenue.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)

    res.json(successResponse<unknown>({
      account,
      client,
      agent,
      stats: {
        revenue_records: revenue.length,
        total_revenue: totalRevenue,
      },
      related: {
        revenue,
      },
    }))
  } catch (err) {
    console.error('POST /api/sync/account error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
