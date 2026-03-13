/**
 * Flow engine routes — pipeline instance CRUD + task management.
 * Ported from RAPID_FLOW GAS library.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse, errorResponse, getPaginationParams, paginatedQuery,
  stripInternalFields, validateRequired, param, writeThroughBridge,
} from '../lib/helpers.js'

export const flowRoutes = Router()

const INSTANCES = 'flow_instances'
const TASKS = 'flow_instance_tasks'
const ACTIVITY = 'flow_activity'
const PIPELINES = 'flow_pipelines'
const STAGES = 'flow_stages'
const TASK_TEMPLATES = 'flow_task_templates'

// ============================================================================
// Pipeline config reads
// ============================================================================

/**
 * GET /api/flow/pipelines — List pipeline definitions.
 */
flowRoutes.get('/pipelines', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(PIPELINES)
    if (req.query.portal) query = query.where('portal', '==', req.query.portal)
    if (req.query.status) query = query.where('status', '==', req.query.status)

    const snap = await query.get()
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(data))
  } catch (err) {
    console.error('GET /api/flow/pipelines error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/flow/pipelines/:key — Get a single pipeline by key.
 */
flowRoutes.get('/pipelines/:key', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const pipelineKey = param(req.params.key)
    const doc = await db.collection(PIPELINES).doc(pipelineKey).get()
    if (!doc.exists) {
      return res.status(404).json(errorResponse('Pipeline not found'))
    }
    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /pipelines/:key error:', err)
    res.status(500).json(errorResponse('Failed to get pipeline'))
  }
})

/**
 * GET /api/flow/pipelines/:key/stages — Get stages for a pipeline.
 */
