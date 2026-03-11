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
