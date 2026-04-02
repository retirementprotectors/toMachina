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
import { dispatchCheck } from '@tomachina/core'
import type {
  FlowPipelineDTO,
  FlowPipelineDetailDTO,
  FlowStageDTO,
  FlowInstanceDTO,
  FlowInstanceDetailData,
  FlowInstanceCreateResult,
  FlowInstanceAdvanceResult,
  FlowInstanceCompleteResult,
  FlowInstanceReassignResult,
  FlowInstancePriorityResult,
  FlowInstanceMoveResult,
  FlowTasksGenerateResult,
  FlowTaskCompleteResult,
  FlowTaskSkipResult,
  CheckResult,
} from '@tomachina/core'

export const flowRoutes = Router()

const INSTANCES = 'flow_instances'
const TASKS = 'flow_instance_tasks'
const ACTIVITY = 'flow_activity'
const PIPELINES = 'flow_pipelines'
const STAGES = 'flow_stages'
const TASK_TEMPLATES = 'flow_task_templates'

// ============================================================================
// Mobile views
// ============================================================================

/**
 * GET /api/flow?view=my-active
 * Returns active pipeline instances for the authenticated user, enriched with
 * pipeline + stage metadata. Used by MDJ Mobile Sales Dashboard.
 */
flowRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const view = req.query.view as string | undefined
    if (view !== 'my-active') {
      res.status(400).json(errorResponse('Supported views: my-active'))
      return
    }

    const db = getFirestore()
    const userEmail = String((req as unknown as Record<string, unknown>).user
      ? ((req as unknown as Record<string, unknown>).user as Record<string, string>).email
      : '')

    // Fetch active instances assigned to this user
    const snap = await db.collection(INSTANCES)
      .where('assigned_to', '==', userEmail)
      .where('stage_status', '==', 'in_progress')
      .get()

    if (snap.empty) {
      res.json(successResponse([]))
      return
    }

    // Gather unique pipeline keys to batch-fetch pipeline + stage metadata
    const pipelineKeys = [...new Set(snap.docs.map(d => String(d.data().pipeline_key)))]

    const [pipelinesSnap, stagesSnap] = await Promise.all([
      db.collection(PIPELINES).where('__name__', 'in', pipelineKeys.slice(0, 10)).get(),
      db.collection(STAGES).where('pipeline_key', 'in', pipelineKeys.slice(0, 10)).get(),
    ])

    const pipelineMap = new Map<string, string>()
    pipelinesSnap.docs.forEach(d => pipelineMap.set(d.id, String(d.data().name || d.id)))

    const stageMap = new Map<string, { name: string; order: number }>()
    const stageCounts = new Map<string, number>()
    stagesSnap.docs.forEach(d => {
      const data = d.data()
      stageMap.set(String(data.stage_id), { name: String(data.name || data.stage_id), order: Number(data.stage_order || 0) })
      const pk = String(data.pipeline_key)
      stageCounts.set(pk, (stageCounts.get(pk) || 0) + 1)
    })

    const items = snap.docs.map(d => {
      const data = d.data()
      const stageInfo = stageMap.get(String(data.current_stage))
      return {
        id: d.id,
        client_name: String(data.entity_name || ''),
        pipeline_name: pipelineMap.get(String(data.pipeline_key)) || String(data.pipeline_key),
        stage_name: stageInfo?.name || String(data.current_stage),
        stage_index: stageInfo?.order || 0,
        total_stages: stageCounts.get(String(data.pipeline_key)) || 1,
        updated_at: String(data.updated_at || ''),
        value: data.deal_value ? Number(data.deal_value) : undefined,
      }
    }).sort((a, b) => b.updated_at.localeCompare(a.updated_at))

    res.json(successResponse(items))
  } catch (err) {
    console.error('GET /api/flow?view=my-active error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Pipeline config reads
// ============================================================================

/**
 * GET /api/flow/pipelines — List pipeline definitions.
 */
flowRoutes.get('/pipelines', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const portalFilter = req.query.portal as string | undefined
    const statusFilter = req.query.status as string | undefined

    // Query pipelines that match portal via string field OR portals array field
    // This supports both legacy single-portal and multi-portal pipelines
    let results: Array<Record<string, unknown>> = []

    if (portalFilter) {
      // Query 1: portal == 'X' (legacy single-portal)
      let q1: Query<DocumentData> = db.collection(PIPELINES).where('portal', '==', portalFilter)
      if (statusFilter) q1 = q1.where('status', '==', statusFilter)
      const snap1 = await q1.get()
      const ids = new Set<string>()
      snap1.docs.forEach(d => { ids.add(d.id); results.push({ id: d.id, ...d.data() }) })

      // Query 2: portals array-contains 'X' (multi-portal)
      let q2: Query<DocumentData> = db.collection(PIPELINES).where('portals', 'array-contains', portalFilter)
      if (statusFilter) q2 = q2.where('status', '==', statusFilter)
      const snap2 = await q2.get()
      snap2.docs.forEach(d => { if (!ids.has(d.id)) results.push({ id: d.id, ...d.data() }) })
    } else {
      let q: Query<DocumentData> = db.collection(PIPELINES)
      if (statusFilter) q = q.where('status', '==', statusFilter)
      const snap = await q.get()
      results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }

    res.json(successResponse<FlowPipelineDTO[]>(results as unknown as FlowPipelineDTO[]))
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
    res.json(successResponse<FlowPipelineDetailDTO>({ id: doc.id, ...doc.data() } as unknown as FlowPipelineDetailDTO))
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
    res.json(successResponse<FlowStageDTO[]>(data as unknown as FlowStageDTO[]))
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

    let q: Query<DocumentData> = db.collection(INSTANCES)
    if (req.query.pipeline_key) q = q.where('pipeline_key', '==', req.query.pipeline_key)
    if (req.query.stage) q = q.where('current_stage', '==', req.query.stage)
    if (req.query.status) q = q.where('stage_status', '==', req.query.status)
    if (req.query.assigned_to) q = q.where('assigned_to', '==', req.query.assigned_to)
    if (req.query.entity_type) q = q.where('entity_type', '==', req.query.entity_type)
    if (req.query.entity_id) q = q.where('entity_id', '==', req.query.entity_id)
    if (req.query.specialist_id) q = q.where('specialist_id', '==', req.query.specialist_id)

    // Simple query without orderBy to avoid composite index requirements
    const snap = await q.get()
    const data = snap.docs
      .map(d => stripInternalFields({ id: d.id, ...d.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      )
    res.json(successResponse<FlowInstanceDTO[]>(data as unknown as FlowInstanceDTO[]))
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

    // Fetch tasks, activity, and pipeline stages
    const pipelineKey = instance.pipeline_key as string
    const [tasksSnap, activitySnap, stagesSnap] = await Promise.all([
      db.collection(TASKS).where('instance_id', '==', id).orderBy('task_order', 'asc').get(),
      db.collection(ACTIVITY).where('instance_id', '==', id).orderBy('performed_at', 'desc').limit(20).get(),
      db.collection(STAGES).where('pipeline_key', '==', pipelineKey).orderBy('stage_order', 'asc').get(),
    ])

    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const activity = activitySnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const stages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Compute gate result for current stage so the UI can disable Advance when blocked
    let gateResult: { pass: boolean; reasons: string[] } | null = null
    const currentStage = stages.find((s: any) => s.stage_id === instance.current_stage) as any
    if (currentStage?.gate_enforced) {
      const currentTasks = tasks as any[]
      const stageTasks = currentTasks.filter((t: any) => t.stage_id === currentStage.stage_id)
      const statusBlockers = stageTasks
        .filter((t: any) => t.is_required && !['completed', 'skipped'].includes(String(t.status)))
      const checkBlockers = stageTasks
        .filter((t: any) => t.is_system_check && t.status === 'completed' && t.check_result && t.check_result !== 'PASS')
      const reasons = [
        ...statusBlockers.map((t: any) => `"${t.task_name}" is ${t.status}`),
        ...checkBlockers.map((t: any) => `"${t.task_name}" check returned ${t.check_result}`),
      ]
      gateResult = { pass: reasons.length === 0, reasons }
    }

    // Check if at final stage
    const currentIdx = stages.findIndex((s: any) => s.stage_id === instance.current_stage)
    const isAtFinalStage = currentIdx >= 0 && currentIdx >= stages.length - 1

    res.json(successResponse<FlowInstanceDetailData>({ instance: stripInternalFields(instance), tasks, activity, stages, gateResult, isAtFinalStage } as unknown as FlowInstanceDetailData))
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
      _created_by: String(userEmail),
      created_at: now,
      updated_at: now,
    }

    // Generate tasks FIRST so a failure doesn't leave orphaned instances
    let tasksGenerated = 0
    if (firstStage.has_workflow) {
      tasksGenerated = await generateStageTasks(db, instanceId, pipelineKey, String(firstStage.stage_id), String(body.assigned_to))
    }

    // Write instance only after tasks succeed (or none needed)
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

    res.status(201).json(successResponse<FlowInstanceCreateResult>({
      instance_id: instanceId,
      pipeline_key: pipelineKey,
      current_stage: firstStage.stage_id,
      tasks_generated: tasksGenerated,
    } as unknown as FlowInstanceCreateResult))
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

        // Check gate — both task status AND system check results
        const currentStage = stages[currentIdx]
        if (currentStage.gate_enforced) {
          const tasksSnap = await db.collection(TASKS)
            .where('instance_id', '==', id)
            .where('stage_id', '==', currentStage.stage_id)
            .get()
          const taskDocs = tasksSnap.docs.map(d => d.data())
          const statusBlockers = taskDocs
            .filter(t => t.is_required && !['completed', 'skipped'].includes(String(t.status)))
          const checkBlockers = taskDocs
            .filter(t => t.is_system_check && t.status === 'completed' && t.check_result && t.check_result !== 'PASS')

          if (statusBlockers.length > 0 || checkBlockers.length > 0) {
            const reasons = [
              ...statusBlockers.map(t => `"${t.task_name}" is ${t.status}`),
              ...checkBlockers.map(t => `"${t.task_name}" check returned ${t.check_result}`),
            ]
            res.status(400).json(errorResponse(`Gate blocked — ${reasons.join('; ')}`, 400))
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

        res.json(successResponse<FlowInstanceAdvanceResult>({ new_stage: nextStage.stage_id, tasks_generated: tasksGenerated } as unknown as FlowInstanceAdvanceResult))
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

        res.json(successResponse<FlowInstanceCompleteResult>({ instance_id: id, status: 'complete' } as unknown as FlowInstanceCompleteResult))
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

        res.json(successResponse<FlowInstanceReassignResult>({ instance_id: id, assigned_to: newOwner } as unknown as FlowInstanceReassignResult))
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

        res.json(successResponse<FlowInstancePriorityResult>({ instance_id: id, priority: newPriority } as unknown as FlowInstancePriorityResult))
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

        res.json(successResponse<FlowInstanceMoveResult>({ instance_id: id, new_stage: targetStage } as unknown as FlowInstanceMoveResult))
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

    res.status(201).json(successResponse<FlowTasksGenerateResult>({ instance_id: instanceId, tasks_generated: count } as unknown as FlowTasksGenerateResult))
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

      res.json(successResponse<FlowTaskSkipResult>({ task_instance_id: taskId, status: 'skipped' } as unknown as FlowTaskSkipResult))
      return
    }

    // Complete — run dispatchCheck for system check tasks
    let checkResult: CheckResult = 'PASS'
    let checkDetail = 'Completed manually'
    let completedStatus = 'completed'

    if (task.is_system_check && task.check_type) {
      const instanceDoc = await db.collection(INSTANCES).doc(String(task.instance_id)).get()
      const instanceData = instanceDoc.exists ? (instanceDoc.data() as Record<string, unknown>) : {}
      const checkConfigRaw = String(task.check_config || '{}')
      const dispatchResult = dispatchCheck(String(task.check_type), checkConfigRaw, instanceData)

      checkResult = dispatchResult.result
      checkDetail = dispatchResult.detail
      // Don't advance to completed if check didn't pass
      if (checkResult === 'FAIL') {
        completedStatus = 'blocked'
      } else if (checkResult === 'PENDING') {
        completedStatus = 'in_progress'
      }
    }

    const updates: Record<string, unknown> = {
      status: completedStatus, check_result: checkResult, check_detail: checkDetail,
      completed_by: userEmail, completed_at: now, notes, updated_at: now,
    }
    await db.collection(TASKS).doc(taskId).update(updates)

    const actId = crypto.randomUUID()
    await db.collection(ACTIVITY).doc(actId).set({
      activity_id: actId, instance_id: task.instance_id, pipeline_key: task.pipeline_key,
      action: 'COMPLETE_TASK', from_value: String(task.task_name), to_value: completedStatus,
      performed_by: userEmail, performed_at: now, notes,
    })

    res.json(successResponse<FlowTaskCompleteResult>({ task_instance_id: taskId, status: completedStatus, check_result: checkResult } as unknown as FlowTaskCompleteResult))
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
 * For steps with execution_type: 'dex_output', system check tasks are
 * automatically configured with DEX_KIT_GENERATE if no check_type is set,
 * and are pre-linked with step-level DEX config (product_type, registration_type, action).
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

  // Fetch step definitions for this stage to detect dex_output execution type
  const stepsSnap = await db.collection('flow_steps')
    .where('pipeline_key', '==', pipelineKey)
    .where('stage_id', '==', stageId)
    .get()

  const dexOutputSteps = new Map<string, Record<string, unknown>>()
  for (const stepDoc of stepsSnap.docs) {
    const stepData = stepDoc.data()
    if (stepData.execution_type === 'dex_output') {
      dexOutputSteps.set(String(stepData.step_id), stepData)
    }
  }

  const now = new Date().toISOString()
  const batch = db.batch()
  let count = 0

  for (const tmplDoc of templatesSnap.docs) {
    const tmpl = tmplDoc.data()
    const taskInstanceId = crypto.randomUUID()
    const ownerEmail = tmpl.default_owner === 'SYSTEM' ? 'SYSTEM'
      : (tmpl.default_owner && tmpl.default_owner !== 'ADVISOR') ? tmpl.default_owner
      : assignedTo

    let checkType = tmpl.check_type || ''
    let checkConfig = tmpl.check_config || ''

    // For dex_output steps: auto-configure system check tasks with DEX_KIT_GENERATE
    const stepId = String(tmpl.step_id || '')
    const dexStep = dexOutputSteps.get(stepId)
    if (dexStep && tmpl.is_system_check && !checkType) {
      checkType = 'DEX_KIT_GENERATE'
      // Merge step-level DEX config into the check config
      const existingConfig = typeof checkConfig === 'string' && checkConfig
        ? safeJsonParse(checkConfig)
        : {}
      const dexConfig = {
        ...existingConfig,
        product_type: dexStep.product_type || existingConfig.product_type || '',
        registration_type: dexStep.registration_type || existingConfig.registration_type || '',
        action: dexStep.action || existingConfig.action || '',
      }
      checkConfig = JSON.stringify(dexConfig)
    }

    batch.set(db.collection(TASKS).doc(taskInstanceId), {
      task_instance_id: taskInstanceId,
      instance_id: instanceId,
      pipeline_key: pipelineKey,
      stage_id: stageId,
      step_id: stepId,
      task_id: tmpl.task_id || '',
      task_name: tmpl.task_name || '',
      task_order: tmpl.task_order || 0,
      owner_email: ownerEmail,
      status: 'pending',
      is_required: tmpl.is_required ?? true,
      is_system_check: tmpl.is_system_check ?? false,
      check_type: checkType,
      check_config: checkConfig,
      created_at: now,
      updated_at: now,
    })
    count++
  }

  await batch.commit()
  return count
}

/** Safely parse a JSON string into an object, returning empty object on failure. */
function safeJsonParse(str: string): Record<string, unknown> {
  try { return JSON.parse(str) } catch { return {} }
}