flowRoutes.get('/pipelines/:key/stages', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const pipelineKey = param(req.params.key)
    const snap = await db.collection(STAGES)
      .where('pipeline_key', '==', pipelineKey)
      .get()
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (Number(a.stage_order) || 0) - (Number(b.stage_order) || 0)
      )
    res.json(successResponse(data))
  } catch (err) {
    console.error('GET /api/flow/pipelines/:key/stages error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Instance CRUD
// ============================================================================

/**
 * GET /api/flow/instances — List instances with filters.
 */
flowRoutes.get('/instances', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'updated_at'

    let query: Query<DocumentData> = db.collection(INSTANCES)
    if (req.query.pipeline_key) query = query.where('pipeline_key', '==', req.query.pipeline_key)
    if (req.query.stage) query = query.where('current_stage', '==', req.query.stage)
    if (req.query.status) query = query.where('stage_status', '==', req.query.status)
    if (req.query.assigned_to) query = query.where('assigned_to', '==', req.query.assigned_to)
    if (req.query.entity_type) query = query.where('entity_type', '==', req.query.entity_type)

    const result = await paginatedQuery(query, INSTANCES, params)
    const data = result.data.map(d => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/flow/instances error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/flow/instances/:id — Get instance detail with tasks + activity.
 */
flowRoutes.get('/instances/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(INSTANCES).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Instance not found')); return }

    const instance = { id: doc.id, ...doc.data() } as Record<string, unknown>

    // Fetch tasks and recent activity
    const [tasksSnap, activitySnap] = await Promise.all([
      db.collection(TASKS).where('instance_id', '==', id).orderBy('task_order', 'asc').get(),
      db.collection(ACTIVITY).where('instance_id', '==', id).orderBy('performed_at', 'desc').limit(20).get(),
    ])

    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const activity = activitySnap.docs.map(d => ({ id: d.id, ...d.data() }))

    res.json(successResponse({ instance: stripInternalFields(instance), tasks, activity }))
  } catch (err) {
    console.error('GET /api/flow/instances/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/instances — Create a new pipeline instance.
 */
flowRoutes.post('/instances', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'entity_id', 'entity_name', 'assigned_to'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)
    const userEmail = (req as any).user?.email || 'api'

    // Fetch first stage
    const stagesSnap = await db.collection(STAGES)
      .where('pipeline_key', '==', pipelineKey)
      .orderBy('stage_order', 'asc')
      .limit(1)
      .get()

    if (stagesSnap.empty) {
      res.status(400).json(errorResponse(`No stages configured for pipeline "${pipelineKey}"`))
      return
    }

    const firstStage = stagesSnap.docs[0].data()
    const instanceId = crypto.randomUUID()
    const now = new Date().toISOString()

    const instance = {
      instance_id: instanceId,
      pipeline_key: pipelineKey,
      current_stage: String(firstStage.stage_id),
      current_step: '',
      entity_type: String(body.entity_type || 'CLIENT'),
      entity_id: String(body.entity_id),
      entity_name: String(body.entity_name),
      entity_data: body.entity_data ? JSON.stringify(body.entity_data) : '{}',
      priority: String(body.priority || 'MEDIUM'),
      assigned_to: String(body.assigned_to),
      stage_status: 'in_progress',
      workflow_progress: '{}',
      custom_fields: body.custom_fields ? JSON.stringify(body.custom_fields) : '{}',
      created_by: String(userEmail),
      created_at: now,
      updated_at: now,
    }

    // Write through bridge (falls back to direct Firestore)
    const bridgeResult = await writeThroughBridge(INSTANCES, 'insert', instanceId, instance)
    if (!bridgeResult.success) {
      await db.collection(INSTANCES).doc(instanceId).set(instance)
    }

    // Log activity
    const activityId = crypto.randomUUID()
    const activity = {
      activity_id: activityId,
      instance_id: instanceId,
      pipeline_key: pipelineKey,
      action: 'CREATE',
      from_value: '',
      to_value: String(firstStage.stage_id),
      performed_by: String(userEmail),
      performed_at: now,
      notes: '',
    }
    await db.collection(ACTIVITY).doc(activityId).set(activity)

    // Generate tasks if stage has workflow
    let tasksGenerated = 0
    if (firstStage.has_workflow) {
      tasksGenerated = await generateStageTasks(db, instanceId, pipelineKey, String(firstStage.stage_id), String(body.assigned_to))
    }

    res.status(201).json(successResponse({
      instance_id: instanceId,
      pipeline_key: pipelineKey,
      current_stage: firstStage.stage_id,
      tasks_generated: tasksGenerated,
    }))
  } catch (err) {
    console.error('POST /api/flow/instances error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/flow/instances/:id — Advance stage, revert, reassign, change priority, or complete.
 * Body: { action: 'advance' | 'complete' | 'reassign' | 'priority' | 'move', ... }
 */
flowRoutes.patch('/instances/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = req.body as Record<string, unknown>
    const action = String(body.action || '')
    const userEmail = String((req as any).user?.email || 'api')

    const doc = await db.collection(INSTANCES).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Instance not found')); return }
    const instance = doc.data() as Record<string, unknown>

    const now = new Date().toISOString()

    switch (action) {
      case 'advance': {
        // Get stages and check gate
        const stagesSnap = await db.collection(STAGES)
          .where('pipeline_key', '==', instance.pipeline_key)
          .orderBy('stage_order', 'asc')
          .get()
        const stages = stagesSnap.docs.map(d => d.data())
        const currentIdx = stages.findIndex(s => s.stage_id === instance.current_stage)

        if (currentIdx < 0 || currentIdx >= stages.length - 1) {
          res.status(400).json(errorResponse('Already at final stage — use "complete" action'))
          return
        }

        // Check gate
        const currentStage = stages[currentIdx]
        if (currentStage.gate_enforced) {
          const tasksSnap = await db.collection(TASKS)
            .where('instance_id', '==', id)
            .where('stage_id', '==', currentStage.stage_id)
            .get()
          const blockers = tasksSnap.docs
            .map(d => d.data())
            .filter(t => t.is_required && !['completed', 'skipped'].includes(t.status))

          if (blockers.length > 0) {
            res.status(400).json(errorResponse('Gate blocked — required tasks incomplete', 400))
            return
          }
        }

        const nextStage = stages[currentIdx + 1]
        const updates = {
          current_stage: nextStage.stage_id,
          current_step: '',
          workflow_progress: '{}',
          stage_status: 'in_progress',
          updated_at: now,
        }

        const bridgeResult = await writeThroughBridge(INSTANCES, 'update', id, updates)
        if (!bridgeResult.success) await db.collection(INSTANCES).doc(id).update(updates)

        // Log activity
        const actId = crypto.randomUUID()
        await db.collection(ACTIVITY).doc(actId).set({
          activity_id: actId, instance_id: id, pipeline_key: instance.pipeline_key,
          action: 'ADVANCE_STAGE', from_value: instance.current_stage, to_value: nextStage.stage_id,
          performed_by: userEmail, performed_at: now, notes: '',
        })

        // Generate tasks for new stage if it has workflow
        let tasksGenerated = 0
        if (nextStage.has_workflow) {
          tasksGenerated = await generateStageTasks(db, id, String(instance.pipeline_key), String(nextStage.stage_id), String(instance.assigned_to))
        }

        res.json(successResponse({ new_stage: nextStage.stage_id, tasks_generated: tasksGenerated }))
        return
      }

      case 'complete': {
        const updates = { stage_status: 'complete', completed_at: now, updated_at: now }
        const bridgeResult = await writeThroughBridge(INSTANCES, 'update', id, updates)
        if (!bridgeResult.success) await db.collection(INSTANCES).doc(id).update(updates)

        const actId = crypto.randomUUID()
        await db.collection(ACTIVITY).doc(actId).set({
          activity_id: actId, instance_id: id, pipeline_key: instance.pipeline_key,
          action: 'ADVANCE_STAGE', from_value: String(instance.current_stage), to_value: 'COMPLETED',
          performed_by: userEmail, performed_at: now, notes: '',
        })

        res.json(successResponse({ instance_id: id, status: 'complete' }))
        return
      }

      case 'reassign': {
        const newOwner = String(body.assigned_to || '')
        if (!newOwner) { res.status(400).json(errorResponse('assigned_to is required')); return }

        const updates = { assigned_to: newOwner, updated_at: now }
        const bridgeResult = await writeThroughBridge(INSTANCES, 'update', id, updates)
        if (!bridgeResult.success) await db.collection(INSTANCES).doc(id).update(updates)

        const actId = crypto.randomUUID()
        await db.collection(ACTIVITY).doc(actId).set({
          activity_id: actId, instance_id: id, pipeline_key: instance.pipeline_key,
          action: 'ASSIGN', from_value: String(instance.assigned_to), to_value: newOwner,
          performed_by: userEmail, performed_at: now, notes: '',
        })

        res.json(successResponse({ instance_id: id, assigned_to: newOwner }))
        return
      }

      case 'priority': {
        const newPriority = String(body.priority || '')
        if (!newPriority) { res.status(400).json(errorResponse('priority is required')); return }

        const updates = { priority: newPriority, updated_at: now }
        const bridgeResult = await writeThroughBridge(INSTANCES, 'update', id, updates)
        if (!bridgeResult.success) await db.collection(INSTANCES).doc(id).update(updates)

        const actId = crypto.randomUUID()
        await db.collection(ACTIVITY).doc(actId).set({
          activity_id: actId, instance_id: id, pipeline_key: instance.pipeline_key,
          action: 'PRIORITY_CHANGE', from_value: String(instance.priority), to_value: newPriority,
          performed_by: userEmail, performed_at: now, notes: '',
        })

        res.json(successResponse({ instance_id: id, priority: newPriority }))
        return
      }

      case 'move': {
        const targetStage = String(body.target_stage || '')
        if (!targetStage) { res.status(400).json(errorResponse('target_stage is required')); return }

        const updates = {
          current_stage: targetStage,
          current_step: '',
          workflow_progress: '{}',
          stage_status: 'in_progress',
          updated_at: now,
        }
        const bridgeResult = await writeThroughBridge(INSTANCES, 'update', id, updates)
        if (!bridgeResult.success) await db.collection(INSTANCES).doc(id).update(updates)

        const actId = crypto.randomUUID()
        await db.collection(ACTIVITY).doc(actId).set({
          activity_id: actId, instance_id: id, pipeline_key: instance.pipeline_key,
          action: 'ADVANCE_STAGE', from_value: String(instance.current_stage), to_value: targetStage,
          performed_by: userEmail, performed_at: now, notes: String(body.notes || ''),
        })

        res.json(successResponse({ instance_id: id, new_stage: targetStage }))
        return
      }

      default:
        res.status(400).json(errorResponse(`Unknown action: ${action}. Use: advance, complete, reassign, priority, move`))
    }
  } catch (err) {
    console.error('PATCH /api/flow/instances/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Task routes
// ============================================================================

/**
 * POST /api/flow/instances/:id/tasks — Generate tasks for current stage (or manual add).
 */
flowRoutes.post('/instances/:id/tasks', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const instanceId = param(req.params.id)

    const doc = await db.collection(INSTANCES).doc(instanceId).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Instance not found')); return }
    const instance = doc.data() as Record<string, unknown>

    const count = await generateStageTasks(
      db, instanceId, String(instance.pipeline_key),
      String(instance.current_stage), String(instance.assigned_to)
    )

    res.status(201).json(successResponse({ instance_id: instanceId, tasks_generated: count }))
  } catch (err) {
    console.error('POST /api/flow/instances/:id/tasks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/flow/tasks/:id — Complete or skip a task.
 * Body: { action: 'complete' | 'skip', notes?: string }
 */
flowRoutes.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const taskId = param(req.params.id)
    const body = req.body as Record<string, unknown>
    const action = String(body.action || 'complete')
    const userEmail = String((req as any).user?.email || 'api')
    const notes = String(body.notes || '')

    const doc = await db.collection(TASKS).doc(taskId).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Task not found')); return }
    const task = doc.data() as Record<string, unknown>

    const now = new Date().toISOString()

    if (action === 'skip') {
      if (task.is_required) {
        res.status(400).json(errorResponse(`Cannot skip required task "${task.task_name}"`))
        return
      }
      const updates = {
        status: 'skipped', check_result: 'SKIPPED', check_detail: notes || 'Skipped by user',
        completed_by: userEmail, completed_at: now, notes, updated_at: now,
      }
      await db.collection(TASKS).doc(taskId).update(updates)

      const actId = crypto.randomUUID()
      await db.collection(ACTIVITY).doc(actId).set({
        activity_id: actId, instance_id: task.instance_id, pipeline_key: task.pipeline_key,
        action: 'SKIP_TASK', from_value: String(task.task_name), to_value: 'skipped',
        performed_by: userEmail, performed_at: now, notes,
      })

      res.json(successResponse({ task_instance_id: taskId, status: 'skipped' }))
      return
    }

    // Complete
    const updates = {
      status: 'completed', check_result: 'PASS', check_detail: 'Completed manually',
      completed_by: userEmail, completed_at: now, notes, updated_at: now,
    }
    await db.collection(TASKS).doc(taskId).update(updates)

    const actId = crypto.randomUUID()
    await db.collection(ACTIVITY).doc(actId).set({
      activity_id: actId, instance_id: task.instance_id, pipeline_key: task.pipeline_key,
      action: 'COMPLETE_TASK', from_value: String(task.task_name), to_value: 'completed',
      performed_by: userEmail, performed_at: now, notes,
    })

    res.json(successResponse({ task_instance_id: taskId, status: 'completed', check_result: 'PASS' }))
  } catch (err) {
    console.error('PATCH /api/flow/tasks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate tasks for a stage from templates.
 */
async function generateStageTasks(
  db: FirebaseFirestore.Firestore,
  instanceId: string,
  pipelineKey: string,
  stageId: string,
  assignedTo: string
): Promise<number> {
  const templatesSnap = await db.collection(TASK_TEMPLATES)
    .where('pipeline_key', '==', pipelineKey)
    .where('stage_id', '==', stageId)
    .where('status', '==', 'active')
    .orderBy('task_order', 'asc')
    .get()

  if (templatesSnap.empty) return 0

  const now = new Date().toISOString()
  const batch = db.batch()
  let count = 0

  for (const tmplDoc of templatesSnap.docs) {
    const tmpl = tmplDoc.data()
    const taskInstanceId = crypto.randomUUID()
    const ownerEmail = tmpl.default_owner === 'SYSTEM' ? 'SYSTEM'
      : (tmpl.default_owner && tmpl.default_owner !== 'ADVISOR') ? tmpl.default_owner
      : assignedTo

    batch.set(db.collection(TASKS).doc(taskInstanceId), {
      task_instance_id: taskInstanceId,
      instance_id: instanceId,
      pipeline_key: pipelineKey,
      stage_id: stageId,
      step_id: tmpl.step_id || '',
      task_id: tmpl.task_id || '',
      task_name: tmpl.task_name || '',
      task_order: tmpl.task_order || 0,
      owner_email: ownerEmail,
      status: 'pending',
      is_required: tmpl.is_required ?? true,
      is_system_check: tmpl.is_system_check ?? false,
      check_type: tmpl.check_type || '',
      check_config: tmpl.check_config || '',
      created_at: now,
      updated_at: now,
    })
    count++
  }

  await batch.commit()
  return count
}
