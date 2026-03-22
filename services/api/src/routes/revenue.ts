import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import { createHash, randomUUID } from 'crypto'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  validateRequired,
  writeThroughBridge,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const revenueRoutes = Router()
const COLLECTION = 'revenue'

revenueRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)
    if (req.query.account_id) query = query.where('account_id', '==', req.query.account_id)
    if (req.query.type) query = query.where('revenue_type', '==', req.query.type)
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const result = await paginatedQuery(query, COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.get('/summary/by-agent', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const snap = await query.get()
    const byAgent: Record<string, { total: number; count: number; agent_id: string }> = {}

    snap.docs.forEach(doc => {
      const d = doc.data()
      const agentId = String(d.agent_id || 'unknown')
      if (!byAgent[agentId]) byAgent[agentId] = { total: 0, count: 0, agent_id: agentId }
      byAgent[agentId].total += parseFloat(String(d.amount)) || 0
      byAgent[agentId].count += 1
    })

    const summary = Object.values(byAgent).sort((a, b) => b.total - a.total)
    res.json(successResponse(summary, { pagination: { count: summary.length, total: summary.length } }))
  } catch (err) {
    console.error('GET /api/revenue/summary/by-agent error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Revenue record not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/revenue/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['account_id', 'amount', 'revenue_type'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const revenueId = req.body.revenue_id || db.collection(COLLECTION).doc().id
    const data = { ...req.body, revenue_id: revenueId, amount: parseFloat(req.body.amount) || 0, created_at: req.body.created_at || now, updated_at: now, _created_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api' }

    const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', revenueId, data)
    if (!bridgeResult.success) await db.collection(COLLECTION).doc(revenueId).set(data)

    res.status(201).json(successResponse({ id: revenueId, ...data }))
  } catch (err) {
    console.error('POST /api/revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

revenueRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Revenue record not found')); return }

    const updates: Record<string, unknown> = { ...req.body, updated_at: new Date().toISOString(), _updated_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api' }
    if (updates.amount != null) updates.amount = parseFloat(String(updates.amount)) || 0
    delete updates.revenue_id; delete updates.id; delete updates.created_at

    const bridgeResult = await writeThroughBridge(COLLECTION, 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/revenue/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// BULK REVENUE IMPORT
// ============================================================================

/**
 * POST /api/revenue/bulk
 * Bulk revenue import with validation, dedup by stateable_id, and auto-linking.
 * Auto-links agents via NPN and accounts via policy_number.
 * Writes via writeThroughBridge with Firestore fallback.
 */
revenueRoutes.post('/bulk', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const records: Record<string, unknown>[] = req.body.records || []
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
      linked_agents: 0,
      linked_accounts: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    // Pre-load existing stateable_ids for dedup
    const existingIds = new Set<string>()
    const stateSnap = await db.collection(COLLECTION).select('stateable_id').get()
    for (const doc of stateSnap.docs) {
      const sid = doc.data().stateable_id
      if (sid) existingIds.add(sid)
    }

    // Pre-load agents by NPN for auto-linking
    const agentsByNpn = new Map<string, string>()
    const agentSnap = await db.collection('agents').select('npn', 'agent_id').get()
    for (const doc of agentSnap.docs) {
      const d = doc.data()
      if (d.npn) agentsByNpn.set(d.npn, d.agent_id || doc.id)
    }

    // Pre-load policy_number -> account mapping for auto-linking (avoids O(n) queries)
    const pnToAccount: Record<string, { account_id: string; client_id: string | null }> = {}
    const policyNumbers = records
      .filter((r) => r.policy_number && !r.account_id)
      .map((r) => String(r.policy_number))
    const uniquePNs = [...new Set(policyNumbers)]
    for (let i = 0; i < uniquePNs.length; i += 30) {
      const chunk = uniquePNs.slice(i, i + 30)
      if (chunk.length === 0) continue
      const snap = await db.collectionGroup('accounts')
        .where('policy_number', 'in', chunk)
        .select('policy_number')
        .get()
      for (const doc of snap.docs) {
        const pn = doc.data().policy_number
        if (pn) {
          const pathParts = doc.ref.path.split('/')
          pnToAccount[pn] = {
            account_id: doc.id,
            client_id: pathParts.length >= 2 ? pathParts[1] : null,
          }
        }
      }
    }

    // Process records
    for (let globalIdx = 0; globalIdx < records.length; globalIdx++) {
      try {
        const rec = records[globalIdx]

        // Validate minimums
        if (rec.amount == null) {
          summary.errors.push({ index: globalIdx, error: 'Missing amount' })
          continue
        }

        const amount = parseFloat(String(rec.amount))
        if (isNaN(amount)) {
          summary.errors.push({ index: globalIdx, error: `Invalid amount: ${rec.amount}` })
          continue
        }

        if (!rec.revenue_type && !rec.type) {
          summary.errors.push({ index: globalIdx, error: 'Missing revenue_type' })
          continue
        }

        // Normalize revenue_type
        const rawType = String(rec.revenue_type || rec.type || 'FYC').toUpperCase().trim()
        const revenueType = ['FYC', 'REN', 'OVR'].includes(rawType) ? rawType : 'FYC'

        // Generate or use provided stateable_id
        let stateableId = rec.stateable_id ? String(rec.stateable_id) : ''
        if (!stateableId) {
          const composite = [
            String(rec.agent_name || rec.agent_npn || '').toLowerCase().trim(),
            String(rec.policy_number || '').trim(),
            String(rec.payment_date || ''),
            String(amount),
            revenueType,
          ].join('|')
          stateableId = createHash('sha256').update(composite).digest('hex').slice(0, 32)
        }

        // Dedup
        if (existingIds.has(stateableId) && !options.force) {
          summary.duplicates++
          summary.skipped++
          continue
        }

        const revenueId = rec.revenue_id ? String(rec.revenue_id) : randomUUID()
        const revenueData: Record<string, unknown> = {
          ...rec,
          revenue_id: revenueId,
          amount,
          revenue_type: revenueType,
          stateable_id: stateableId,
          import_source: rec.import_source || options.source || 'BULK_IMPORT',
          created_at: rec.created_at || now,
          updated_at: now,
        }
        // Clean up alternate type field
        delete revenueData.type

        // Auto-link agent via NPN
        if (!revenueData.agent_id && rec.agent_npn) {
          const npn = String(rec.agent_npn).replace(/\D/g, '').slice(0, 10)
          if (npn.length >= 8 && agentsByNpn.has(npn)) {
            revenueData.agent_id = agentsByNpn.get(npn)
            summary.linked_agents++
          }
        }

        // Auto-link account via policy_number (from pre-loaded map)
        if (!revenueData.account_id && rec.policy_number) {
          const mapping = pnToAccount[String(rec.policy_number)]
          if (mapping) {
            revenueData.account_id = mapping.account_id
            if (mapping.client_id) revenueData.client_id = mapping.client_id
            summary.linked_accounts++
          }
        }

        // Write through bridge first, fall back to direct Firestore
        const bridgeResult = await writeThroughBridge(COLLECTION, 'insert', revenueId, revenueData)
        if (!bridgeResult.success) {
          await db.collection(COLLECTION).doc(revenueId).set(revenueData)
        }

        existingIds.add(stateableId)
        summary.imported++
      } catch (recErr) {
        summary.errors.push({ index: globalIdx, error: String(recErr) })
      }
    }

    // Trim errors
    if (summary.errors.length > 50) {
      summary.errors = summary.errors.slice(0, 50)
    }

    res.json(successResponse(summary))
  } catch (err) {
    console.error('POST /api/revenue/bulk error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
