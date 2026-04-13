// ---------------------------------------------------------------------------
// Approval Engine API Routes
// Implements the 5-stage pipeline: FLATTEN → BATCH → NOTIFY → APPROVE → EXECUTE
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getDb } from '../lib/db.js'
import {
  createBatch,
  validateBatch,
  buildSummary,
  updateItemStatus,
  bulkUpdateItems,
  buildExecutionPayload,
  finalizeBatch,
  extractTrainingData,
  determineBatchStatus,
  determineReviewer,
  determineTargetCollection,
  getCanonicalCategory,
  type ExtractedData,
  type ExtractionContext,
  type ApprovalItem,
  type ApprovalBatch,
  type ExecutionResult,
  type BatchStatus,
} from '@tomachina/core'
import {
  successResponse,
  errorResponse,
  validateRequired,
  param,
  writeThroughBridge,
  getPaginationParams,
} from '../lib/helpers.js'
import type {
  ApprovalBatchCreateResult,
  ApprovalNotifyResult,
  ApprovalItemDTO,
  ApprovalBulkUpdateResult,
  ApprovalExecuteResult,
  ApprovalBatchListItem,
  ApprovalBatchDetailDTO,
  ApprovalStatsData,
  ApprovalTrainingDTO,
} from '@tomachina/core'
import { resumeWireAfterApproval } from './wire.js'
import { resolveDeepLinks } from '../lib/deep-links.js'

export const approvalRoutes = Router()

const BATCHES_COLLECTION = 'approval_batches'
const TRAINING_COLLECTION = 'approval_training'

// ─── STAGE 2: CREATE BATCH ─────────────────────────────────────────────────

/**
 * POST /api/approval/batches
 * Creates a new approval batch from extracted data.
 * Flattens, batches, and persists to Firestore.
 */
