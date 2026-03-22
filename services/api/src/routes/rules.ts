import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
} from '../lib/helpers.js'

export const rulesRoutes = Router()
const COLLECTION = 'automation_rules'

// ============================================================================
// LIST RULES
// ============================================================================

/**
 * GET /api/rules
 * List automation rules, optionally filtered by status
 */
rulesRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)

    if (req.query.status) {
      query = query.where('status', '==', req.query.status)
    }

    if (req.query.enabled === 'true') {
      query = query.where('enabled', '==', true)
    }

    const snap = await query.get()
    const rules = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    res.json(successResponse(rules, { pagination: { count: rules.length, total: rules.length } }))
  } catch (err) {
    console.error('GET /api/rules error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET RULE
// ============================================================================

/**
 * GET /api/rules/:id
 * Get a specific automation rule
 */
rulesRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = req.params.id as string
    const doc = await db.collection(COLLECTION).doc(id).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Rule not found'))
      return
    }

    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/rules/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// EVALUATE RULES
// ============================================================================

/**
 * POST /api/rules/evaluate
 * Evaluate all enabled time-based rules (called by Cloud Scheduler)
 */
rulesRoutes.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()

    const rulesSnap = await db
      .collection(COLLECTION)
      .where('enabled', '==', true)
      .where('status', '==', 'active')
      .where('trigger_type', '==', 'time_based')
      .get()

    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()

    let fired = 0
    let skipped = 0

    for (const doc of rulesSnap.docs) {
      const rule = doc.data()

      let condition: Record<string, unknown> = {}
      try {
        condition = typeof rule.trigger_condition === 'string'
          ? JSON.parse(rule.trigger_condition)
          : (rule.trigger_condition || {})
      } catch {
        skipped++
        continue
      }

      // Check if rule should fire now
      let shouldFire = false
      if (condition.schedule === 'hourly') {
        shouldFire = true
      } else if (condition.schedule === 'daily' && condition.hour !== undefined) {
        shouldFire = currentHour === Number(condition.hour)
      } else if (condition.schedule === 'weekly' && condition.day !== undefined && condition.hour !== undefined) {
        shouldFire = currentDay === Number(condition.day) && currentHour === Number(condition.hour)
      }

      if (!shouldFire) {
        skipped++
        continue
      }

      // Execute action
      let actionConfig: Record<string, unknown> = {}
      try {
        actionConfig = typeof rule.action_config === 'string'
          ? JSON.parse(rule.action_config)
          : (rule.action_config || {})
      } catch {
        skipped++
        continue
      }

      try {
        await executeRuleAction(db, rule.action_type, actionConfig)

        await doc.ref.update({
          last_fired_at: now.toISOString(),
          fire_count: (Number(rule.fire_count) || 0) + 1,
          updated_at: now.toISOString(),
        })

        fired++
      } catch (_actionErr) {
        skipped++
      }
    }

    res.json(successResponse({
      evaluated: rulesSnap.size,
      fired,
      skipped,
    }))
  } catch (err) {
    console.error('POST /api/rules/evaluate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CREATE/UPDATE RULE
// ============================================================================

/**
 * POST /api/rules
 * Create a new automation rule
 */
rulesRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { rule_name, trigger_type, trigger_condition, action_type, action_config } = req.body

    if (!rule_name || !trigger_type || !action_type) {
      res.status(400).json(errorResponse('rule_name, trigger_type, and action_type are required'))
      return
    }

    const ruleId = db.collection(COLLECTION).doc().id
    const now = new Date().toISOString()

    const ruleData = {
      rule_id: ruleId,
      rule_name,
      trigger_type,
      trigger_condition: trigger_condition || {},
      action_type,
      action_config: action_config || {},
      enabled: true,
      status: 'active',
      fire_count: 0,
      last_fired_at: null,
      _created_by: (req as any).user?.email || 'api',
      created_at: now,
      updated_at: now,
    }

    await db.collection(COLLECTION).doc(ruleId).set(ruleData)
    await writeThroughBridge(COLLECTION, 'insert', ruleId, ruleData)

    res.status(201).json(successResponse(ruleData))
  } catch (err) {
    console.error('POST /api/rules error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/rules/:id
 * Update an automation rule
 */
rulesRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = req.params.id as string
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Rule not found'))
      return
    }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
    }
    delete updates.rule_id
    delete updates.created_at

    await docRef.update(updates)
    await writeThroughBridge(COLLECTION, 'update', id, updates)

    const updated = await docRef.get()
    res.json(successResponse({ id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('PATCH /api/rules/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// HELPERS
// ============================================================================

async function executeRuleAction(
  db: FirebaseFirestore.Firestore,
  actionType: string,
  config: Record<string, unknown>
) {
  if (actionType === 'send_notification') {
    // Store notification in Firestore for pickup by notification service
    await db.collection('rule_notifications').add({
      message: config.message || 'Automation rule fired',
      config,
      created_at: new Date().toISOString(),
    })
  } else if (actionType === 'create_task') {
    const { randomUUID: uuid } = await import('crypto')
    await db.collection('action_items').add({
      item_id: uuid(),
      title: (config.title as string) || 'Auto-created task',
      description: (config.description as string) || '',
      owner_email: (config.assigned_to as string) || '',
      priority: (config.priority as string) || 'medium',
      status: 'open',
      source: 'rules_engine',
      created_at: new Date().toISOString(),
    })
  }
  // campaign enrollment is handled by campaign-send routes
}
