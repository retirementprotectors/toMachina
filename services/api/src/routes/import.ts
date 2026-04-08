import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
  validateRequired,
  param,
} from '../lib/helpers.js'
import { randomUUID, createHash } from 'crypto'
import { detectCarrierFormat, mapRowToCanonical, CARRIER_FORMATS } from '../lib/carrier-formats.js'
import { inferAccountType, parseOwnerName } from '../lib/account-type-inference.js'
import { parseSignalRecords, isSignalFormat, type SignalRawRecord } from '../lib/signal-parser.js'
import { buildColumnResolution, parseCommissionRow } from '../lib/commission-parser.js'
import { calculateFYC, calculateRenewal } from '@tomachina/core'
import type {
  ImportClientResult,
  ImportAccountResult,
  ImportBatchClientsResult,
  ImportBatchAccountsResult,
  ImportBatchAtlasWizardResult,
  ImportBatchLegacyResult,
  ImportValidateResult,
  ImportValidateFullResult,
  ImportApprovalCreateResult,
  ImportFinalizeResult,
  ImportAgentCreatedResult,
  ImportAgentSkippedNpnResult,
  ImportAgentSkippedEmailResult,
  ImportBatchAgentsResult,
  ImportRevenueCreatedResult,
  ImportRevenueSkippedResult,
  ImportBatchRevenuesResult,
  ImportCaseTaskResult,
  ImportBobResult,
  ImportSignalRevenueResult,
  ImportCommissionBulkResult,
  ImportCommissionReconcileResult,
  CarrierDetectFoundResult,
  CarrierDetectNotFoundResult,
  ImportCarrierAccountsResult,
  ImportLifeAccountsResult,
  ImportInvestmentAccountsResult,
  ImportBackfillClientsResult,
  ImportQueueStatusData,
} from '@tomachina/core/api-types/atlas'
import { startImportRun, completeImportRun } from '../lib/import-tracker.js'

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
  investments: 'accounts_investments',
  bdria: 'accounts_investments',
  bd_ria: 'accounts_investments',
  investment: 'accounts_investments',
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

    res.status(201).json(successResponse<ImportClientResult>({
      client_id: clientId,
      action: 'created',
    } as unknown as ImportClientResult))
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

    res.json(successResponse<ImportBatchClientsResult>(results as unknown as ImportBatchClientsResult))
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

    res.status(201).json(successResponse<ImportAccountResult>({
      account_id: accountId,
      action: 'created',
      collection,
    } as unknown as ImportAccountResult))
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

    const importRunId = await startImportRun({
      import_type: 'accounts',
      source: options.source || 'API_IMPORT',
      total_records: accounts.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

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

    await completeImportRun(importRunId, {
      imported: results.imported,
      skipped: 0,
      duplicates: 0,
      errors: results.errors.length,
      error_details: results.errors,
    })

    res.json(successResponse<ImportBatchAccountsResult>({ ...results, import_run_id: importRunId } as unknown as ImportBatchAccountsResult))
  } catch (err) {
    console.error('POST /api/import/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ATLAS WIZARD import_type → collection routing
// ============================================================================

const ATLAS_IMPORT_COLLECTIONS: Record<string, string | null> = {
  medicare: 'accounts',    // routed to accounts subcollection via existing flow
  annuity: 'accounts',
  life: 'accounts',
  investments: 'accounts',
  client: 'clients',
  commission: 'revenue',
  revenue: 'revenue',
  agent: 'users',          // agents are stored in the users collection
}

// ============================================================================
// BATCH IMPORT (CLIENTS + ACCOUNTS)
// ============================================================================

/**
 * POST /api/import/batch
 * Import clients and accounts in a single request.
 * Also handles ATLAS wizard payloads: { records, import_type, format_id }
 */
importRoutes.post('/batch', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()

    // ── ATLAS Wizard payload: { records, import_type, format_id } ──
    const atlasRecords = req.body.records as Record<string, unknown>[] | undefined
    const importType = req.body.import_type as string | undefined

    if (atlasRecords && Array.isArray(atlasRecords) && importType) {
      const targetCollection = ATLAS_IMPORT_COLLECTIONS[importType]

      if (!targetCollection) {
        res.status(400).json(errorResponse(
          `Unsupported import_type: "${importType}". Supported types: ${Object.keys(ATLAS_IMPORT_COLLECTIONS).join(', ')}`
        ))
        return
      }

      // Route known product-line account types to existing account endpoints
      if (['medicare', 'annuity', 'life', 'investments'].includes(importType)) {
        // Reshape into the accounts endpoint shape and delegate
        const accountRecords = atlasRecords.map(r => ({
          ...r,
          account_category: importType,
          import_source: 'ATLAS_WIZARD',
          created_at: now,
          updated_at: now,
        }))
        // Use existing account import logic below — fall through to legacy handler
        req.body.accounts = accountRecords
        req.body.clients = []
        req.body.options = { source: 'ATLAS_WIZARD' }
        // Fall through to legacy batch logic below
      } else {
        // New category types: client, commission, revenue, agent
        // Stub handlers — write to target collection with tracking
        const importRunId = await startImportRun({
          import_type: `atlas_${importType}`,
          source: 'ATLAS_WIZARD',
          total_records: atlasRecords.length,
          triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
        })

        const batch = db.batch()
        let imported = 0
        let skipped = 0
        const errors: Array<{ index: number; error: string }> = []

        for (let i = 0; i < atlasRecords.length; i++) {
          try {
            const record = { ...atlasRecords[i] } as Record<string, unknown>
            record.import_source = 'ATLAS_WIZARD'
            record.import_type = importType
            record.import_run_id = importRunId
            record.created_at = record.created_at || now
            record.updated_at = now

            const docId = (record.client_id || record.agent_id || record.revenue_id || randomUUID()) as string
            batch.set(db.collection(targetCollection).doc(docId), record, { merge: true })
            imported++
          } catch (recErr) {
            errors.push({ index: i, error: String(recErr) })
            skipped++
          }
        }

        await batch.commit()
        await completeImportRun(importRunId, {
          imported,
          skipped,
          duplicates: 0,
          errors: errors.length,
          error_details: errors,
        })

        res.json(successResponse<ImportBatchAtlasWizardResult>({
          total_received: atlasRecords.length,
          auto_matched: 0,
          new_created: imported,
          updated: 0,
          duplicates_removed: 0,
          flagged: 0,
          skipped,
          errors: errors.length,
          run_id: importRunId,
          details: errors.length > 0 ? { errors } : undefined,
        } as unknown as ImportBatchAtlasWizardResult))
        return
      }
    }

    const clients = req.body.clients || []
    const accounts = req.body.accounts || []
    const options = req.body.options || {}

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

    // Phase 1.5: Auto-detect households from imported clients
    const householdResults = { detected: 0, created: 0 }
    try {
      // Build address-group map from just-imported clients
      const addressGroups = new Map<string, string[]>()
      const importedClients = new Map<string, Record<string, unknown>>()

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i] as Record<string, unknown>
        const clientId = (client.client_id as string) || results.clients.mapping[client._ref as string || client.client_ref as string || `${client.first_name} ${client.last_name}`]
        if (!clientId) continue
        importedClients.set(clientId, client)

        const lastName = String(client.last_name || '').toLowerCase().trim()
        const address = String(client.address || '').toLowerCase().trim()
        const zip = String(client.zip || '').trim()
        if (!lastName || !address || !zip) continue

        const key = `${lastName}|${address}|${zip}`
        const group = addressGroups.get(key) || []
        group.push(clientId)
        addressGroups.set(key, group)
      }

      // Detect spouse-field matches
      const spousePairs = new Set<string>()
      for (const [clientId, client] of importedClients) {
        const spouseName = String(client.spouse_name || client.spouse_first_name || '').toLowerCase().trim()
        if (!spouseName) continue

        for (const [otherId, other] of importedClients) {
          if (otherId === clientId) continue
          const otherFirst = String(other.first_name || '').toLowerCase().trim()
          if (otherFirst && otherFirst === spouseName) {
            const pairKey = [clientId, otherId].sort().join('|')
            if (!spousePairs.has(pairKey)) {
              spousePairs.add(pairKey)
              // Merge into address group
              const existingGroup = Array.from(addressGroups.values()).find(g => g.includes(clientId) || g.includes(otherId))
              if (existingGroup) {
                if (!existingGroup.includes(clientId)) existingGroup.push(clientId)
                if (!existingGroup.includes(otherId)) existingGroup.push(otherId)
              } else {
                addressGroups.set(`spouse_${pairKey}`, [clientId, otherId])
              }
            }
          }
        }
      }

      // Check MFJ filing status — already handled by address grouping above
      // This catches MFJ clients whose spouse isn't in the same import
      for (const [, client] of importedClients) {
        const filing = String(client.filing_status || '').toLowerCase()
        if (!filing.includes('married') && !filing.includes('mfj')) continue
        // Future: cross-reference existing clients for MFJ matches
      }

      // Create households for groups with 2+ members
      const householdBatch = db.batch()
      let householdOpsCount = 0
      const grouped = new Set<string>()

      for (const [, memberIds] of addressGroups) {
        if (memberIds.length < 2) continue

        // Check if any member already has a household_id (from existing data)
        let existingHouseholdId: string | null = null
        for (const mid of memberIds) {
          const existingClient = await db.collection('clients').doc(mid).get()
          if (existingClient.exists) {
            const data = existingClient.data() as Record<string, unknown>
            if (data.household_id) {
              existingHouseholdId = data.household_id as string
              break
            }
          }
        }

        householdResults.detected++
        const hhNow = new Date().toISOString()

        if (existingHouseholdId) {
          // Add new members to existing household
          const existingHH = await db.collection('households').doc(existingHouseholdId).get()
          if (existingHH.exists) {
            const hhData = existingHH.data() as Record<string, unknown>
            const existingMembers = (hhData.members || []) as Array<Record<string, unknown>>
            const existingIds = new Set(existingMembers.map(m => m.client_id as string))

            for (const mid of memberIds) {
              if (existingIds.has(mid) || grouped.has(mid)) continue
              const c = importedClients.get(mid)
              if (!c) continue
              existingMembers.push({
                client_id: mid,
                client_name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
                role: 'other',
                relationship: 'Other',
                added_at: hhNow,
              })
              householdBatch.update(db.collection('clients').doc(mid), { household_id: existingHouseholdId, updated_at: hhNow })
              householdOpsCount++
              grouped.add(mid)
            }
            householdBatch.update(db.collection('households').doc(existingHouseholdId), { members: existingMembers, updated_at: hhNow })
            householdOpsCount++
          }
        } else {
          // Create new household
          const householdId = db.collection('households').doc().id
          const primary = importedClients.get(memberIds[0])!
          const members = memberIds.map((mid, idx) => {
            const c = importedClients.get(mid) || {} as Record<string, unknown>
            return {
              client_id: mid,
              client_name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              role: idx === 0 ? 'primary' : 'spouse',
              relationship: idx === 0 ? 'self' : 'Spouse',
              added_at: hhNow,
            }
          })

          householdBatch.set(db.collection('households').doc(householdId), {
            household_id: householdId,
            household_name: `${primary.last_name || 'Unknown'} Household`,
            primary_contact_id: memberIds[0],
            primary_contact_name: `${primary.first_name || ''} ${primary.last_name || ''}`.trim(),
            members,
            address: String(primary.address || ''),
            city: String(primary.city || ''),
            state: String(primary.state || ''),
            zip: String(primary.zip || ''),
            household_status: 'Active',
            assigned_user_id: String(primary.assigned_user_id || ''),
            aggregate_financials: {},
            created_at: hhNow,
            updated_at: hhNow,
            _source: 'import_auto_detect',
          })
          householdOpsCount++

          for (const mid of memberIds) {
            householdBatch.update(db.collection('clients').doc(mid), { household_id: householdId, updated_at: hhNow })
            householdOpsCount++
            grouped.add(mid)
          }

          householdResults.created++
        }

        // Guard against batch size limit
        if (householdOpsCount >= 400) break
      }

      if (householdOpsCount > 0) {
        await householdBatch.commit()
      }
    } catch (householdErr) {
      console.error('Household auto-detect error:', householdErr)
      // Non-critical — don't fail the import
    }

    // Add household results to response
    ;(results as Record<string, unknown>).households = householdResults

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

    res.json(successResponse<ImportBatchLegacyResult>(results as unknown as ImportBatchLegacyResult))
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
    res.json(successResponse<ImportValidateResult>({ valid, errors, warnings } as unknown as ImportValidateResult))
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
      _created_by: userEmail,
      created_at: now,
      updated_at: now,
    }

    await db.collection('approval_queue').doc(batchId).set(approvalData)
    await writeThroughBridge('approval_queue', 'insert', batchId, approvalData)

    res.status(201).json(successResponse<ImportApprovalCreateResult>({
      batch_id: batchId,
      status: 'pending',
    } as unknown as ImportApprovalCreateResult))
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

    res.json(successResponse<ImportFinalizeResult>({
      client_id: clientId,
      status: 'finalized',
    } as unknown as ImportFinalizeResult))
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
      res.json(successResponse<ImportAgentSkippedNpnResult>({
        action: 'skipped',
        reason: 'duplicate_npn',
        existing_agent_id: existing.id,
        existing_data: { npn: existing.data().npn, first_name: existing.data().first_name, last_name: existing.data().last_name },
      } as unknown as ImportAgentSkippedNpnResult))
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
        res.json(successResponse<ImportAgentSkippedEmailResult>({
          action: 'skipped',
          reason: 'duplicate_email',
          existing_agent_id: existing.id,
        } as unknown as ImportAgentSkippedEmailResult))
        return
      }
    }

    const now = new Date().toISOString()
    agentData.import_source = options.source || 'API_IMPORT'
    agentData.created_at = agentData.created_at || now
    agentData.updated_at = now
    agentData.status = agentData.status || agentData.agent_status || 'active'

    const agentId = agentData.agent_id || randomUUID()
    agentData.agent_id = agentId

    const bridgeResult = await writeThroughBridge('agents', 'insert', agentId, agentData)
    if (!bridgeResult.success) {
      await db.collection('agents').doc(agentId).set(agentData)
    }

    res.status(201).json(successResponse<ImportAgentCreatedResult>({
      agent_id: agentId,
      action: 'created',
    } as unknown as ImportAgentCreatedResult))
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

    const importRunId = await startImportRun({
      import_type: 'agents',
      source: options.source || 'API_IMPORT',
      total_records: agents.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

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
        agent.status = agent.status || agent.agent_status || 'active'

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

    await completeImportRun(importRunId, {
      imported: results.imported,
      skipped: results.skipped,
      duplicates: 0,
      errors: results.errors.length,
      error_details: results.errors,
    })

    res.json(successResponse<ImportBatchAgentsResult>({ ...results, import_run_id: importRunId } as unknown as ImportBatchAgentsResult))
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
        res.json(successResponse<ImportRevenueSkippedResult>({
          action: 'skipped',
          reason: 'duplicate_stateable_id',
          existing_revenue_id: existingSnap.docs[0].id,
        } as unknown as ImportRevenueSkippedResult))
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

    res.status(201).json(successResponse<ImportRevenueCreatedResult>({
      revenue_id: revenueId,
      action: 'created',
      linked_agent: revenueData.agent_id || null,
      linked_account: revenueData.account_id || null,
    } as unknown as ImportRevenueCreatedResult))
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

    const importRunId = await startImportRun({
      wire_id: 'WIRE_COMMISSION_SYNC',
      import_type: 'revenues',
      source: options.source || 'API_IMPORT',
      total_records: revenues.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

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

    await completeImportRun(importRunId, {
      imported: results.imported,
      skipped: results.skipped,
      duplicates: 0,
      errors: results.errors.length,
      error_details: results.errors,
    })

    res.json(successResponse<ImportBatchRevenuesResult>({ ...results, import_run_id: importRunId } as unknown as ImportBatchRevenuesResult))
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
    taskData._created_by = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    const taskId = taskData.task_id || randomUUID()
    taskData.task_id = taskId

    const bridgeResult = await writeThroughBridge('case_tasks', 'insert', taskId, taskData)
    if (!bridgeResult.success) {
      await db.collection('case_tasks').doc(taskId).set(taskData)
    }

    res.status(201).json(successResponse<ImportCaseTaskResult>({
      task_id: taskId,
      action: 'created',
      status: taskData.status,
    } as unknown as ImportCaseTaskResult))
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
    res.json(successResponse<ImportValidateFullResult>({ valid, errors, warnings, normalized_data: valid ? normalized : undefined } as unknown as ImportValidateFullResult))
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

    const importRunId = await startImportRun({
      wire_id: 'WIRE_CLIENT_ENRICHMENT',
      import_type: 'bob',
      source: `BOB_${carrierSource}`,
      total_records: records.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

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
            status: record.status || 'Active',
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

    await completeImportRun(importRunId, {
      imported: summary.imported,
      skipped: summary.skipped,
      duplicates: summary.duplicates,
      errors: summary.errors,
      error_details: summary.error_details,
    })

    res.json(successResponse<ImportBobResult>({ ...summary, import_run_id: importRunId } as unknown as ImportBobResult))
  } catch (err) {
    console.error('POST /api/import/bob error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SIGNAL REVENUE IMPORT
// ============================================================================

/**
 * POST /api/import/signal-revenue
 * Import Signal IMO commission/revenue records.
 * Auto-detects Signal format, parses, deduplicates by stateable_id,
 * and auto-links agents by name and accounts by policy number.
 */
importRoutes.post('/signal-revenue', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const records: SignalRawRecord[] = req.body.records || []
    const options = req.body.options || {}

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty records array'))
      return
    }

    // Auto-detect format if caller didn't confirm
    if (!options.skip_detection && !isSignalFormat(records)) {
      res.status(400).json(errorResponse(
        'Records do not appear to be in Signal format. Use options.skip_detection=true to override.'
      ))
      return
    }

    const importRunId = await startImportRun({
      wire_id: 'WIRE_COMMISSION_SYNC',
      import_type: 'signal_revenue',
      source: 'SIGNAL',
      total_records: records.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

    // Parse Signal records
    const { parsed, errors: parseErrors } = parseSignalRecords(records)

    if (parsed.length === 0) {
      res.json(successResponse<ImportSignalRevenueResult>({
        imported: 0,
        skipped: 0,
        parse_errors: parseErrors.length,
        error_details: parseErrors.slice(0, 50),
      } as unknown as ImportSignalRevenueResult))
      return
    }

    // Pre-load existing stateable_ids for dedup
    const existingIds = new Set<string>()
    const stateSnap = await db.collection('revenue').select('stateable_id').get()
    for (const doc of stateSnap.docs) {
      const sid = doc.data().stateable_id
      if (sid) existingIds.add(sid)
    }

    // Pre-load agents for name-based linking
    const agentsByName = new Map<string, string>()
    const agentSnap = await db.collection('agents').select('first_name', 'last_name', 'agent_id').get()
    for (const doc of agentSnap.docs) {
      const d = doc.data()
      const fullName = `${d.first_name || ''} ${d.last_name || ''}`.toLowerCase().trim()
      if (fullName) agentsByName.set(fullName, d.agent_id || doc.id)
    }

    const now = new Date().toISOString()
    const summary = {
      imported: 0,
      skipped: 0,
      linked_agents: 0,
      linked_accounts: 0,
      parse_errors: parseErrors.length,
      errors: [] as Array<{ index: number; error: string }>,
    }

    // Process in batches of 400
    const BATCH_SIZE = 400
    for (let start = 0; start < parsed.length; start += BATCH_SIZE) {
      const chunk = parsed.slice(start, start + BATCH_SIZE)
      const batch = db.batch()

      for (let i = 0; i < chunk.length; i++) {
        const rec = chunk[i]

        // Dedup
        if (existingIds.has(rec.stateable_id) && !options.force) {
          summary.skipped++
          continue
        }

        const revenueId = randomUUID()
        const revenueData: Record<string, unknown> = {
          revenue_id: revenueId,
          agent_name: rec.agent_name,
          amount: rec.amount,
          revenue_type: rec.revenue_type,
          payment_date: rec.payment_date,
          carrier: rec.carrier,
          policy_number: rec.policy_number,
          client_name: rec.client_name,
          product: rec.product,
          level: rec.level,
          stateable_id: rec.stateable_id,
          import_source: rec.import_source,
          created_at: now,
          updated_at: now,
        }

        // Auto-link agent by name
        const agentKey = rec.agent_name.toLowerCase().trim()
        if (agentKey && agentsByName.has(agentKey)) {
          revenueData.agent_id = agentsByName.get(agentKey)
          summary.linked_agents++
        }

        // Auto-link account by policy number
        if (rec.policy_number) {
          const policySnap = await db.collectionGroup('accounts')
            .where('policy_number', '==', rec.policy_number)
            .limit(1)
            .get()
          if (!policySnap.empty) {
            revenueData.account_id = policySnap.docs[0].id
            const pathParts = policySnap.docs[0].ref.path.split('/')
            if (pathParts.length >= 2) {
              revenueData.client_id = pathParts[1]
            }
            summary.linked_accounts++
          }
        }

        const bridgeResult = await writeThroughBridge('revenue', 'insert', revenueId, revenueData)
        if (!bridgeResult.success) {
          batch.set(db.collection('revenue').doc(revenueId), revenueData)
        }
        existingIds.add(rec.stateable_id)
        summary.imported++
      }

      await batch.commit()
    }

    await completeImportRun(importRunId, {
      imported: summary.imported,
      skipped: summary.skipped,
      duplicates: 0,
      errors: summary.errors.length,
      error_details: summary.errors,
    })

    res.json(successResponse<ImportSignalRevenueResult>({ ...summary, import_run_id: importRunId } as unknown as ImportSignalRevenueResult))
  } catch (err) {
    console.error('POST /api/import/signal-revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GENERIC COMMISSION BULK IMPORT
// ============================================================================

/**
 * POST /api/import/commission-bulk
 * Generic carrier commission import with auto-column-detection.
 * Accepts rows with headers, resolves columns, normalizes, deduplicates, and writes.
 */
importRoutes.post('/commission-bulk', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const rows: Record<string, unknown>[] = req.body.rows || []
    const headers: string[] = req.body.headers || []
    const columnOverrides: Record<string, string> | undefined = req.body.column_overrides
    const options = req.body.options || {}

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty rows array'))
      return
    }

    const importRunId = await startImportRun({
      wire_id: 'WIRE_COMMISSION_SYNC',
      import_type: 'commission_bulk',
      source: options.source || 'COMMISSION_BULK',
      total_records: rows.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

    // If headers not provided, derive from first row keys
    const effectiveHeaders = headers.length > 0 ? headers : Object.keys(rows[0])

    // Build column resolution
    const resolution = buildColumnResolution(effectiveHeaders, columnOverrides)

    // Check we resolved at least amount
    if (!resolution.amount) {
      res.status(400).json(errorResponse(
        `Could not resolve "amount" column from headers: ${effectiveHeaders.join(', ')}. ` +
        'Provide column_overrides: { amount: "your_column_name" }'
      ))
      return
    }

    const now = new Date().toISOString()
    const summary = {
      imported: 0,
      skipped: 0,
      linked_agents: 0,
      linked_accounts: 0,
      resolution,
      errors: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load agents for NPN-based linking
    const agentsByNpn = new Map<string, string>()
    const agentSnap = await db.collection('agents').select('npn', 'agent_id').get()
    for (const doc of agentSnap.docs) {
      const d = doc.data()
      if (d.npn) agentsByNpn.set(d.npn, d.agent_id || doc.id)
    }

    // Pre-load existing stateable_ids for dedup
    const existingIds = new Set<string>()
    const stateSnap = await db.collection('revenue').select('stateable_id').get()
    for (const doc of stateSnap.docs) {
      const sid = doc.data().stateable_id
      if (sid) existingIds.add(sid)
    }

    // Process in batches of 400
    const BATCH_SIZE = 400
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const chunk = rows.slice(start, start + BATCH_SIZE)
      const batch = db.batch()

      for (let i = 0; i < chunk.length; i++) {
        const globalIdx = start + i
        try {
          const parsed = parseCommissionRow(chunk[i], resolution)
          const amount = parseFloat(String(parsed.amount ?? 0))

          if (amount === 0 && !options.allow_zero) {
            summary.skipped++
            continue
          }

          // Generate stateable_id for dedup
          const composite = [
            String(parsed.agent_name || parsed.agent_npn || '').toLowerCase().trim(),
            String(parsed.policy_number || '').trim(),
            String(parsed.payment_date || ''),
            String(amount),
            String(parsed.revenue_type || 'FYC'),
          ].join('|')
          const stateableId = createHash('sha256').update(composite).digest('hex').slice(0, 32)

          if (existingIds.has(stateableId) && !options.force) {
            summary.skipped++
            continue
          }

          const revenueId = randomUUID()
          const revenueData: Record<string, unknown> = {
            revenue_id: revenueId,
            ...parsed,
            amount,
            stateable_id: stateableId,
            import_source: options.source || 'COMMISSION_BULK',
            created_at: now,
            updated_at: now,
          }

          // Auto-link agent by NPN
          const npn = String(parsed.agent_npn || '').replace(/\D/g, '').slice(0, 10)
          if (npn && npn.length >= 8 && agentsByNpn.has(npn)) {
            revenueData.agent_id = agentsByNpn.get(npn)
            summary.linked_agents++
          }

          // Auto-link account by policy number
          if (parsed.policy_number) {
            const policySnap = await db.collectionGroup('accounts')
              .where('policy_number', '==', String(parsed.policy_number))
              .limit(1)
              .get()
            if (!policySnap.empty) {
              revenueData.account_id = policySnap.docs[0].id
              const pathParts = policySnap.docs[0].ref.path.split('/')
              if (pathParts.length >= 2) {
                revenueData.client_id = pathParts[1]
              }
              summary.linked_accounts++
            }
          }

          batch.set(db.collection('revenue').doc(revenueId), revenueData)
          existingIds.add(stateableId)
          summary.imported++
        } catch (rowErr) {
          summary.errors.push({ index: globalIdx, error: String(rowErr) })
        }
      }

      await batch.commit()
    }

    // Trim errors
    if (summary.errors.length > 50) {
      summary.errors = summary.errors.slice(0, 50)
    }

    await completeImportRun(importRunId, {
      imported: summary.imported,
      skipped: summary.skipped,
      duplicates: 0,
      errors: summary.errors.length,
      error_details: summary.errors,
    })

    res.json(successResponse<ImportCommissionBulkResult>({ ...summary, import_run_id: importRunId } as unknown as ImportCommissionBulkResult))
  } catch (err) {
    console.error('POST /api/import/commission-bulk error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// COMMISSION RECONCILIATION
// ============================================================================

/**
 * POST /api/import/commission-reconcile
 * Compare imported commissions against expected comp grid rates.
 * Queries revenue records, looks up comp_grids, calculates expected,
 * and flags discrepancies.
 */
importRoutes.post('/commission-reconcile', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { agent_id, period, carrier, tolerance_pct, import_run_id } = req.body
    const tolerancePercent = parseFloat(String(tolerance_pct || 2)) / 100

    let revenueQuery = db.collection('revenue') as FirebaseFirestore.Query
    if (agent_id) revenueQuery = revenueQuery.where('agent_id', '==', agent_id)
    if (period) revenueQuery = revenueQuery.where('period', '==', period)
    if (carrier) revenueQuery = revenueQuery.where('carrier', '==', carrier)
    if (import_run_id) revenueQuery = revenueQuery.where('import_run_id', '==', import_run_id)

    const revenueSnap = await revenueQuery.get()

    // Pre-load comp grids
    const compGrids = new Map<string, { rate: number; rate_type: string }>()
    const gridSnap = await db.collection('comp_grids').get()
    for (const doc of gridSnap.docs) {
      const d = doc.data()
      // Key by carrier_id + product_type
      const key = `${d.carrier_id || ''}|${d.product_type || ''}`
      compGrids.set(key, { rate: parseFloat(String(d.rate)) || 0, rate_type: d.rate_type || 'percent' })
    }

    const now = new Date().toISOString()
    const discrepancies: Record<string, unknown>[] = []
    let recordsChecked = 0
    let recordsMatched = 0

    for (const doc of revenueSnap.docs) {
      const d = doc.data()
      recordsChecked++

      const actualAmount = parseFloat(String(d.amount)) || 0
      const carrierKey = d.carrier_id || d.carrier || ''
      const productType = d.product_type || d.product || ''
      const gridKey = `${carrierKey}|${productType}`
      const grid = compGrids.get(gridKey)

      if (!grid) continue // No comp grid to compare against

      const premium = parseFloat(String(d.premium || d.total_premium || actualAmount))
      const revenueType = String(d.revenue_type || 'FYC').toUpperCase()

      let expectedAmount: number
      if (revenueType === 'REN') {
        expectedAmount = calculateRenewal(premium, grid.rate)
      } else {
        expectedAmount = calculateFYC(premium, grid.rate)
      }

      const diff = Math.abs(actualAmount - expectedAmount)
      const maxVal = Math.max(actualAmount, expectedAmount)
      const threshold = maxVal * tolerancePercent

      if (diff > threshold && diff > 1) {
        discrepancies.push({
          revenue_id: doc.id,
          agent_id: d.agent_id || '',
          carrier: carrierKey,
          product_type: productType,
          revenue_type: revenueType,
          period: d.period || '',
          policy_number: d.policy_number || '',
          actual_amount: actualAmount,
          expected_amount: Math.round(expectedAmount * 100) / 100,
          difference: Math.round(diff * 100) / 100,
          grid_rate: grid.rate,
          premium,
        })
      } else {
        recordsMatched++
      }
    }

    // Optionally auto-flag discrepancies
    if (req.body.auto_flag !== false && discrepancies.length > 0) {
      const flagBatch = db.batch()
      for (const disc of discrepancies.slice(0, 400)) {
        const discId = db.collection('commission_discrepancies').doc().id
        flagBatch.set(db.collection('commission_discrepancies').doc(discId), {
          discrepancy_id: discId,
          ...disc,
          status: 'open',
          source: 'import_reconcile',
          created_at: now,
          updated_at: now,
        })
      }
      await flagBatch.commit()
    }

    res.json(successResponse<ImportCommissionReconcileResult>({
      records_checked: recordsChecked,
      records_matched: recordsMatched,
      discrepancies_found: discrepancies.length,
      discrepancies: discrepancies.slice(0, 50),
      tolerance_percent: tolerancePercent * 100,
    } as unknown as ImportCommissionReconcileResult))
  } catch (err) {
    console.error('POST /api/import/commission-reconcile error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CARRIER FORMAT DETECTION (DRY-RUN)
// ============================================================================

/**
 * POST /api/import/carrier-detect
 * Detect carrier format from column headers — dry-run, no data imported.
 */
importRoutes.post('/carrier-detect', async (req: Request, res: Response) => {
  try {
    const headers = req.body.headers || []

    if (!Array.isArray(headers) || headers.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty headers array'))
      return
    }

    const format = detectCarrierFormat(headers)

    if (!format) {
      res.json(successResponse<CarrierDetectNotFoundResult>({
        detected: false,
        message: 'No carrier format matched (minimum 60% header signature required)',
        available_formats: CARRIER_FORMATS.map(f => ({
          carrier_id: f.carrier_id,
          carrier: f.carrier,
          signatures: f.header_signatures,
        })),
      } as unknown as CarrierDetectNotFoundResult))
      return
    }

    // Show which headers mapped and which did not
    const mappedHeaders: Record<string, string> = {}
    const unmappedHeaders: string[] = []
    const mapLower = new Map<string, string>()
    for (const [rawKey, canonKey] of Object.entries(format.column_map)) {
      mapLower.set(rawKey.toLowerCase(), canonKey)
    }
    for (const h of headers) {
      const canonical = mapLower.get(String(h).toLowerCase().trim())
      if (canonical) {
        mappedHeaders[h] = canonical
      } else {
        unmappedHeaders.push(h)
      }
    }

    res.json(successResponse<CarrierDetectFoundResult>({
      detected: true,
      carrier_id: format.carrier_id,
      carrier: format.carrier,
      default_category: format.default_category,
      dedup_keys: format.dedup_keys,
      mapped_headers: mappedHeaders,
      unmapped_headers: unmappedHeaders,
    } as unknown as CarrierDetectFoundResult))
  } catch (err) {
    console.error('POST /api/import/carrier-detect error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BULK CARRIER ACCOUNT IMPORT
// ============================================================================

/**
 * POST /api/import/carrier-accounts
 * Bulk import accounts from carrier-formatted data.
 * Auto-detects carrier format, maps columns, infers account type, dedup checks.
 */
importRoutes.post('/carrier-accounts', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const rows = req.body.rows || []
    const headers = req.body.headers || []
    const options = req.body.options || {}
    const forceCarrierId = options.carrier_id as string | undefined

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty rows array'))
      return
    }

    // Detect or override carrier format
    let format = forceCarrierId
      ? CARRIER_FORMATS.find(f => f.carrier_id === forceCarrierId) || null
      : null

    if (!format && headers.length > 0) {
      format = detectCarrierFormat(headers)
    }

    // If rows are objects (not arrays), try detecting from first row's keys
    if (!format && rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
      format = detectCarrierFormat(Object.keys(rows[0] as Record<string, unknown>))
    }

    if (!format) {
      res.status(400).json(errorResponse(
        'Could not detect carrier format. Provide headers array or options.carrier_id'
      ))
      return
    }

    // Infer wire from carrier's default_category
    const carrierWireMap: Record<string, string> = {
      life: 'WIRE_LIFE_ANNUITY_ACCOUNTS',
      annuity: 'WIRE_LIFE_ANNUITY_ACCOUNTS',
      investments: 'WIRE_INVESTMENT_ACCOUNTS',
      bdria: 'WIRE_INVESTMENT_ACCOUNTS',
      bd_ria: 'WIRE_INVESTMENT_ACCOUNTS',
      investment: 'WIRE_INVESTMENT_ACCOUNTS',
      medicare: 'WIRE_MAPD_ENROLLMENT',
    }
    const inferredWire = carrierWireMap[format.default_category || ''] || undefined

    const importRunId = await startImportRun({
      wire_id: inferredWire,
      import_type: 'carrier_accounts',
      source: `CARRIER_${format.carrier_id.toUpperCase()}`,
      total_records: rows.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

    const dryRun = options.dry_run || false
    const now = new Date().toISOString()
    const categoryBreakdown: Record<string, number> = { life: 0, annuity: 0, medicare: 0, investments: 0, unknown: 0 }
    const summary = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: 0,
      carrier_id: format.carrier_id,
      carrier: format.carrier,
      error_details: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load existing policy numbers for dedup
    const existingPolicies = new Set<string>()
    const carrierPolicySnap = await db.collectionGroup('accounts')
      .where('carrier_id', '==', format.carrier_id)
      .select('policy_number', 'account_number')
      .get()
    for (const doc of carrierPolicySnap.docs) {
      const d = doc.data()
      if (d.policy_number) existingPolicies.add(String(d.policy_number))
      if (d.account_number) existingPolicies.add(String(d.account_number))
    }

    // Process in batches of 400
    const CARRIER_BATCH = 400
    for (let start = 0; start < rows.length; start += CARRIER_BATCH) {
      const chunk = rows.slice(start, start + CARRIER_BATCH)
      const carrierBatch = db.batch()

      for (let i = 0; i < chunk.length; i++) {
        const globalIdx = start + i
        try {
          const rawRow = chunk[i] as Record<string, unknown>
          const mapped = mapRowToCanonical(rawRow, format)

          // Parse owner name if we have it but not first/last
          if (mapped.owner_name && !mapped.first_name) {
            const parsed = parseOwnerName(String(mapped.owner_name))
            mapped.first_name = parsed.first_name
            mapped.last_name = parsed.last_name
          }

          if (!mapped.first_name && !mapped.last_name && !mapped.owner_name) {
            summary.errors++
            summary.error_details.push({ index: globalIdx, error: 'No owner/client name found' })
            continue
          }

          // Dedup check
          const policyKey = String(mapped.policy_number || mapped.account_number || '')
          if (policyKey && existingPolicies.has(policyKey) && !options.force) {
            summary.duplicates++
            summary.skipped++
            continue
          }

          // Infer account type if not already set
          const category = (mapped.account_category as string) || inferAccountType(mapped)
          mapped.account_category = category
          const collection = ACCOUNT_TABS[category] || 'accounts'

          // Track category breakdown
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1

          // Normalize status
          if (mapped.status && typeof mapped.status === 'string') {
            mapped.status = normalizeAccountStatus(mapped.status)
          }

          // Normalize numeric fields
          for (const numField of ['premium', 'account_value', 'face_amount', 'market_value', 'cash_value', 'cash_balance', 'nav', 'cost_basis']) {
            if (mapped[numField] != null) {
              const numParsed = parseFloat(String(mapped[numField]).replace(/[$,]/g, ''))
              mapped[numField] = isNaN(numParsed) ? undefined : numParsed
            }
          }

          mapped.import_source = options.source || `CARRIER_${format.carrier_id.toUpperCase()}`
          mapped.created_at = now
          mapped.updated_at = now

          const accountId = randomUUID()
          mapped.account_id = accountId

          // Auto-link client by name if requested
          if (options.link_clients && !mapped.client_id && (mapped.first_name || mapped.owner_name)) {
            const clientQuery = await db.collection('clients')
              .where('last_name', '==', mapped.last_name)
              .where('first_name', '==', mapped.first_name)
              .limit(1).get()
            if (!clientQuery.empty) {
              mapped.client_id = clientQuery.docs[0].id
            }
          }

          if (!dryRun) {
            // If we have a client_id, nest under client; otherwise write to top-level collection
            if (mapped.client_id) {
              carrierBatch.set(
                db.collection('clients').doc(String(mapped.client_id)).collection('accounts').doc(accountId),
                mapped
              )
            } else {
              carrierBatch.set(db.collection(collection).doc(accountId), mapped)
            }
          }

          if (policyKey) existingPolicies.add(policyKey)
          summary.imported++
        } catch (rowErr) {
          summary.errors++
          summary.error_details.push({ index: globalIdx, error: String(rowErr) })
        }
      }

      if (!dryRun) {
        await carrierBatch.commit()
      }
    }

    if (summary.error_details.length > 50) {
      summary.error_details = summary.error_details.slice(0, 50)
    }

    if (!dryRun) {
      await completeImportRun(importRunId, {
        imported: summary.imported,
        skipped: summary.skipped,
        duplicates: summary.duplicates,
        errors: summary.errors,
        error_details: summary.error_details,
      })
    }

    res.json(successResponse<ImportCarrierAccountsResult>({ ...summary, category_breakdown: categoryBreakdown, dry_run: dryRun, import_run_id: dryRun ? undefined : importRunId } as unknown as ImportCarrierAccountsResult))
  } catch (err) {
    console.error('POST /api/import/carrier-accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SPECIALIZED LIFE POLICY IMPORT
// ============================================================================

/**
 * POST /api/import/life-accounts
 * Specialized life policy import with life-specific field handling.
 */
importRoutes.post('/life-accounts', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const policies = req.body.policies || []
    const options = req.body.options || {}

    if (!Array.isArray(policies) || policies.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty policies array'))
      return
    }

    const dryRun = options.dry_run || false

    const importRunId = await startImportRun({
      wire_id: 'WIRE_LIFE_ANNUITY_ACCOUNTS',
      import_type: 'life_accounts',
      source: options.source || 'LIFE_IMPORT',
      total_records: policies.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

    const now = new Date().toISOString()
    const warnings: string[] = []
    const summary = {
      total: policies.length,
      imported: 0,
      skipped: 0,
      errors: 0,
      error_details: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load existing life policy numbers for dedup
    const existingLifePolicies = new Set<string>()
    const lifePolicySnap = await db.collection('accounts_life').select('policy_number').get()
    for (const doc of lifePolicySnap.docs) {
      const pn = doc.data().policy_number
      if (pn) existingLifePolicies.add(String(pn))
    }

    const LIFE_BATCH = 400
    for (let start = 0; start < policies.length; start += LIFE_BATCH) {
      const chunk = policies.slice(start, start + LIFE_BATCH)
      const lifeBatch = db.batch()

      for (let i = 0; i < chunk.length; i++) {
        const globalIdx = start + i
        try {
          const policy = chunk[i] as Record<string, unknown>

          const missing = validateRequired(policy, ['policy_number'])
          if (missing) {
            summary.errors++
            summary.error_details.push({ index: globalIdx, error: missing })
            continue
          }

          const policyNumber = String(policy.policy_number)

          // Dedup
          if (existingLifePolicies.has(policyNumber) && !options.force) {
            summary.skipped++
            continue
          }

          // Parse owner name if needed
          if (policy.owner_name && !policy.first_name) {
            const parsed = parseOwnerName(String(policy.owner_name))
            policy.first_name = parsed.first_name
            policy.last_name = parsed.last_name
          }

          // Normalize numeric fields
          for (const numField of ['face_amount', 'premium', 'cash_value']) {
            if (policy[numField] != null) {
              const numParsed = parseFloat(String(policy[numField]).replace(/[$,]/g, ''))
              policy[numField] = isNaN(numParsed) ? undefined : numParsed
            }
          }

          // Warn if missing face_amount and death_benefit
          if (!policy.face_amount && !policy.death_benefit) {
            warnings.push(`Record ${globalIdx}: Missing face_amount and death_benefit`)
          }

          if (policy.status && typeof policy.status === 'string') {
            policy.status = normalizeAccountStatus(policy.status)
          }

          policy.account_category = 'life'
          policy.import_source = options.source || 'LIFE_IMPORT'
          policy.created_at = now
          policy.updated_at = now

          const accountId = randomUUID()
          policy.account_id = accountId

          if (!dryRun) {
            const bridgeResult = await writeThroughBridge('accounts_life', 'insert', accountId, policy as Record<string, unknown>)
            if (!bridgeResult.success) {
              if (policy.client_id) {
                lifeBatch.set(
                  db.collection('clients').doc(String(policy.client_id)).collection('accounts').doc(accountId),
                  policy
                )
              } else {
                lifeBatch.set(db.collection('accounts_life').doc(accountId), policy)
              }
            }
          }

          existingLifePolicies.add(policyNumber)
          summary.imported++
        } catch (rowErr) {
          summary.errors++
          summary.error_details.push({ index: globalIdx, error: String(rowErr) })
        }
      }

      if (!dryRun) {
        await lifeBatch.commit()
      }
    }

    if (summary.error_details.length > 50) {
      summary.error_details = summary.error_details.slice(0, 50)
    }

    if (!dryRun) {
      await completeImportRun(importRunId, {
        imported: summary.imported,
        skipped: summary.skipped,
        duplicates: 0,
        errors: summary.errors,
        error_details: summary.error_details,
      })
    }

    res.json(successResponse<ImportLifeAccountsResult>({ ...summary, warnings, dry_run: dryRun, import_run_id: dryRun ? undefined : importRunId } as unknown as ImportLifeAccountsResult))
  } catch (err) {
    console.error('POST /api/import/life-accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SPECIALIZED INVESTMENT ACCOUNT IMPORT
// ============================================================================

/**
 * POST /api/import/investment-accounts
 * Specialized investment account import with securities-specific field handling.
 * Legacy route /api/import/bdria-accounts also supported.
 */
importRoutes.post(['/investment-accounts', '/bdria-accounts'], async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const investmentAccounts = req.body.accounts || []
    const options = req.body.options || {}

    if (!Array.isArray(investmentAccounts) || investmentAccounts.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty accounts array'))
      return
    }

    const dryRun = options.dry_run || false

    const importRunId = await startImportRun({
      wire_id: 'WIRE_INVESTMENT_ACCOUNTS',
      import_type: 'investment_accounts',
      source: options.source || 'INVESTMENT_IMPORT',
      total_records: investmentAccounts.length,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

    const now = new Date().toISOString()
    const warnings: string[] = []
    const summary = {
      total: investmentAccounts.length,
      imported: 0,
      skipped: 0,
      errors: 0,
      error_details: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load existing account numbers for dedup
    const existingAccounts = new Set<string>()
    const acctSnap = await db.collection('accounts_investments').select('account_number').get()
    for (const doc of acctSnap.docs) {
      const an = doc.data().account_number
      if (an) existingAccounts.add(String(an))
    }

    const BATCH_SIZE = 400
    for (let start = 0; start < investmentAccounts.length; start += BATCH_SIZE) {
      const chunk = investmentAccounts.slice(start, start + BATCH_SIZE)
      const investBatch = db.batch()

      for (let i = 0; i < chunk.length; i++) {
        const globalIdx = start + i
        try {
          const account = chunk[i] as Record<string, unknown>

          const missing = validateRequired(account, ['account_number'])
          if (missing) {
            summary.errors++
            summary.error_details.push({ index: globalIdx, error: missing })
            continue
          }

          const accountNumber = String(account.account_number)

          // Dedup
          if (existingAccounts.has(accountNumber) && !options.force) {
            summary.skipped++
            continue
          }

          // Parse owner name if needed
          if (account.owner_name && !account.first_name) {
            const parsed = parseOwnerName(String(account.owner_name))
            account.first_name = parsed.first_name
            account.last_name = parsed.last_name
          }

          // Normalize numeric fields
          for (const numField of ['market_value', 'cash_balance', 'nav', 'cost_basis', 'shares', 'management_fee']) {
            if (account[numField] != null) {
              const numParsed = parseFloat(String(account[numField]).replace(/[$,]/g, ''))
              account[numField] = isNaN(numParsed) ? undefined : numParsed
            }
          }

          // Warn if missing custodian
          if (!account.custodian) {
            warnings.push(`Record ${globalIdx}: Missing custodian`)
          }

          if (account.status && typeof account.status === 'string') {
            account.status = normalizeAccountStatus(account.status)
          }

          account.account_category = 'investments'
          account.import_source = options.source || 'INVESTMENT_IMPORT'
          account.created_at = now
          account.updated_at = now

          const accountId = randomUUID()
          account.account_id = accountId

          if (!dryRun) {
            const bridgeResult = await writeThroughBridge('accounts_investments', 'insert', accountId, account as Record<string, unknown>)
            if (!bridgeResult.success) {
              if (account.client_id) {
                investBatch.set(
                  db.collection('clients').doc(String(account.client_id)).collection('accounts').doc(accountId),
                  account
                )
              } else {
                investBatch.set(db.collection('accounts_investments').doc(accountId), account)
              }
            }
          }

          existingAccounts.add(accountNumber)
          summary.imported++
        } catch (rowErr) {
          summary.errors++
          summary.error_details.push({ index: globalIdx, error: String(rowErr) })
        }
      }

      if (!dryRun) {
        await investBatch.commit()
      }
    }

    if (summary.error_details.length > 50) {
      summary.error_details = summary.error_details.slice(0, 50)
    }

    if (!dryRun) {
      await completeImportRun(importRunId, {
        imported: summary.imported,
        skipped: summary.skipped,
        duplicates: 0,
        errors: summary.errors,
        error_details: summary.error_details,
      })
    }

    res.json(successResponse<ImportInvestmentAccountsResult>({ ...summary, warnings, dry_run: dryRun, import_run_id: dryRun ? undefined : importRunId } as unknown as ImportInvestmentAccountsResult))
  } catch (err) {
    console.error('POST /api/import/investment-accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CLIENT DEMOGRAPHIC BACKFILL
// ============================================================================

const BACKFILL_FIELDS = [
  'phone', 'email', 'address', 'city', 'state', 'zip',
  'dob', 'spouse_name', 'spouse_dob', 'spouse_phone',
] as const

type BackfillField = typeof BACKFILL_FIELDS[number]

/**
 * POST /api/import/backfill-clients
 * Scan clients with missing fields and attempt enrichment from account data.
 * Body: {
 *   fields?: string[],         // Which fields to backfill (default: all)
 *   limit?: number,            // Max clients to process (default: 500)
 *   dry_run?: boolean,         // Preview only
 *   client_ids?: string[],     // Specific clients (optional)
 * }
 * Returns: { scanned, enriched, fields_filled, skipped, errors }
 */
importRoutes.post('/backfill-clients', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const {
      fields: rawFields,
      limit: rawLimit,
      dry_run: dryRun = false,
      client_ids: clientIds,
    } = req.body as {
      fields?: string[]
      limit?: number
      dry_run?: boolean
      client_ids?: string[]
    }

    // Validate and filter fields
    const targetFields: BackfillField[] = rawFields
      ? rawFields.filter((f): f is BackfillField =>
          (BACKFILL_FIELDS as readonly string[]).includes(f)
        )
      : [...BACKFILL_FIELDS]

    if (targetFields.length === 0) {
      res.status(400).json(errorResponse(
        `No valid fields specified. Valid fields: ${BACKFILL_FIELDS.join(', ')}`
      ))
      return
    }

    const limit = Math.min(Math.max(rawLimit || 500, 1), 2000)

    const importRunId = await startImportRun({
      wire_id: 'WIRE_CLIENT_ENRICHMENT',
      import_type: 'backfill_clients',
      source: 'BACKFILL',
      total_records: clientIds?.length || limit,
      triggered_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    })

    // Query clients — specific IDs or up to limit
    let clientDocs: FirebaseFirestore.QueryDocumentSnapshot[]

    if (clientIds && clientIds.length > 0) {
      // Fetch specific clients in batches of 30 (Firestore 'in' limit)
      clientDocs = []
      for (let i = 0; i < clientIds.length; i += 30) {
        const batch = clientIds.slice(i, i + 30)
        const snap = await db.collection('clients')
          .where('__name__', 'in', batch)
          .get()
        clientDocs.push(...snap.docs)
      }
    } else {
      const snap = await db.collection('clients')
        .limit(limit)
        .get()
      clientDocs = [...snap.docs]
    }

    const summary = {
      scanned: clientDocs.length,
      enriched: 0,
      fields_filled: {} as Record<string, number>,
      skipped: 0,
      errors: 0,
      error_details: [] as Array<{ client_id: string; error: string }>,
      dry_run: dryRun,
    }

    // Initialize field counters
    for (const f of targetFields) {
      summary.fields_filled[f] = 0
    }

    for (const clientDoc of clientDocs) {
      try {
        const clientData = clientDoc.data()
        const clientId = clientDoc.id

        // Determine which target fields are missing on this client
        const missingFields = targetFields.filter(f => {
          const val = clientData[f]
          return val == null || val === ''
        })

        if (missingFields.length === 0) {
          summary.skipped++
          continue
        }

        // Gather values from client's accounts subcollection
        const filledValues: Record<string, unknown> = {}

        const acctSnap = await db.collection('clients').doc(clientId).collection('accounts')
          .limit(20)
          .get()

        for (const acctDoc of acctSnap.docs) {
          if (missingFields.length === Object.keys(filledValues).length) break

          const acctData = acctDoc.data()

          for (const field of missingFields) {
            if (filledValues[field]) continue // Already found a value

            const acctVal = acctData[field]
            if (acctVal != null && acctVal !== '') {
              filledValues[field] = acctVal
            }
          }
        }

        if (Object.keys(filledValues).length === 0) {
          summary.skipped++
          continue
        }

        // Write enriched fields
        if (!dryRun) {
          const updatePayload: Record<string, unknown> = {
            ...filledValues,
            _backfill_source: 'account_enrichment',
            _backfill_at: new Date().toISOString(),
          }

          const bridgeResult = await writeThroughBridge('clients', 'update', clientId, updatePayload)

          if (!bridgeResult.success) {
            // Fallback to direct Firestore write
            await db.collection('clients').doc(clientId).update(updatePayload)
          }
        }

        summary.enriched++
        for (const field of Object.keys(filledValues)) {
          summary.fields_filled[field] = (summary.fields_filled[field] || 0) + 1
        }
      } catch (clientErr) {
        summary.errors++
        if (summary.error_details.length < 50) {
          summary.error_details.push({
            client_id: clientDoc.id,
            error: String(clientErr),
          })
        }
      }
    }

    await completeImportRun(importRunId, {
      imported: summary.enriched,
      skipped: summary.skipped,
      duplicates: 0,
      errors: summary.errors,
      error_details: summary.error_details.map((e, i) => ({ index: i, error: `${e.client_id}: ${e.error}` })),
    })

    res.json(successResponse<ImportBackfillClientsResult>({ ...summary, import_run_id: importRunId } as unknown as ImportBackfillClientsResult))
  } catch (err) {
    console.error('POST /api/import/backfill-clients error:', err)
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

    res.json(successResponse<ImportQueueStatusData>({ by_status: byStatus, by_source: bySource, total: snap.size } as unknown as ImportQueueStatusData))
  } catch (err) {
    console.error('GET /api/import/queue/status error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
