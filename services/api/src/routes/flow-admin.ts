/**
 * Flow Admin routes — Pipeline configuration CRUD for Pipeline Studio.
 * Separated from flow.ts (instance operations) to keep concerns clean.
 *
 * All routes require LEADER, EXECUTIVE, OWNER, or SUPER_ADMIN role.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse, errorResponse, validateRequired, param,
} from '../lib/helpers.js'
import {
  FLOW_COLLECTIONS,
  type FlowAdminPipelineData,
  type FlowAdminPipelineArchiveResult,
  type FlowAdminPipelinePublishResult,
  type FlowAdminPipelineUnpublishResult,
  type FlowAdminStageCreateData,
  type FlowAdminStageUpdateData,
  type FlowAdminStageDeleteResult,
  type FlowAdminStageReorderResult,
  type FlowAdminStepData,
  type FlowAdminStepDeleteResult,
  type FlowAdminTaskTemplateData,
  type FlowAdminTaskTemplateDeleteResult,
  type FlowAdminWorkflowData,
  type FlowAdminWorkflowDeleteResult,
  type FlowStageDTO,
} from '@tomachina/core'

export const flowAdminRoutes = Router()

const { PIPELINES, STAGES, WORKFLOWS, STEPS, TASK_TEMPLATES, INSTANCES } = FLOW_COLLECTIONS

// ============================================================================
// Auth Guard — require leader-level access
// ============================================================================

const ALLOWED_ROLES = ['LEADER', 'EXECUTIVE', 'OWNER', 'SUPER_ADMIN']

async function requireLeader(req: Request, res: Response, next: NextFunction) {
  try {
    const email: string | undefined = (req as unknown as { user?: { email?: string } }).user?.email
    if (!email) {
      res.status(401).json(errorResponse('Authentication required'))
      return
    }

    const db = getFirestore()
    const userDoc = await db.collection('users').doc(email).get()

    if (!userDoc.exists) {
      res.status(403).json(errorResponse('Pipeline Studio requires leader access'))
      return
    }

    const userData = userDoc.data() as Record<string, unknown>
    const role = String(userData.role || '')
    const level = parseInt(String(userData.level || '99'), 10)

    // Allow by role name OR by level (0 = OWNER, 1 = EXECUTIVE, 2 = LEADER)
    if (!ALLOWED_ROLES.includes(role) && level > 2) {
      res.status(403).json(errorResponse('Pipeline Studio requires leader access'))
      return
    }

    next()
  } catch (err) {
    console.error('requireLeader middleware error:', err)
    res.status(500).json(errorResponse('Authorization check failed'))
  }
}

// Apply auth guard to all routes
flowAdminRoutes.use(requireLeader)

// Helper: get user email from request
function getUserEmail(req: Request): string {
  return (req as unknown as { user?: { email?: string } }).user?.email || 'api'
}

// ============================================================================
// Pipeline CRUD
// ============================================================================

/**
 * POST /api/flow/admin/pipelines — Create a new pipeline definition.
 */
