import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
  param,
} from '../lib/helpers.js'
import { randomUUID } from 'crypto'

// Status constants for normalization
const VALID_ACCOUNT_STATUSES = [
  'active', 'pending', 'terminated', 'cancelled', 'lapsed', 'paid_up',
  'claim', 'surrendered', 'annuitized', 'closed', 'transferred',
  'enrolled', 'termed', 'disenrolled',
]

const ACCOUNT_STATUS_MAP: Record<string, string> = {
  'in force': 'active', 'inforce': 'active', 'current': 'active',
  'submitted': 'pending', 'in progress': 'pending',
  'term': 'terminated', 'inactive': 'terminated',
  'canceled': 'cancelled',
  'claim paid': 'claim', 'death_claim': 'claim',
  'paid up': 'paid_up', 'paidup': 'paid_up',
}

const VALID_REVENUE_TYPES = ['FYC', 'REN', 'OVR']

const REVENUE_TYPE_MAP: Record<string, string> = {
  'first': 'FYC', 'first year': 'FYC', 'fyc': 'FYC',
  'renewal': 'REN', 'ren': 'REN',
  'override': 'OVR', 'ovr': 'OVR', 'over': 'OVR',
}

function normalizeAccountStatus(status: string): string {
  const lower = status.toLowerCase().trim()
  return ACCOUNT_STATUS_MAP[lower] || (VALID_ACCOUNT_STATUSES.includes(lower) ? lower : 'active')
}

function normalizeRevenueType(type: string): string {
  const upper = type.toUpperCase().trim()
  if (VALID_REVENUE_TYPES.includes(upper)) return upper
  return REVENUE_TYPE_MAP[type.toLowerCase().trim()] || 'FYC'
}

function normalizeNpn(npn: string): string {
  return String(npn).replace(/\D/g, '').slice(0, 10)
}

function isValidNpn(npn: string): boolean {
  const cleaned = normalizeNpn(npn)
  return cleaned.length >= 8 && cleaned.length <= 10
}

export const importRoutes = Router()

// ============================================================================
// CONFIGURATION
// ============================================================================