approvalRoutes.post('/batches', async (req: Request, res: Response) => {
  try {
    const body = req.body as { data: ExtractedData; context: ExtractionContext }
    const err = validateRequired(body, ['data', 'context'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const ctxErr = validateRequired(body.context as unknown as Record<string, unknown>, ['source_type', 'source_id'])
    if (ctxErr) { res.status(400).json(errorResponse(ctxErr)); return }

    // Validate extractable data exists
    const validationError = validateBatch(body.data, body.context)
    if (validationError) { res.status(400).json(errorResponse(validationError)); return }

    const db = getDb(req.partnerId)
    const batchId = db.collection(BATCHES_COLLECTION).doc().id

    // Create batch (pure function)
    const batch = createBatch(body.data, body.context, batchId)

    // Determine reviewer from org data
    const orgSnap = await db.collection('org').get()
    const orgData = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const tabs = new Set(batch.items.map((i) => i.target_tab))
    const routing = determineReviewer(tabs, orgData)

    batch.assigned_to = routing.reviewer_email
    batch.slack_channel = routing.slack_channel

    // Store original proposed values for training data (before any edits)
    const originalValues: Record<string, string> = {}
    for (const item of batch.items) {
      originalValues[item.approval_id] = item.proposed_value
    }

    // Persist to Firestore
    await db.collection(BATCHES_COLLECTION).doc(batchId).set({
      ...batch,
      _original_values: originalValues,
    })

    res.status(201).json(successResponse<ApprovalBatchCreateResult>({
      batch_id: batchId,
      approval_count: batch.items.length,
      summary: batch.summary,
      assigned_to: batch.assigned_to,
      routing,
    } as unknown as ApprovalBatchCreateResult))
  } catch (err) {
    console.error('POST /api/approval/batches error:', err)
    res.status(500).json(errorResponse('Failed to create approval batch'))
  }
})

// ─── STAGE 3: NOTIFY ────────────────────────────────────────────────────────

/**
 * POST /api/approval/batches/:id/notify
 * Sends a Slack notification to the assigned reviewer.
 * PHI-free: only entity name, field counts, tab names.
 */
approvalRoutes.post('/batches/:id/notify', async (req: Request, res: Response) => {
  try {
    const batchId = param(req.params.id)
    const db = getDb(req.partnerId)
    const batchDoc = await db.collection(BATCHES_COLLECTION).doc(batchId).get()

    if (!batchDoc.exists) {
      res.status(404).json(errorResponse('Batch not found'))
      return
    }

    const batch = batchDoc.data() as ApprovalBatch
    const slackToken = process.env.SLACK_BOT_TOKEN

    if (!slackToken) {
      res.status(500).json(errorResponse('Slack bot token not configured'))
      return
    }

    // Build PHI-free notification
    const tabBreakdown = Object.entries(batch.summary.by_tab)
      .map(([tab, count]) => `${tab.replace('_', '').replace(/_/g, ' ')}: ${count}`)
      .join('  |  ')

    // Resolve client + household + account deep-links
    const deepLinks = await resolveDeepLinks(db, batch)

    const prodashUrl = process.env.PRODASH_URL || 'https://prodash.tomachina.com'
    const blocks: Record<string, unknown>[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Data Review Needed', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Client:*\n${batch.entity_name || 'Unknown'}` },
          { type: 'mrkdwn', text: `*Source:*\n${batch.source_type}` },
          { type: 'mrkdwn', text: `*Fields:*\n${batch.items.length} writes` },
          { type: 'mrkdwn', text: `*Routing:*\n${tabBreakdown}` },
        ],
      },
    ]

    // Add deep-links context line (only shows links we actually resolved)
    if (deepLinks.lines.length > 0) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: deepLinks.lines.join('   ·   ') }],
      })
    }

    // Primary action buttons — Review Now always present, optional Client/ACF/Account jump buttons
    const actionElements: Record<string, unknown>[] = [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Review Now', emoji: true },
        url: `${prodashUrl}/approval?batch_id=${batchId}`,
        style: 'primary',
      },
    ]
    if (deepLinks.clientUrl) {
      actionElements.push({
        type: 'button',
        text: { type: 'plain_text', text: '👤 Client Page', emoji: true },
        url: deepLinks.clientUrl,
      })
    }
    if (deepLinks.acfFolderUrl) {
      actionElements.push({
        type: 'button',
        text: { type: 'plain_text', text: '📁 ACF Folder', emoji: true },
        url: deepLinks.acfFolderUrl,
      })
    }
    for (const acct of deepLinks.accounts) {
      actionElements.push({
        type: 'button',
        text: { type: 'plain_text', text: `💼 ${acct.label}`, emoji: true },
        url: acct.url,
      })
    }
    blocks.push({ type: 'actions', elements: actionElements })
    blocks.push({ type: 'divider' })

    const channel = batch.slack_channel || batch.assigned_to || 'C0AH592RNQK'

    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackToken}`,
      },
      body: JSON.stringify({ channel, blocks }),
    })

    const slackData = await slackRes.json() as { ok: boolean; ts?: string; channel?: string; error?: string }

    if (slackData.ok) {
      // Store Slack message info for later deletion
      await db.collection(BATCHES_COLLECTION).doc(batchId).update({
        slack_message_ts: slackData.ts || '',
        slack_channel: slackData.channel || channel,
        status: 'IN_REVIEW',
        updated_at: new Date().toISOString(),
      })
      res.json(successResponse<ApprovalNotifyResult>({ ts: slackData.ts, channel: slackData.channel } as unknown as ApprovalNotifyResult))
    } else {
      res.status(500).json(errorResponse(`Slack notification failed: ${slackData.error}`))
    }
  } catch (err) {
    console.error('POST /api/approval/batches/:id/notify error:', err)
    res.status(500).json(errorResponse('Failed to send notification'))
  }
})

// ─── STAGE 4: APPROVE ───────────────────────────────────────────────────────

/**
 * PATCH /api/approval/batches/:id/items/:itemId
 * Update a single approval item (approve, edit, kill).
 */
approvalRoutes.patch('/batches/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const batchId = param(req.params.id)
    const itemId = param(req.params.itemId)
    const { status, edited_value, new_field } = req.body as {
      status: 'APPROVED' | 'EDITED' | 'KILLED'
      edited_value?: string
      new_field?: string
    }

    if (!['APPROVED', 'EDITED', 'KILLED'].includes(status)) {
      res.status(400).json(errorResponse('Invalid status. Must be APPROVED, EDITED, or KILLED'))
      return
    }

    const decidedBy = ((req as any).user?.email as string) || 'unknown'

    const db = getDb(req.partnerId)
    const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId)
    const batchDoc = await batchRef.get()

    if (!batchDoc.exists) {
      res.status(404).json(errorResponse('Batch not found'))
      return
    }

    const batch = batchDoc.data() as ApprovalBatch
    const itemIndex = batch.items.findIndex((i) => i.approval_id === itemId)

    if (itemIndex === -1) {
      res.status(404).json(errorResponse('Item not found in batch'))
      return
    }

    // Update the item
    const updatedItem = updateItemStatus(
      batch.items[itemIndex],
      status,
      decidedBy,
      edited_value,
      new_field
    )

    batch.items[itemIndex] = updatedItem
    batch.summary = buildSummary(batch.items, batch.entity_name)
    batch.updated_at = new Date().toISOString()

    await batchRef.update({
      items: batch.items,
      summary: batch.summary,
      updated_at: batch.updated_at,
    })

    // TRK-526: Record correction to learning library so SUPER_EXTRACT gets smarter
    if (status === 'KILLED' || status === 'EDITED') {
      try {
        const originalItem = batch.items[itemIndex]
        const learningType = status === 'KILLED' ? 'FIELD_KILL' : 'VALUE_CORRECT'
        await db.collection('learning_library').add({
          document_type: batch.source_type || '',
          learning_type: learningType,
          target_field: originalItem.display_label || originalItem.display_category || '',
          original_value: originalItem.current_value || originalItem.proposed_value || '',
          corrected_value: status === 'EDITED' ? (edited_value || '') : '',
          corrected_by: decidedBy,
          wire_execution_id: (batch as unknown as Record<string, unknown>).wire_execution_id || '',
          source_file_id: (batch as unknown as Record<string, unknown>).source_file_id || '',
          created_at: new Date().toISOString(),
        })
      } catch {
        // Non-blocking — learning write failure doesn't invalidate the approval
      }
    }

    res.json(successResponse<ApprovalItemDTO>(updatedItem as unknown as ApprovalItemDTO))
  } catch (err) {
    console.error('PATCH /api/approval/batches/:id/items/:itemId error:', err)
    res.status(500).json(errorResponse('Failed to update item'))
  }
})

/**
 * PATCH /api/approval/batches/:id/bulk
 * Bulk update all PENDING items in a batch.
 */
approvalRoutes.patch('/batches/:id/bulk', async (req: Request, res: Response) => {
  try {
    const batchId = param(req.params.id)
    const { status, exclude_ids } = req.body as {
      status: 'APPROVED' | 'KILLED'
      exclude_ids?: string[]
    }

    if (!['APPROVED', 'KILLED'].includes(status)) {
      res.status(400).json(errorResponse('Bulk status must be APPROVED or KILLED'))
      return
    }

    const decidedBy = ((req as any).user?.email as string) || 'unknown'

    const db = getDb(req.partnerId)
    const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId)
    const batchDoc = await batchRef.get()

    if (!batchDoc.exists) {
      res.status(404).json(errorResponse('Batch not found'))
      return
    }

    const batch = batchDoc.data() as ApprovalBatch
    const excludeSet = new Set(exclude_ids || [])
    const updatedItems = bulkUpdateItems(batch.items, status, decidedBy, excludeSet)

    const summary = buildSummary(updatedItems, batch.entity_name)
    const now = new Date().toISOString()

    await batchRef.update({
      items: updatedItems,
      summary,
      updated_at: now,
    })

    res.json(successResponse<ApprovalBulkUpdateResult>({
      updated: updatedItems.filter((i) => i.decided_at === now).length,
      summary,
    } as unknown as ApprovalBulkUpdateResult))
  } catch (err) {
    console.error('PATCH /api/approval/batches/:id/bulk error:', err)
    res.status(500).json(errorResponse('Failed to bulk update'))
  }
})

// ─── STAGE 5: EXECUTE ───────────────────────────────────────────────────────

/**
 * POST /api/approval/batches/:id/execute
 * Execute all approved/edited items — write to Firestore.
 */
approvalRoutes.post('/batches/:id/execute', async (req: Request, res: Response) => {
  try {
    const batchId = param(req.params.id)
    const db = getDb(req.partnerId)
    const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId)
    const batchDoc = await batchRef.get()

    if (!batchDoc.exists) {
      res.status(404).json(errorResponse('Batch not found'))
      return
    }

    const batch = batchDoc.data() as ApprovalBatch
    const executorEmail = ((req as any).user?.email as string) || 'unknown'

    // Build execution payload (groups items by target_tab + entity_id)
    const groups = buildExecutionPayload(batch.items)

    if (groups.length === 0) {
      res.status(400).json(errorResponse('No approved items to execute'))
      return
    }

    const results: ExecutionResult[] = []
    const clientIdMap = new Map<string, string>() // entity_name → created client_id

    for (const group of groups) {
      const now = new Date().toISOString()

      try {
        if (group.target_tab === '_CLIENT_MASTER') {
          // --- Client write ---
          if (group.is_create) {
            const clientData = { ...group.fields, created_at: now, updated_at: now, import_source: 'approval_engine' }
            const bridgeResult = await writeThroughBridge('clients', 'insert', '', clientData)

            let docId: string
            if (bridgeResult.success) {
              docId = (bridgeResult as Record<string, unknown>).id as string || db.collection('clients').doc().id
            } else {
              // Direct Firestore fallback
              const docRef = await db.collection('clients').add(clientData)
              docId = docRef.id
            }

            // Store mapping for account creates
            const entityName = [group.fields.first_name, group.fields.last_name].filter(Boolean).join(' ')
            clientIdMap.set(entityName, docId)

            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: docId, status: 'success', created_id: docId })
            }
          } else {
            // Client update
            const clientRef = db.collection('clients').doc(group.entity_id)
            await clientRef.update({ ...group.fields, updated_at: now })
            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: group.entity_id, status: 'success' })
            }
          }
        } else if (group.target_tab.startsWith('_ACCOUNT_')) {
          // --- Account write ---
          // Find client_id: from entity_id matching, or from client creates in this batch
          let clientId = ''
          const entityName = group.items[0]?.entity_name || ''
          if (group.entity_id) {
            // Existing account → entity_id is the account id, find its parent client
            clientId = String(group.items[0]?.entity_id || '') // Simplified — in production would trace parent
          }
          if (!clientId) {
            // Look in clientIdMap from creates in this batch
            clientId = clientIdMap.values().next().value || ''
          }

          if (group.is_create && clientId) {
            const acctData: Record<string, string> = { ...group.fields, client_id: clientId, created_at: now, updated_at: now }
            const category = getCanonicalCategory(group.target_tab)
            if (category) acctData.account_type_category = category

            const bridgeResult = await writeThroughBridge(`clients/${clientId}/accounts`, 'insert', '', acctData)
            let acctId: string
            if (bridgeResult.success) {
              acctId = (bridgeResult as Record<string, unknown>).id as string || ''
            } else {
              const acctRef = await db.collection('clients').doc(clientId).collection('accounts').add(acctData)
              acctId = acctRef.id
            }

            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: acctId, status: 'success', created_id: acctId })
            }
          } else if (!group.is_create && group.entity_id && clientId) {
            // Account update
            await db.collection('clients').doc(clientId).collection('accounts').doc(group.entity_id).update({ ...group.fields, updated_at: now })
            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: group.entity_id, status: 'success' })
            }
          } else {
            // Cannot determine client_id
            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: '', status: 'error', error_message: 'Cannot resolve client_id for account write' })
            }
          }
        } else if (group.target_tab === '_PRODUCER_MASTER' || group.target_tab === '_AGENT_MASTER') {
          // --- Agent/Producer write ---
          if (group.is_create) {
            const agentData = { ...group.fields, created_at: now, updated_at: now }
            const agentRef = await db.collection('agents').add(agentData)
            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: agentRef.id, status: 'success', created_id: agentRef.id })
            }
          } else {
            await db.collection('agents').doc(group.entity_id).update({ ...group.fields, updated_at: now })
            for (const item of group.items) {
              results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: group.entity_id, status: 'success' })
            }
          }
        } else if (group.target_tab === '_REVENUE_MASTER') {
          // --- Revenue write ---
          const revData = { ...group.fields, created_at: now, updated_at: now }
          const revRef = await db.collection('revenue').add(revData)
          for (const item of group.items) {
            results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: revRef.id, status: 'success', created_id: revRef.id })
          }
        }
      } catch (groupErr) {
        for (const item of group.items) {
          results.push({ approval_id: item.approval_id, target_tab: item.target_tab, target_field: item.target_field, entity_id: group.entity_id, status: 'error', error_message: String(groupErr) })
        }
      }
    }

    // Finalize batch
    const finalizedBatch = finalizeBatch(batch, results)

    // Capture training data from EDITED items
    const originalValues = (batchDoc.data() as Record<string, unknown>)?._original_values as Record<string, string> || {}
    const trainingRecords = extractTrainingData(finalizedBatch, executorEmail)

    // Enrich training records with original values
    for (const tr of trainingRecords) {
      tr.original_value = originalValues[tr.approval_id] || ''
    }

    // Persist results
    await batchRef.update({
      items: finalizedBatch.items,
      status: finalizedBatch.status,
      summary: finalizedBatch.summary,
      execution_results: results,
      executed_at: finalizedBatch.executed_at,
      updated_at: finalizedBatch.updated_at,
    })

    // Write training data
    if (trainingRecords.length > 0) {
      const trainingBatch = db.batch()
      for (const tr of trainingRecords) {
        trainingBatch.set(db.collection(TRAINING_COLLECTION).doc(tr.training_id), tr)
      }
      await trainingBatch.commit()
    }

    // Delete Slack notification (cleanup)
    if (finalizedBatch.slack_message_ts && finalizedBatch.slack_channel) {
      try {
        const slackToken = process.env.SLACK_BOT_TOKEN
        if (slackToken) {
          await fetch('https://slack.com/api/chat.delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${slackToken}` },
            body: JSON.stringify({ channel: finalizedBatch.slack_channel, ts: finalizedBatch.slack_message_ts }),
          })
        }
      } catch {
        // Non-critical — Slack message deletion is best-effort
      }
    }

    // Log activity for each created/updated client
    for (const result of results) {
      if (result.status === 'success' && result.target_tab === '_CLIENT_MASTER' && result.entity_id) {
        try {
          await db.collection('clients').doc(result.entity_id).collection('activities').add({
            activity_type: result.created_id ? 'client_created' : 'client_updated',
            description: `Approval batch ${batchId} executed (${batch.source_type})`,
            performed_by: executorEmail,
            created_at: new Date().toISOString(),
          })
        } catch {
          // Non-critical
        }
      }
    }

    // If this batch is part of a wire execution, resume the wire (SUPER_WRITE → ACF → notify)
    const wireExecutionId = (batch as unknown as Record<string, unknown>).wire_execution_id as string | undefined
    if (wireExecutionId && results.some((r) => r.status === 'success')) {
      try {
        await resumeWireAfterApproval(wireExecutionId, executorEmail)
      } catch {
        // Non-critical — wire resume failure doesn't invalidate the batch execution
        console.warn(`[approval] Wire resume failed for execution ${wireExecutionId}`)
      }
    }

    res.json(successResponse<ApprovalExecuteResult>({
      batch_id: batchId,
      status: finalizedBatch.status,
      executed: results.filter((r) => r.status === 'success').length,
      errors: results.filter((r) => r.status === 'error').length,
      training_captured: trainingRecords.length,
      wire_resumed: !!wireExecutionId,
      results,
    } as unknown as ApprovalExecuteResult))
  } catch (err) {
    console.error('POST /api/approval/batches/:id/execute error:', err)
    res.status(500).json(errorResponse('Failed to execute batch'))
  }
})