flowAdminRoutes.post('/pipelines', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'pipeline_name'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)

    // Check for duplicate
    const existing = await db.collection(PIPELINES).doc(pipelineKey).get()
    if (existing.exists) {
      res.status(409).json(errorResponse(`Pipeline "${pipelineKey}" already exists`))
      return
    }

    const now = new Date().toISOString()
    const pipeline = {
      pipeline_key: pipelineKey,
      pipeline_name: String(body.pipeline_name),
      description: String(body.description || ''),
      portal: String(body.portal || ''),
      domain: String(body.domain || ''),
      platform_carrier: String(body.platform_carrier || ''),
      product_type: String(body.product_type || ''),
      default_view: String(body.default_view || 'board'),
      icon: String(body.icon || ''),
      status: 'draft',
      _created_by: getUserEmail(req),
      created_at: now,
      updated_at: now,
    }

    await db.collection(PIPELINES).doc(pipelineKey).set(pipeline)
    res.status(201).json(successResponse<FlowAdminPipelineData>({ pipeline: { id: pipelineKey, ...pipeline } } as unknown as FlowAdminPipelineData))
  } catch (err) {
    console.error('POST /api/flow/admin/pipelines error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PUT /api/flow/admin/pipelines/:key — Update a pipeline definition.
 */
flowAdminRoutes.put('/pipelines/:key', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const key = param(req.params.key)
    const body = req.body as Record<string, unknown>

    const docRef = db.collection(PIPELINES).doc(key)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Pipeline "${key}" not found`))
      return
    }

    const allowedFields = ['pipeline_name', 'description', 'portal', 'domain', 'icon', 'status', 'platform_carrier', 'product_type', 'default_view', 'assigned_section']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<FlowAdminPipelineData>({ pipeline: { id: updated.id, ...updated.data() } } as unknown as FlowAdminPipelineData))
  } catch (err) {
    console.error('PUT /api/flow/admin/pipelines/:key error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/flow/admin/pipelines/:key — Archive a pipeline (soft delete).
 */
flowAdminRoutes.delete('/pipelines/:key', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const key = param(req.params.key)

    const docRef = db.collection(PIPELINES).doc(key)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Pipeline "${key}" not found`))
      return
    }

    const data = doc.data() as Record<string, unknown>
    if (data.status === 'active') {
      res.status(400).json(errorResponse('Cannot delete an active pipeline — unpublish it first'))
      return
    }

    // Check for active instances
    const instancesSnap = await db.collection(INSTANCES)
      .where('pipeline_key', '==', key)
      .where('stage_status', '!=', 'complete')
      .limit(1)
      .get()

    if (!instancesSnap.empty) {
      res.status(400).json(errorResponse('Cannot delete pipeline with active instances'))
      return
    }

    await docRef.update({ status: 'archived', updated_at: new Date().toISOString() })
    res.json(successResponse<FlowAdminPipelineArchiveResult>({ archived: true } as unknown as FlowAdminPipelineArchiveResult))
  } catch (err) {
    console.error('DELETE /api/flow/admin/pipelines/:key error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/admin/pipelines/:key/publish — Set pipeline status to active.
 */
flowAdminRoutes.post('/pipelines/:key/publish', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const key = param(req.params.key)

    const docRef = db.collection(PIPELINES).doc(key)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Pipeline "${key}" not found`))
      return
    }

    await docRef.update({ status: 'active', updated_at: new Date().toISOString() })
    res.json(successResponse<FlowAdminPipelinePublishResult>({ published: true } as unknown as FlowAdminPipelinePublishResult))
  } catch (err) {
    console.error('POST /api/flow/admin/pipelines/:key/publish error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/admin/pipelines/:key/unpublish — Set pipeline status to draft.
 */
flowAdminRoutes.post('/pipelines/:key/unpublish', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const key = param(req.params.key)

    const docRef = db.collection(PIPELINES).doc(key)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Pipeline "${key}" not found`))
      return
    }

    await docRef.update({ status: 'draft', updated_at: new Date().toISOString() })
    res.json(successResponse<FlowAdminPipelineUnpublishResult>({ unpublished: true } as unknown as FlowAdminPipelineUnpublishResult))
  } catch (err) {
    console.error('POST /api/flow/admin/pipelines/:key/unpublish error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Stage CRUD
// ============================================================================

/**
 * GET /api/flow/admin/pipelines/:key/stages — List stages for a pipeline.
 */
flowAdminRoutes.get('/pipelines/:key/stages', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const pipelineKey = param(req.params.key)

    const snap = await db.collection(STAGES)
      .where('pipeline_key', '==', pipelineKey)
      .orderBy('stage_order', 'asc')
      .get()

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse<FlowStageDTO[]>(data as unknown as FlowStageDTO[]))
  } catch (err) {
    console.error('GET /api/flow/admin/pipelines/:key/stages error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/admin/stages — Create a new stage.
 */
flowAdminRoutes.post('/stages', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'stage_id', 'stage_name', 'stage_order'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)
    const stageId = String(body.stage_id)
    const docId = `${pipelineKey}__${stageId}`

    // Verify pipeline exists
    const pipelineDoc = await db.collection(PIPELINES).doc(pipelineKey).get()
    if (!pipelineDoc.exists) {
      res.status(404).json(errorResponse(`Pipeline "${pipelineKey}" not found`))
      return
    }

    const now = new Date().toISOString()
    const stage = {
      pipeline_key: pipelineKey,
      stage_id: stageId,
      stage_name: String(body.stage_name),
      stage_description: String(body.stage_description || ''),
      stage_order: Number(body.stage_order),
      stage_color: String(body.stage_color || ''),
      gate_enforced: Boolean(body.gate_enforced),
      has_workflow: Boolean(body.has_workflow),
      ghl_stage_id: '',
      status: 'active',
      created_at: now,
      updated_at: now,
    }

    // Create the stage
    await db.collection(STAGES).doc(docId).set(stage)

    // Auto-create default workflow for the stage
    const workflowId = `${docId}__${stageId}_workflow`
    const workflow = {
      pipeline_key: pipelineKey,
      stage_id: stageId,
      workflow_key: `${stageId}_workflow`,
      workflow_name: `${String(body.stage_name)} Workflow`,
      workflow_description: '',
      status: 'active',
      created_at: now,
      updated_at: now,
    }
    await db.collection(WORKFLOWS).doc(workflowId).set(workflow)

    res.status(201).json(successResponse<FlowAdminStageCreateData>({
      stage: { id: docId, ...stage },
      workflow: { id: workflowId, ...workflow },
    } as unknown as FlowAdminStageCreateData))
  } catch (err) {
    console.error('POST /api/flow/admin/stages error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PUT /api/flow/admin/stages/:id — Update a stage.
 */
flowAdminRoutes.put('/stages/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = req.body as Record<string, unknown>

    const docRef = db.collection(STAGES).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Stage "${id}" not found`))
      return
    }

    const allowedFields = ['stage_name', 'stage_description', 'stage_color', 'gate_enforced', 'stage_order', 'has_workflow']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<FlowAdminStageUpdateData>({ stage: { id: updated.id, ...updated.data() } } as unknown as FlowAdminStageUpdateData))
  } catch (err) {
    console.error('PUT /api/flow/admin/stages/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/flow/admin/stages/:id — Cascade delete a stage + workflow + steps + tasks.
 */
flowAdminRoutes.delete('/stages/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)

    const stageDoc = await db.collection(STAGES).doc(id).get()
    if (!stageDoc.exists) {
      res.status(404).json(errorResponse(`Stage "${id}" not found`))
      return
    }

    const stageData = stageDoc.data() as Record<string, unknown>
    const pipelineKey = String(stageData.pipeline_key)
    const stageId = String(stageData.stage_id)

    // Check for active instances in this stage
    const instancesSnap = await db.collection(INSTANCES)
      .where('pipeline_key', '==', pipelineKey)
      .where('current_stage', '==', stageId)
      .where('stage_status', '!=', 'complete')
      .limit(1)
      .get()

    if (!instancesSnap.empty) {
      res.status(400).json(errorResponse('Cannot delete stage with active instances'))
      return
    }

    // Cascade: find all steps for this stage
    const stepsSnap = await db.collection(STEPS)
      .where('pipeline_key', '==', pipelineKey)
      .where('stage_id', '==', stageId)
      .get()

    // Cascade: find all task templates for this stage
    const tasksSnap = await db.collection(TASK_TEMPLATES)
      .where('pipeline_key', '==', pipelineKey)
      .where('stage_id', '==', stageId)
      .get()

    // Cascade: find all workflows for this stage
    const workflowsSnap = await db.collection(WORKFLOWS)
      .where('pipeline_key', '==', pipelineKey)
      .where('stage_id', '==', stageId)
      .get()

    // Batch delete (max 500 per batch)
    const allDocs = [
      ...tasksSnap.docs,
      ...stepsSnap.docs,
      ...workflowsSnap.docs,
      stageDoc,
    ]

    for (let i = 0; i < allDocs.length; i += 500) {
      const batch = db.batch()
      const chunk = allDocs.slice(i, i + 500)
      for (const doc of chunk) {
        batch.delete(doc.ref)
      }
      await batch.commit()
    }

    res.json(successResponse<FlowAdminStageDeleteResult>({
      deleted: true,
      cascaded: {
        workflows: workflowsSnap.size,
        steps: stepsSnap.size,
        tasks: tasksSnap.size,
      },
    } as unknown as FlowAdminStageDeleteResult))
  } catch (err) {
    console.error('DELETE /api/flow/admin/stages/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/admin/stages/reorder — Batch update stage_order values.
 */
flowAdminRoutes.post('/stages/reorder', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'order'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)
    const order = body.order as Array<{ stage_id: string; stage_order: number }>

    if (!Array.isArray(order) || order.length === 0) {
      res.status(400).json(errorResponse('order must be a non-empty array'))
      return
    }

    const batch = db.batch()
    const now = new Date().toISOString()

    for (const item of order) {
      const docId = `${pipelineKey}__${item.stage_id}`
      const docRef = db.collection(STAGES).doc(docId)
      batch.update(docRef, { stage_order: item.stage_order, updated_at: now })
    }

    await batch.commit()
    res.json(successResponse<FlowAdminStageReorderResult>({ reordered: order.length } as unknown as FlowAdminStageReorderResult))
  } catch (err) {
    console.error('POST /api/flow/admin/stages/reorder error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Step CRUD
// ============================================================================

/**
 * GET /api/flow/admin/stages/:stageId/steps — List steps for a stage.
 */
flowAdminRoutes.get('/stages/:stageId/steps', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const stageId = param(req.params.stageId)
    const pipelineKey = String(req.query.pipeline_key || '')

    if (!pipelineKey) {
      res.status(400).json(errorResponse('pipeline_key query parameter is required'))
      return
    }

    const snap = await db.collection(STEPS)
      .where('pipeline_key', '==', pipelineKey)
      .where('stage_id', '==', stageId)
      .orderBy('step_order', 'asc')
      .get()

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse<FlowAdminStepData[]>(data as unknown as FlowAdminStepData[]))
  } catch (err) {
    console.error('GET /api/flow/admin/stages/:stageId/steps error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/admin/steps — Create a new step.
 */
flowAdminRoutes.post('/steps', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'stage_id', 'step_id', 'step_name', 'step_order'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)
    const stageId = String(body.stage_id)
    const stepId = String(body.step_id)
    const docId = `${pipelineKey}__${stageId}__${stepId}`

    const now = new Date().toISOString()
    const step = {
      pipeline_key: pipelineKey,
      stage_id: stageId,
      workflow_key: String(body.workflow_key || `${stageId}_workflow`),
      step_id: stepId,
      step_name: String(body.step_name),
      step_description: String(body.step_description || ''),
      step_order: Number(body.step_order),
      gate_enforced: Boolean(body.gate_enforced),
      execution_type: String(body.execution_type || 'sequential'),
      status: 'active',
      created_at: now,
      updated_at: now,
    }

    await db.collection(STEPS).doc(docId).set(step)
    res.status(201).json(successResponse<FlowAdminStepData>({ step: { id: docId, ...step } } as unknown as FlowAdminStepData))
  } catch (err) {
    console.error('POST /api/flow/admin/steps error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PUT /api/flow/admin/steps/:id — Update a step.
 */
flowAdminRoutes.put('/steps/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = req.body as Record<string, unknown>

    const docRef = db.collection(STEPS).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Step "${id}" not found`))
      return
    }

    const allowedFields = ['step_name', 'step_description', 'gate_enforced', 'step_order', 'execution_type']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<FlowAdminStepData>({ step: { id: updated.id, ...updated.data() } } as unknown as FlowAdminStepData))
  } catch (err) {
    console.error('PUT /api/flow/admin/steps/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/flow/admin/steps/:id — Cascade delete a step + its task templates.
 */
flowAdminRoutes.delete('/steps/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)

    const stepDoc = await db.collection(STEPS).doc(id).get()
    if (!stepDoc.exists) {
      res.status(404).json(errorResponse(`Step "${id}" not found`))
      return
    }

    const stepData = stepDoc.data() as Record<string, unknown>
    const pipelineKey = String(stepData.pipeline_key)
    const stageId = String(stepData.stage_id)
    const stepId = String(stepData.step_id)

    // Cascade: find all task templates for this step
    const tasksSnap = await db.collection(TASK_TEMPLATES)
      .where('pipeline_key', '==', pipelineKey)
      .where('stage_id', '==', stageId)
      .where('step_id', '==', stepId)
      .get()

    const allDocs = [...tasksSnap.docs, stepDoc]

    const batch = db.batch()
    for (const doc of allDocs) {
      batch.delete(doc.ref)
    }
    await batch.commit()

    res.json(successResponse<FlowAdminStepDeleteResult>({
      deleted: true,
      cascaded: { tasks: tasksSnap.size },
    } as unknown as FlowAdminStepDeleteResult))
  } catch (err) {
    console.error('DELETE /api/flow/admin/steps/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Task Template CRUD
// ============================================================================

/**
 * GET /api/flow/admin/steps/:stepId/tasks — List task templates for a step.
 */
flowAdminRoutes.get('/steps/:stepId/tasks', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const stepId = param(req.params.stepId)
    const pipelineKey = String(req.query.pipeline_key || '')
    const stageId = String(req.query.stage_id || '')

    if (!pipelineKey || !stageId) {
      res.status(400).json(errorResponse('pipeline_key and stage_id query parameters are required'))
      return
    }

    const snap = await db.collection(TASK_TEMPLATES)
      .where('pipeline_key', '==', pipelineKey)
      .where('stage_id', '==', stageId)
      .where('step_id', '==', stepId)
      .orderBy('task_order', 'asc')
      .get()

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse<FlowAdminTaskTemplateData[]>(data as unknown as FlowAdminTaskTemplateData[]))
  } catch (err) {
    console.error('GET /api/flow/admin/steps/:stepId/tasks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/flow/admin/tasks — Create a new task template.
 */
flowAdminRoutes.post('/tasks', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'stage_id', 'step_id', 'task_id', 'task_name', 'task_order'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)
    const stageId = String(body.stage_id)
    const taskId = String(body.task_id)
    const docId = `${pipelineKey}__${stageId}__${taskId}`

    const now = new Date().toISOString()
    const task = {
      pipeline_key: pipelineKey,
      stage_id: stageId,
      workflow_key: String(body.workflow_key || `${stageId}_workflow`),
      step_id: String(body.step_id),
      task_id: taskId,
      task_name: String(body.task_name),
      task_description: String(body.task_description || ''),
      task_order: Number(body.task_order),
      is_required: Boolean(body.is_required),
      is_system_check: Boolean(body.is_system_check),
      check_type: String(body.check_type || ''),
      check_config: String(body.check_config || ''),
      default_owner: String(body.default_owner || ''),
      role_applicability: String(body.role_applicability || ''),
      source: 'published',
      status: 'active',
      created_at: now,
      updated_at: now,
    }

    await db.collection(TASK_TEMPLATES).doc(docId).set(task)
    res.status(201).json(successResponse<FlowAdminTaskTemplateData>({ task: { id: docId, ...task } } as unknown as FlowAdminTaskTemplateData))
  } catch (err) {
    console.error('POST /api/flow/admin/tasks error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PUT /api/flow/admin/tasks/:id — Update a task template.
 */
flowAdminRoutes.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = req.body as Record<string, unknown>

    const docRef = db.collection(TASK_TEMPLATES).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Task template "${id}" not found`))
      return
    }

    const allowedFields = [
      'task_name', 'task_description', 'is_required', 'is_system_check',
      'check_type', 'check_config', 'default_owner', 'role_applicability', 'task_order',
    ]
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<FlowAdminTaskTemplateData>({ task: { id: updated.id, ...updated.data() } } as unknown as FlowAdminTaskTemplateData))
  } catch (err) {
    console.error('PUT /api/flow/admin/tasks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/flow/admin/tasks/:id — Delete a task template.
 */
flowAdminRoutes.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)

    const docRef = db.collection(TASK_TEMPLATES).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Task template "${id}" not found`))
      return
    }

    await docRef.delete()
    res.json(successResponse<FlowAdminTaskTemplateDeleteResult>({ deleted: true } as unknown as FlowAdminTaskTemplateDeleteResult))
  } catch (err) {
    console.error('DELETE /api/flow/admin/tasks/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Workflow CRUD
// ============================================================================

/**
 * POST /api/flow/admin/workflows — Create a workflow.
 */
flowAdminRoutes.post('/workflows', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['pipeline_key', 'stage_id', 'workflow_key', 'workflow_name'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const pipelineKey = String(body.pipeline_key)
    const stageId = String(body.stage_id)
    const workflowKey = String(body.workflow_key)
    const docId = `${pipelineKey}__${stageId}__${workflowKey}`

    const now = new Date().toISOString()
    const workflow = {
      pipeline_key: pipelineKey,
      stage_id: stageId,
      workflow_key: workflowKey,
      workflow_name: String(body.workflow_name),
      workflow_description: String(body.workflow_description || ''),
      status: 'active',
      created_at: now,
      updated_at: now,
    }

    await db.collection(WORKFLOWS).doc(docId).set(workflow)
    res.status(201).json(successResponse<FlowAdminWorkflowData>({ workflow: { id: docId, ...workflow } } as unknown as FlowAdminWorkflowData))
  } catch (err) {
    console.error('POST /api/flow/admin/workflows error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PUT /api/flow/admin/workflows/:id — Update a workflow.
 */
flowAdminRoutes.put('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = req.body as Record<string, unknown>

    const docRef = db.collection(WORKFLOWS).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Workflow "${id}" not found`))
      return
    }

    const allowedFields = ['workflow_name', 'workflow_description']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<FlowAdminWorkflowData>({ workflow: { id: updated.id, ...updated.data() } } as unknown as FlowAdminWorkflowData))
  } catch (err) {
    console.error('PUT /api/flow/admin/workflows/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/flow/admin/workflows/:id — Delete a workflow.
 */
flowAdminRoutes.delete('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)

    const docRef = db.collection(WORKFLOWS).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Workflow "${id}" not found`))
      return
    }

    await docRef.delete()
    res.json(successResponse<FlowAdminWorkflowDeleteResult>({ deleted: true } as unknown as FlowAdminWorkflowDeleteResult))
  } catch (err) {
    console.error('DELETE /api/flow/admin/workflows/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