const ACCOUNT_TABS: Record<string, string> = {
  annuity: 'accounts_annuity',
  life: 'accounts_life',
  medicare: 'accounts_medicare',
  bdria: 'accounts_bdria',
  bd_ria: 'accounts_bdria',
  investment: 'accounts_bdria',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// SINGLE CLIENT IMPORT
// ============================================================================

const clientImportValidation = validateWrite({
  required: ['first_name', 'last_name'],
  types: {
    first_name: 'string',
    last_name: 'string',
    email: 'string',
    phone: 'string',
  },
})

/**
 * POST /api/import/client
 * Import a single client
 */
importRoutes.post('/client', clientImportValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientData = req.body.client || req.body
    const options = req.body.options || {}

    clientData.import_source = options.source || 'API_IMPORT'
    clientData.created_at = clientData.created_at || new Date().toISOString()
    clientData.updated_at = new Date().toISOString()

    const clientId = clientData.client_id || randomUUID()
    clientData.client_id = clientId

    const bridgeResult = await writeThroughBridge('clients', 'insert', clientId, clientData)
    if (!bridgeResult.success) {
      await db.collection('clients').doc(clientId).set(clientData)
    }

    res.status(201).json(successResponse({
      client_id: clientId,
      action: 'created',
    }))
  } catch (err) {
    console.error('POST /api/import/client error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BATCH CLIENT IMPORT
// ============================================================================

/**
 * POST /api/import/clients
 * Import multiple clients
 */
importRoutes.post('/clients', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clients = req.body.clients || []
    const options = req.body.options || {}

    if (!Array.isArray(clients) || clients.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty clients array'))
      return
    }

    const now = new Date().toISOString()
    const results = {
      imported: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    const batch = db.batch()

    for (let i = 0; i < clients.length; i++) {
      try {
        const client = clients[i]
        if (!client.first_name || !client.last_name) {
          results.errors.push({ index: i, error: 'Missing first_name or last_name' })
          continue
        }

        client.import_source = options.source || 'API_IMPORT'
        client.created_at = client.created_at || now
        client.updated_at = now

        const clientId = client.client_id || randomUUID()
        client.client_id = clientId

        batch.set(db.collection('clients').doc(clientId), client)
        results.imported++
      } catch (clientErr) {
        results.errors.push({ index: i, error: String(clientErr) })
      }
    }

    await batch.commit()

    res.json(successResponse(results))
  } catch (err) {
    console.error('POST /api/import/clients error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SINGLE ACCOUNT IMPORT
// ============================================================================

/**
 * POST /api/import/account
 * Import a single account
 */
importRoutes.post('/account', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const accountData = req.body.account || req.body
    const options = req.body.options || {}

    if (!accountData.client_id) {
      res.status(400).json(errorResponse('Missing required field: client_id'))
      return
    }

    if (!UUID_REGEX.test(String(accountData.client_id).trim())) {
      res.status(400).json(errorResponse(
        `Invalid client_id format (expected UUID, got "${String(accountData.client_id).substring(0, 40)}")`
      ))
      return
    }

    if (!accountData.account_category && !accountData.account_type && !accountData.product_type) {
      res.status(400).json(errorResponse('Missing required field: account_type or product_type'))
      return
    }

    accountData.import_source = options.source || 'API_IMPORT'
    accountData.created_at = accountData.created_at || new Date().toISOString()
    accountData.updated_at = new Date().toISOString()

    const accountId = accountData.account_id || randomUUID()
    accountData.account_id = accountId

    // Route to correct collection based on category
    const category = (accountData.account_category || accountData.account_type || '').toLowerCase()
    const collection = ACCOUNT_TABS[category] || 'accounts'

    const bridgeResult = await writeThroughBridge(collection, 'insert', accountId, accountData)
    if (!bridgeResult.success) {
      // Write to subcollection under client for Firestore structure
      await db.collection('clients').doc(accountData.client_id).collection('accounts').doc(accountId).set(accountData)
    }

    res.status(201).json(successResponse({
      account_id: accountId,
      action: 'created',
      collection,
    }))
  } catch (err) {
    console.error('POST /api/import/account error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BATCH ACCOUNT IMPORT
// ============================================================================

/**
 * POST /api/import/accounts
 * Import multiple accounts
 */
importRoutes.post('/accounts', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const accounts = req.body.accounts || []
    const options = req.body.options || {}

    if (!Array.isArray(accounts) || accounts.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty accounts array'))
      return
    }

    const now = new Date().toISOString()
    const results = {
      imported: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    const batch = db.batch()

    for (let i = 0; i < accounts.length; i++) {
      try {
        const account = accounts[i]
        if (!account.client_id) {
          results.errors.push({ index: i, error: 'Missing client_id' })
          continue
        }

        account.import_source = options.source || 'API_IMPORT'
        account.created_at = account.created_at || now
        account.updated_at = now

        const accountId = account.account_id || randomUUID()
        account.account_id = accountId

        batch.set(
          db.collection('clients').doc(account.client_id).collection('accounts').doc(accountId),
          account
        )
        results.imported++
      } catch (accountErr) {
        results.errors.push({ index: i, error: String(accountErr) })
      }
    }

    await batch.commit()

    res.json(successResponse(results))
  } catch (err) {
    console.error('POST /api/import/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BATCH IMPORT (CLIENTS + ACCOUNTS)
// ============================================================================

/**
 * POST /api/import/batch
 * Import clients and accounts in a single request
 */
importRoutes.post('/batch', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clients = req.body.clients || []
    const accounts = req.body.accounts || []
    const options = req.body.options || {}
    const now = new Date().toISOString()

    const results = {
      clients: { imported: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; error: string }>, mapping: {} as Record<string, string> },
      accounts: { imported: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; error: string }> },
    }

    // Phase 1: Import clients
    const batch1 = db.batch()
    for (let i = 0; i < clients.length; i++) {
      try {
        const client = clients[i]
        const clientRef = client._ref || client.client_ref || `${client.first_name} ${client.last_name}`

        if (!client.first_name || !client.last_name) {
          results.clients.errors.push({ index: i, error: 'Missing first_name or last_name' })
          results.clients.skipped++
          continue
        }

        client.import_source = options.source || 'API_IMPORT'
        client.created_at = client.created_at || now
        client.updated_at = now

        const clientId = client.client_id || randomUUID()
        client.client_id = clientId

        batch1.set(db.collection('clients').doc(clientId), client)
        results.clients.imported++
        results.clients.mapping[clientRef] = clientId
      } catch (clientErr) {
        results.clients.errors.push({ index: i, error: String(clientErr) })
        results.clients.skipped++
      }
    }

    await batch1.commit()

    // Phase 2: Import accounts (with client_id resolution)
    const batch2 = db.batch()
    for (let i = 0; i < accounts.length; i++) {
      try {
        const account = accounts[i]

        // Resolve client_id from client_ref
        if (!account.client_id && account.client_ref) {
          account.client_id = results.clients.mapping[account.client_ref]
        }

        if (!account.client_id) {
          results.accounts.errors.push({ index: i, error: 'Could not resolve client_id' })
          results.accounts.skipped++
          continue
        }

        account.import_source = options.source || 'API_IMPORT'
        account.created_at = account.created_at || now
        account.updated_at = now

        const accountId = account.account_id || randomUUID()
        account.account_id = accountId

        batch2.set(
          db.collection('clients').doc(account.client_id).collection('accounts').doc(accountId),
          account
        )
        results.accounts.imported++
      } catch (accountErr) {
        results.accounts.errors.push({ index: i, error: String(accountErr) })
        results.accounts.skipped++
      }
    }

    await batch2.commit()

    res.json(successResponse(results))
  } catch (err) {
    console.error('POST /api/import/batch error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * POST /api/import/validate
 * Validate data without importing
 */
importRoutes.post('/validate', async (req: Request, res: Response) => {
  try {
    const type = req.body.type || 'client'
    const data = req.body.data || req.body

    const errors: Array<{ field: string; message: string }> = []
    const warnings: string[] = []

    if (type === 'client') {
      if (!data.first_name) errors.push({ field: 'first_name', message: 'Required' })
      if (!data.last_name) errors.push({ field: 'last_name', message: 'Required' })
      if (data.email && !String(data.email).includes('@')) {
        errors.push({ field: 'email', message: 'Invalid format' })
      }
    }

    if (type === 'account') {
      if (!data.client_id) errors.push({ field: 'client_id', message: 'Required' })
      if (!data.account_type && !data.product_type) {
        errors.push({ field: 'account_type', message: 'Required' })
      }
    }

    const valid = errors.length === 0
    res.json(successResponse({ valid, errors, warnings }))
  } catch (err) {
    console.error('POST /api/import/validate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * POST /api/import/approval/create
 * Create approval batch from extracted data
 */
importRoutes.post('/approval/create', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { extractedData, context } = req.body

    if (!extractedData) {
      res.status(400).json(errorResponse('Missing required field: extractedData'))
      return
    }

    const batchId = randomUUID()
    const now = new Date().toISOString()
    const userEmail = (req as any).user?.email || 'api'

    const approvalData = {
      batch_id: batchId,
      extracted_data: extractedData,
      context: context || {},
      status: 'pending',
      created_by: userEmail,
      created_at: now,
      updated_at: now,
    }

    await db.collection('approval_queue').doc(batchId).set(approvalData)
    await writeThroughBridge('approval_queue', 'insert', batchId, approvalData)

    res.status(201).json(successResponse({
      batch_id: batchId,
      status: 'pending',
    }))
  } catch (err) {
    console.error('POST /api/import/approval/create error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// FINALIZE CASE
// ============================================================================

/**
 * POST /api/import/finalize
 * Finalize a client case
 */
importRoutes.post('/finalize', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = req.body.clientId || req.body.client_id

    if (!clientId) {
      res.status(400).json(errorResponse('Missing required field: clientId'))
      return
    }

    const now = new Date().toISOString()

    // Update client status to finalized
    const updates = {
      case_status: 'finalized',
      finalized_at: now,
      finalized_by: (req as any).user?.email || 'api',
      updated_at: now,
    }

    const bridgeResult = await writeThroughBridge('clients', 'update', clientId, updates)
    if (!bridgeResult.success) {
      await db.collection('clients').doc(clientId).update(updates)
    }

    res.json(successResponse({
      client_id: clientId,
      status: 'finalized',
    }))
  } catch (err) {
    console.error('POST /api/import/finalize error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SINGLE AGENT IMPORT
// ============================================================================

/**
 * POST /api/import/agent
 * Import a single agent/producer
 */
importRoutes.post('/agent', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const agentData = req.body.agent || req.body
    const options = req.body.options || {}

    if (!agentData.first_name || !agentData.last_name) {
      res.status(400).json(errorResponse('Missing required fields: first_name, last_name'))
      return
    }

    if (!agentData.npn) {
      res.status(400).json(errorResponse('Missing required field: npn'))
      return
    }

    const cleanNpn = normalizeNpn(agentData.npn)
    if (!isValidNpn(cleanNpn)) {
      res.status(400).json(errorResponse('Invalid NPN format (must be 8-10 digits)'))
      return
    }

    agentData.npn = cleanNpn

    // Dedup check by NPN
    const existingByNpn = await db.collection('agents')
      .where('npn', '==', cleanNpn)
      .limit(1)
      .get()

    if (!existingByNpn.empty && !options.force) {
      const existing = existingByNpn.docs[0]
      res.json(successResponse({
        action: 'skipped',
        reason: 'duplicate_npn',
        existing_agent_id: existing.id,
        existing_data: { npn: existing.data().npn, first_name: existing.data().first_name, last_name: existing.data().last_name },
      }))
      return
    }

    // Dedup check by email
    if (agentData.email && !existingByNpn.empty) {
      const existingByEmail = await db.collection('agents')
        .where('email', '==', agentData.email.toLowerCase())
        .limit(1)
        .get()

      if (!existingByEmail.empty && !options.force) {
        const existing = existingByEmail.docs[0]
        res.json(successResponse({
          action: 'skipped',
          reason: 'duplicate_email',
          existing_agent_id: existing.id,
        }))
        return
      }
    }

    const now = new Date().toISOString()
    agentData.import_source = options.source || 'API_IMPORT'
    agentData.created_at = agentData.created_at || now
    agentData.updated_at = now
    agentData.agent_status = agentData.agent_status || agentData.status || 'active'

    const agentId = agentData.agent_id || randomUUID()
    agentData.agent_id = agentId

    const bridgeResult = await writeThroughBridge('agents', 'insert', agentId, agentData)
    if (!bridgeResult.success) {
      await db.collection('agents').doc(agentId).set(agentData)
    }

    res.status(201).json(successResponse({
      agent_id: agentId,
      action: 'created',
    }))
  } catch (err) {
    console.error('POST /api/import/agent error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BATCH AGENT IMPORT
// ============================================================================

importRoutes.post('/agents', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const agents = req.body.agents || []
    const options = req.body.options || {}

    if (!Array.isArray(agents) || agents.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty agents array'))
      return
    }

    const now = new Date().toISOString()
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load existing NPNs for dedup
    const existingNpns = new Set<string>()
    const npnSnap = await db.collection('agents').select('npn').get()
    for (const doc of npnSnap.docs) {
      if (doc.data().npn) existingNpns.add(doc.data().npn)
    }

    const batch = db.batch()

    for (let i = 0; i < agents.length; i++) {
      try {
        const agent = agents[i]
        if (!agent.npn || !agent.first_name || !agent.last_name) {
          results.errors.push({ index: i, error: 'Missing npn, first_name, or last_name' })
          continue
        }

        const cleanNpn = normalizeNpn(agent.npn)
        if (!isValidNpn(cleanNpn)) {
          results.errors.push({ index: i, error: `Invalid NPN: ${agent.npn}` })
          continue
        }

        if (existingNpns.has(cleanNpn) && !options.force) {
          results.skipped++
          continue
        }

        agent.npn = cleanNpn
        agent.import_source = options.source || 'API_IMPORT'
        agent.created_at = agent.created_at || now
        agent.updated_at = now
        agent.agent_status = agent.agent_status || agent.status || 'active'

        const agentId = agent.agent_id || randomUUID()
        agent.agent_id = agentId

        batch.set(db.collection('agents').doc(agentId), agent)
        existingNpns.add(cleanNpn) // prevent intra-batch dupes
        results.imported++
      } catch (agentErr) {
        results.errors.push({ index: i, error: String(agentErr) })
      }
    }

    await batch.commit()
    res.json(successResponse(results))
  } catch (err) {
    console.error('POST /api/import/agents error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SINGLE REVENUE IMPORT
// ============================================================================

/**
 * POST /api/import/revenue
 * Import a single revenue/commission record
 */
importRoutes.post('/revenue', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const revenueData = req.body.revenue || req.body
    const options = req.body.options || {}

    if (revenueData.amount == null) {
      res.status(400).json(errorResponse('Missing required field: amount'))
      return
    }

    if (!revenueData.type && !revenueData.revenue_type) {
      res.status(400).json(errorResponse('Missing required field: type'))
      return
    }

    if (!revenueData.payment_date) {
      res.status(400).json(errorResponse('Missing required field: payment_date'))
      return
    }

    // Normalize
    revenueData.amount = parseFloat(String(revenueData.amount)) || 0
    revenueData.revenue_type = normalizeRevenueType(revenueData.type || revenueData.revenue_type)
    delete revenueData.type

    // Validate agent_id FK if provided
    if (revenueData.agent_id) {
      const agentDoc = await db.collection('agents').doc(revenueData.agent_id).get()
      if (!agentDoc.exists) {
        res.status(400).json(errorResponse(`Agent not found: ${revenueData.agent_id}`))
        return
      }
    }

    // Auto-link via NPN if agent_id not set
    if (!revenueData.agent_id && revenueData.agent_npn) {
      const npnSnap = await db.collection('agents')
        .where('npn', '==', normalizeNpn(revenueData.agent_npn))
        .limit(1)
        .get()
      if (!npnSnap.empty) {
        revenueData.agent_id = npnSnap.docs[0].id
      }
    }

    // Auto-link via policy number
    if (!revenueData.account_id && revenueData.policy_number) {
      // Search across client account subcollections via collectionGroup
      const policySnap = await db.collectionGroup('accounts')
        .where('policy_number', '==', revenueData.policy_number)
        .limit(1)
        .get()
      if (!policySnap.empty) {
        revenueData.account_id = policySnap.docs[0].id
        // Extract client_id from path: clients/{clientId}/accounts/{accountId}
        const pathParts = policySnap.docs[0].ref.path.split('/')
        if (pathParts.length >= 2) {
          revenueData.client_id = pathParts[1]
        }
      }
    }

    // Dedup check via stateable_id
    if (revenueData.stateable_id) {
      const existingSnap = await db.collection('revenue')
        .where('stateable_id', '==', revenueData.stateable_id)
        .limit(1)
        .get()
      if (!existingSnap.empty && !options.force) {
        res.json(successResponse({
          action: 'skipped',
          reason: 'duplicate_stateable_id',
          existing_revenue_id: existingSnap.docs[0].id,
        }))
        return
      }
    }

    const now = new Date().toISOString()
    revenueData.import_source = options.source || 'API_IMPORT'
    revenueData.created_at = revenueData.created_at || now
    revenueData.updated_at = now

    const revenueId = revenueData.revenue_id || randomUUID()
    revenueData.revenue_id = revenueId

    const bridgeResult = await writeThroughBridge('revenue', 'insert', revenueId, revenueData)
    if (!bridgeResult.success) {
      await db.collection('revenue').doc(revenueId).set(revenueData)
    }

    res.status(201).json(successResponse({
      revenue_id: revenueId,
      action: 'created',
      linked_agent: revenueData.agent_id || null,
      linked_account: revenueData.account_id || null,
    }))
  } catch (err) {
    console.error('POST /api/import/revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BATCH REVENUE IMPORT
// ============================================================================

importRoutes.post('/revenues', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const revenues = req.body.revenues || []
    const options = req.body.options || {}

    if (!Array.isArray(revenues) || revenues.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty revenues array'))
      return
    }

    const now = new Date().toISOString()
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    const batch = db.batch()

    for (let i = 0; i < revenues.length; i++) {
      try {
        const rev = revenues[i]
        if (rev.amount == null || (!rev.type && !rev.revenue_type) || !rev.payment_date) {
          results.errors.push({ index: i, error: 'Missing amount, type, or payment_date' })
          continue
        }

        rev.amount = parseFloat(String(rev.amount)) || 0
        rev.revenue_type = normalizeRevenueType(rev.type || rev.revenue_type)
        delete rev.type
        rev.import_source = options.source || 'API_IMPORT'
        rev.created_at = rev.created_at || now
        rev.updated_at = now

        const revenueId = rev.revenue_id || randomUUID()
        rev.revenue_id = revenueId

        batch.set(db.collection('revenue').doc(revenueId), rev)
        results.imported++
      } catch (revErr) {
        results.errors.push({ index: i, error: String(revErr) })
      }
    }

    await batch.commit()
    res.json(successResponse(results))
  } catch (err) {
    console.error('POST /api/import/revenues error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CASE TASK IMPORT
// ============================================================================

/**
 * POST /api/import/case-task
 * Create a case task
 */
importRoutes.post('/case-task', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const taskData = req.body.task || req.body

    if (!taskData.client_id && !taskData.case_id) {
      res.status(400).json(errorResponse('Missing required field: client_id or case_id'))
      return
    }

    // Validate assigned_to if provided
    if (taskData.assigned_to) {
      const userSnap = await db.collection('users')
        .where('email', '==', taskData.assigned_to.toLowerCase())
        .limit(1)
        .get()
      if (userSnap.empty) {
        // Warn but don't block — user might not be in Firestore yet
        taskData._assignment_warning = `User ${taskData.assigned_to} not found in users collection`
      }
    }

    const now = new Date().toISOString()
    taskData.status = taskData.status || 'open'
    taskData.created_at = taskData.created_at || now
    taskData.updated_at = now
    taskData.created_by = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    const taskId = taskData.task_id || randomUUID()
    taskData.task_id = taskId

    const bridgeResult = await writeThroughBridge('case_tasks', 'insert', taskId, taskData)
    if (!bridgeResult.success) {
      await db.collection('case_tasks').doc(taskId).set(taskData)
    }

    res.status(201).json(successResponse({
      task_id: taskId,
      action: 'created',
      status: taskData.status,
    }))
  } catch (err) {
    console.error('POST /api/import/case-task error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ENHANCED VALIDATION (DRY-RUN)
// ============================================================================

/**
 * POST /api/import/validate-full
 * Full validation with normalization preview — supports client, account, agent, revenue
 */
importRoutes.post('/validate-full', async (req: Request, res: Response) => {
  try {
    const type = req.body.type || 'client'
    const data = req.body.data || req.body
    const errors: Array<{ field: string; message: string }> = []
    const warnings: Array<{ field: string; message: string }> = []
    const normalized: Record<string, unknown> = { ...data }

    switch (type) {
      case 'client': {
        if (!data.first_name) errors.push({ field: 'first_name', message: 'Required' })
        if (!data.last_name) errors.push({ field: 'last_name', message: 'Required' })
        if (data.email) {
          const email = String(data.email).toLowerCase()
          if (!email.includes('@')) errors.push({ field: 'email', message: 'Invalid email format' })
          else if (/gmial|yahooo|hotmial/.test(email)) warnings.push({ field: 'email', message: 'Possible typo in domain' })
          normalized.email = email
        }
        if (data.phone) {
          const digits = String(data.phone).replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
          if (digits.length !== 10) warnings.push({ field: 'phone', message: 'Not 10 digits after cleanup' })
          normalized.phone = digits
        }
        if (data.state) {
          const state = String(data.state).toUpperCase().trim()
          if (state.length !== 2) warnings.push({ field: 'state', message: 'Should be 2-char state code' })
          normalized.state = state
        }
        if (data.zip) {
          const zip = String(data.zip).replace(/\D/g, '').padStart(5, '0').slice(0, 5)
          normalized.zip = zip
        }
        break
      }
      case 'account': {
        if (!data.client_id) errors.push({ field: 'client_id', message: 'Required' })
        if (!data.product_type && !data.account_type) errors.push({ field: 'product_type', message: 'Required' })
        if (!data.carrier_id && !data.carrier) warnings.push({ field: 'carrier', message: 'Recommended' })
        if (data.status) {
          normalized.status = normalizeAccountStatus(data.status)
          if (normalized.status !== data.status.toLowerCase().trim()) {
            warnings.push({ field: 'status', message: `Normalized to "${normalized.status}"` })
          }
        }
        break
      }
      case 'agent': {
        if (!data.npn) errors.push({ field: 'npn', message: 'Required' })
        else if (!isValidNpn(String(data.npn))) errors.push({ field: 'npn', message: 'Must be 8-10 digits' })
        else normalized.npn = normalizeNpn(data.npn)
        if (!data.first_name) errors.push({ field: 'first_name', message: 'Required' })
        if (!data.last_name) errors.push({ field: 'last_name', message: 'Required' })
        break
      }
      case 'revenue': {
        if (data.amount == null) errors.push({ field: 'amount', message: 'Required' })
        else {
          const parsed = parseFloat(String(data.amount))
          if (isNaN(parsed)) errors.push({ field: 'amount', message: 'Must be numeric' })
          else normalized.amount = parsed
        }
        if (!data.type && !data.revenue_type) errors.push({ field: 'type', message: 'Required' })
        else {
          normalized.revenue_type = normalizeRevenueType(data.type || data.revenue_type)
        }
        if (!data.payment_date) errors.push({ field: 'payment_date', message: 'Required' })
        break
      }
      default:
        errors.push({ field: 'type', message: `Unknown entity type: ${type}` })
    }

    const valid = errors.length === 0
    res.json(successResponse({ valid, errors, warnings, normalized_data: valid ? normalized : undefined }))
  } catch (err) {
    console.error('POST /api/import/validate-full error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BULK BOOK OF BUSINESS (BoB) IMPORT
// ============================================================================

/**
 * POST /api/import/bob
 * Bulk Book of Business import — runs full pipeline: normalize → validate → dedup → import
 */
importRoutes.post('/bob', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const records = req.body.records || []
    const carrierSource = req.body.carrier_source || 'GENERIC'
    const options = req.body.options || {}

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty records array'))
      return
    }

    const now = new Date().toISOString()
    const summary = {
      total: records.length,
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: 0,
      error_details: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load existing client emails + phones for dedup
    const existingEmails = new Map<string, string>() // email → doc id
    const existingPhones = new Map<string, string>() // phone → doc id
    const clientSnap = await db.collection('clients').select('email', 'phone', 'client_id').get()
    for (const doc of clientSnap.docs) {
      const d = doc.data()
      if (d.email) existingEmails.set(String(d.email).toLowerCase(), doc.id)
      if (d.phone) {
        const digits = String(d.phone).replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
        if (digits.length === 10) existingPhones.set(digits, doc.id)
      }
    }

    // Process in batches of 400 (Firestore batch limit = 500)
    const BATCH_SIZE = 400
    for (let start = 0; start < records.length; start += BATCH_SIZE) {
      const chunk = records.slice(start, start + BATCH_SIZE)
      const batch = db.batch()

      for (let i = 0; i < chunk.length; i++) {
        const globalIdx = start + i
        try {
          const record = chunk[i]

          // Validate minimums
          if (!record.first_name || !record.last_name) {
            summary.errors++
            summary.error_details.push({ index: globalIdx, error: 'Missing first_name or last_name' })
            continue
          }

          // Normalize
          const email = record.email ? String(record.email).toLowerCase().trim() : ''
          const phone = record.phone ? String(record.phone).replace(/\D/g, '').replace(/^1/, '').slice(0, 10) : ''

          // Dedup check
          let existingId: string | null = null
          if (email && existingEmails.has(email)) {
            existingId = existingEmails.get(email)!
          } else if (phone && phone.length === 10 && existingPhones.has(phone)) {
            existingId = existingPhones.get(phone)!
          }

          if (existingId && !options.force) {
            summary.duplicates++
            summary.skipped++
            continue
          }

          // Build client record
          const clientId = existingId || randomUUID()
          const clientData: Record<string, unknown> = {
            client_id: clientId,
            first_name: record.first_name,
            last_name: record.last_name,
            email: email || undefined,
            phone: phone || undefined,
            dob: record.dob || undefined,
            state: record.state ? String(record.state).toUpperCase().trim() : undefined,
            zip: record.zip ? String(record.zip).replace(/\D/g, '').padStart(5, '0').slice(0, 5) : undefined,
            address: record.address || undefined,
            city: record.city || undefined,
            client_status: record.status || 'Active',
            import_source: `BOB_${carrierSource}`,
            carrier_source: carrierSource,
            created_at: record.created_at || now,
            updated_at: now,
          }

          if (existingId) {
            // Update existing — fill blanks only
            batch.set(db.collection('clients').doc(clientId), clientData, { merge: true })
          } else {
            batch.set(db.collection('clients').doc(clientId), clientData)
          }

          // Track for intra-batch dedup
          if (email) existingEmails.set(email, clientId)
          if (phone && phone.length === 10) existingPhones.set(phone, clientId)
          summary.imported++

          // If record includes account data, create account too
          if (record.policy_number || record.product_type) {
            const accountId = randomUUID()
            const accountData: Record<string, unknown> = {
              account_id: accountId,
              client_id: clientId,
              policy_number: record.policy_number || undefined,
              carrier: record.carrier || carrierSource,
              product_type: record.product_type || undefined,
              status: record.account_status ? normalizeAccountStatus(record.account_status) : 'active',
              premium: record.premium ? parseFloat(String(record.premium)) : undefined,
              effective_date: record.effective_date || undefined,
              import_source: `BOB_${carrierSource}`,
              created_at: now,
              updated_at: now,
            }
            batch.set(
              db.collection('clients').doc(clientId).collection('accounts').doc(accountId),
              accountData
            )
          }
        } catch (recErr) {
          summary.errors++
          summary.error_details.push({ index: globalIdx, error: String(recErr) })
        }
      }

      await batch.commit()
    }

    // Trim error details to first 50
    if (summary.error_details.length > 50) {
      summary.error_details = summary.error_details.slice(0, 50)
    }

    res.json(successResponse(summary))
  } catch (err) {
    console.error('POST /api/import/bob error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// INTAKE QUEUE STATUS
// ============================================================================

/**
 * GET /api/import/queue/status
 * Get intake queue depth by status and source
 */
importRoutes.get('/queue/status', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('intake_queue').get()

    const byStatus: Record<string, number> = {}
    const bySource: Record<string, number> = {}

    for (const doc of snap.docs) {
      const d = doc.data()
      byStatus[d.status] = (byStatus[d.status] || 0) + 1
      bySource[d.source] = (bySource[d.source] || 0) + 1
    }

    res.json(successResponse({ by_status: byStatus, by_source: bySource, total: snap.size }))
  } catch (err) {
    console.error('GET /api/import/queue/status error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