// ─── DASHBOARD / READ ROUTES ────────────────────────────────────────────────

/**
 * GET /api/approval/batches
 * List batches with filters (status, assigned_to, date range, entity_type).
 */
approvalRoutes.get('/batches', async (req: Request, res: Response) => {
  try {
    const db = getDb(req.partnerId)
    let query: FirebaseFirestore.Query = db.collection(BATCHES_COLLECTION)

    // Filters
    const status = req.query.status as string
    if (status) query = query.where('status', '==', status)

    const assignedTo = req.query.assigned_to as string
    if (assignedTo) query = query.where('assigned_to', '==', assignedTo)

    const sourceType = req.query.source_type as string
    if (sourceType) query = query.where('source_type', '==', sourceType)

    // Ordering + pagination
    query = query.orderBy('created_at', 'desc')

    const limitVal = Math.min(parseInt(req.query.limit as string) || 25, 100)
    query = query.limit(limitVal)

    const snap = await query.get()
    const batches = snap.docs.map((d) => {
      const data = d.data()
      // Strip items for list view (too large — use detail endpoint)
      return {
        batch_id: d.id,
        source_type: data.source_type,
        entity_name: data.entity_name,
        status: data.status,
        assigned_to: data.assigned_to,
        summary: data.summary,
        created_at: data.created_at,
        updated_at: data.updated_at,
        executed_at: data.executed_at,
        item_count: Array.isArray(data.items) ? data.items.length : 0,
      }
    })

    res.json(successResponse<ApprovalBatchListItem[]>(batches as unknown as ApprovalBatchListItem[], { pagination: { count: batches.length, total: batches.length } }))
  } catch (err) {
    console.error('GET /api/approval/batches error:', err)
    res.status(500).json(errorResponse('Failed to list batches'))
  }
})

/**
 * GET /api/approval/batches/:id
 * Get batch detail with all items.
 */
approvalRoutes.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const batchId = param(req.params.id)
    const db = getDb(req.partnerId)
    const doc = await db.collection(BATCHES_COLLECTION).doc(batchId).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Batch not found'))
      return
    }

    const data = doc.data() as ApprovalBatch
    // Strip internal fields
    const { ...rest } = data
    delete (rest as Record<string, unknown>)._original_values

    res.json(successResponse<ApprovalBatchDetailDTO>(rest as unknown as ApprovalBatchDetailDTO))
  } catch (err) {
    console.error('GET /api/approval/batches/:id error:', err)
    res.status(500).json(errorResponse('Failed to get batch'))
  }
})

/**
 * GET /api/approval/stats
 * Dashboard statistics: pending count, completed today, avg approval time.
 */
approvalRoutes.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDb(req.partnerId)

    // Get counts by status
    const allSnap = await db.collection(BATCHES_COLLECTION).select('status', 'created_at', 'executed_at').get()

    let pending = 0
    let inReview = 0
    let executed = 0
    let partial = 0
    let errored = 0
    let completedToday = 0
    let totalApprovalTimeMs = 0
    let completedCount = 0

    const today = new Date().toISOString().split('T')[0]

    for (const doc of allSnap.docs) {
      const d = doc.data()
      switch (d.status) {
        case 'PENDING': pending++; break
        case 'IN_REVIEW': inReview++; break
        case 'EXECUTED': executed++; break
        case 'PARTIAL': partial++; break
        case 'ERROR': errored++; break
      }

      if (d.executed_at && String(d.executed_at).startsWith(today)) {
        completedToday++
      }

      if (d.executed_at && d.created_at) {
        const created = new Date(d.created_at).getTime()
        const executedAt = new Date(d.executed_at).getTime()
        if (!isNaN(created) && !isNaN(executedAt)) {
          totalApprovalTimeMs += (executedAt - created)
          completedCount++
        }
      }
    }

    const avgApprovalMinutes = completedCount > 0
      ? Math.round(totalApprovalTimeMs / completedCount / 60000)
      : 0

    res.json(successResponse<ApprovalStatsData>({
      total: allSnap.size,
      pending,
      in_review: inReview,
      executed,
      partial,
      error: errored,
      completed_today: completedToday,
      avg_approval_minutes: avgApprovalMinutes,
    } as unknown as ApprovalStatsData))
  } catch (err) {
    console.error('GET /api/approval/stats error:', err)
    res.status(500).json(errorResponse('Failed to get stats'))
  }
})

/**
 * GET /api/approval/training
 * List training records for extraction improvement analysis.
 */
approvalRoutes.get('/training', async (req: Request, res: Response) => {
  try {
    const db = getDb(req.partnerId)
    const limitVal = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const snap = await db.collection(TRAINING_COLLECTION)
      .orderBy('created_at', 'desc')
      .limit(limitVal)
      .get()

    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    res.json(successResponse<ApprovalTrainingDTO[]>(records as unknown as ApprovalTrainingDTO[], { pagination: { count: records.length, total: records.length } }))
  } catch (err) {
    console.error('GET /api/approval/training error:', err)
    res.status(500).json(errorResponse('Failed to get training data'))
  }
})
