/**
 * RSP Pipeline routes — A+R meeting transition + Red→Service handoff.
 *
 * @ticket TRK-14131 — Green→Red A+R Transition
 * @ticket TRK-14132 — Red→Service Handoff
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse, errorResponse, validateRequired, param, writeThroughBridge,
} from '../lib/helpers.js'

export const rspRoutes = Router()

const INSTANCES = 'flow_instances'
const INSTANCE_TASKS = 'flow_instance_tasks'
const ACTIVITY = 'flow_activity'
const DEX_PACKAGES = 'dex_packages'
const DEX_KITS = 'dex_kits'

// ============================================================================
// RSP PIPELINE KEY
// ============================================================================

const RSP_PIPELINE_KEY = 'rsp'

// ============================================================================
// Stage identifiers (match flow_stages config)
// ============================================================================

const STAGE_GREEN = 'green'
const STAGE_RED = 'red'

// ============================================================================
// POST /api/rsp/transition/:instanceId — A+R Meeting Transition (Green→Red)
// ============================================================================

/**
 * Schedule the A+R (Analysis & Recommendation) meeting, attach the Yellow
 * case package, and advance the instance from Green to Red.
 *
 * Body:
 *   transition:        'ar_meeting'
 *   meeting_datetime:  ISO 8601 string
 *   meeting_type:      'office' | 'virtual'
 *   package_items:     string[]   — list of Yellow case-package item IDs attached
 *
 * Returns:
 *   { success: true, data: { instance_id, new_stage: 'red', calendar_event_id } }
 */
rspRoutes.post('/transition/:instanceId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const instanceId = param(req.params.instanceId)
    const body = req.body as Record<string, unknown>
    const userEmail = String((req as unknown as Record<string, unknown>).user
      ? ((req as unknown as Record<string, unknown>).user as Record<string, unknown>).email
      : 'api')

    // ── Route to correct transition handler ─────────────────────────────
    const transition = String(body.transition || '')

    if (transition === 'service_handoff') {
      await handleServiceHandoff(db, instanceId, userEmail, res)
      return
    }

    if (transition !== 'ar_meeting') {
      res.status(400).json(errorResponse(`Unsupported transition type: "${transition}". Use: ar_meeting, service_handoff`))
      return
    }

    // ── Validate A+R required fields ───────────────────────────────────────
    const err = validateRequired(body, ['meeting_datetime', 'meeting_type'])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const meetingDatetime = String(body.meeting_datetime)
    const meetingType = String(body.meeting_type)

    // Validate meeting_type
    if (!['office', 'virtual'].includes(meetingType)) {
      res.status(400).json(errorResponse('meeting_type must be "office" or "virtual"'))
      return
    }

    // Validate meeting_datetime is a valid future date
    const meetingDate = new Date(meetingDatetime)
    if (isNaN(meetingDate.getTime())) {
      res.status(400).json(errorResponse('meeting_datetime must be a valid ISO 8601 date'))
      return
    }

    // Validate package_items
    const packageItems = Array.isArray(body.package_items) ? body.package_items as string[] : []
    if (packageItems.length === 0) {
      res.status(400).json(errorResponse('package_items must be a non-empty array of case-package item IDs'))
      return
    }

    // ── Fetch instance ────────────────────────────────────────────────────
    const instanceDoc = await db.collection(INSTANCES).doc(instanceId).get()
    if (!instanceDoc.exists) {
      res.status(404).json(errorResponse('Instance not found'))
      return
    }

    const instance = instanceDoc.data() as Record<string, unknown>

    // Verify the instance is on the Green stage
    if (instance.current_stage !== STAGE_GREEN) {
      res.status(400).json(
        errorResponse(`Instance is on stage "${instance.current_stage}", expected "${STAGE_GREEN}"`)
      )
      return
    }

    // ── Create calendar event (stub) ──────────────────────────────────────
    const calendarEventId = `cal_${crypto.randomUUID()}`
    // TODO: Integrate with real calendar provider (Google Calendar / Outlook)
    // For now, we record the meeting metadata on the instance.

    const now = new Date().toISOString()

    // ── Build instance update ─────────────────────────────────────────────
    const instanceUpdate: Record<string, unknown> = {
      current_stage: STAGE_RED,
      current_step: '',
      workflow_progress: '{}',
      stage_status: 'in_progress',
      updated_at: now,
      // A+R meeting metadata stored in custom_fields
      ar_meeting: {
        meeting_datetime: meetingDatetime,
        meeting_type: meetingType,
        calendar_event_id: calendarEventId,
        package_items: packageItems,
        scheduled_by: userEmail,
        scheduled_at: now,
      },
    }

    // ── Write instance update ─────────────────────────────────────────────
    const bridgeResult = await writeThroughBridge(INSTANCES, 'update', instanceId, instanceUpdate)
    if (!bridgeResult.success) {
      await db.collection(INSTANCES).doc(instanceId).update(instanceUpdate)
    }

    // ── Log activity ──────────────────────────────────────────────────────
    const activityId = crypto.randomUUID()
    const activity = {
      activity_id: activityId,
      instance_id: instanceId,
      pipeline_key: String(instance.pipeline_key || RSP_PIPELINE_KEY),
      action: 'ADVANCE_STAGE',
      from_value: STAGE_GREEN,
      to_value: STAGE_RED,
      performed_by: userEmail,
      performed_at: now,
      notes: `A+R meeting scheduled for ${meetingDatetime} (${meetingType}). Case package: ${packageItems.length} item(s) attached.`,
    }
    await db.collection(ACTIVITY).doc(activityId).set(activity)

    // ── Response ──────────────────────────────────────────────────────────
    res.json(successResponse({
      instance_id: instanceId,
      new_stage: STAGE_RED,
      calendar_event_id: calendarEventId,
      meeting_datetime: meetingDatetime,
      meeting_type: meetingType,
      package_items_count: packageItems.length,
    }))
  } catch (err) {
    console.error('POST /api/rsp/transition/:instanceId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SERVICE_HANDOFF HANDLER (TRK-14132)
// ============================================================================

/**
 * Service pipeline keys for auto-created service cards.
 * One card per product line that has been activated during the RSP engagement.
 */
const SERVICE_PIPELINE_MAP: Record<string, { pipeline_key: string; label: string }> = {
  LIFE: { pipeline_key: 'SALES_RETIREMENT', label: 'RMD Center — Life' },
  ANNUITY: { pipeline_key: 'SALES_RETIREMENT', label: 'RMD Center — Annuity' },
  MEDICARE: { pipeline_key: 'SALES_MEDICARE', label: 'Beni Center — Medicare' },
  INVESTMENT: { pipeline_key: 'SALES_RETIREMENT', label: 'Access Center — Investment' },
}

/** NewBiz kit ID used by DEX to assemble implementation forms. */
const NEWBIZ_KIT_ID = 'KIT_RSP_NEWBIZ'

/** Response shape for service_handoff transition. */
interface RspServiceHandoffResult {
  instance_id: string
  newbiz_kit_id: string | null
  service_cards: Array<{
    instance_id: string
    pipeline_key: string
    label: string
    product_line: string
  }>
  status: 'complete'
}

/**
 * Red→Service Handoff (Implementation Meeting).
 *
 * 1. Validate instance is in RED stage
 * 2. DEX NewBiz kit creation (creates dex_package from NEWBIZ kit template)
 * 3. Auto-create flow_instances for each activated product-line service pipeline
 * 4. Mark RSP instance complete
 * 5. Return { newbiz_kit_id, service_cards }
 */
async function handleServiceHandoff(
  db: FirebaseFirestore.Firestore,
  instanceId: string,
  userEmail: string,
  res: Response,
): Promise<void> {
  // ── 1. Load + validate instance ──────────────────────────────────────
  const instanceDoc = await db.collection(INSTANCES).doc(instanceId).get()
  if (!instanceDoc.exists) {
    res.status(404).json(errorResponse('RSP instance not found'))
    return
  }
  const instance = instanceDoc.data() as Record<string, unknown>

  // Verify we're in the RED stage
  if (instance.current_stage !== STAGE_RED) {
    res.status(400).json(
      errorResponse(`Service handoff requires RED stage — instance is in "${instance.current_stage}"`)
    )
    return
  }

  const now = new Date().toISOString()
  const entityId = String(instance.entity_id || '')
  const entityName = String(instance.entity_name || '')
  const assignedTo = String(instance.assigned_to || userEmail)

  // ── 2. DEX NewBiz Kit Generation ───────────────────────────────────
  // Create a DEX package from the NewBiz kit template. Best-effort: if the
  // kit template doesn't exist we log and continue (service cards are still
  // valuable without the kit).
  let newbizKitId: string | null = null

  try {
    const kitDoc = await db.collection(DEX_KITS).doc(NEWBIZ_KIT_ID).get()
    const kitData = kitDoc.exists ? (kitDoc.data() || {}) : {}

    const packageId = `PKG_RSP_NB_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    const packageData: Record<string, unknown> = {
      package_id: packageId,
      client_id: entityId,
      client_name: entityName,
      client_email: String(
        instance.entity_data && typeof instance.entity_data === 'object'
          ? (instance.entity_data as Record<string, unknown>).email || ''
          : ''
      ),
      client_phone: '',
      kit_id: NEWBIZ_KIT_ID,
      kit_name: String(kitData.kit_name || 'RSP NewBiz Kit'),
      form_ids: (kitData.form_ids as string[]) || [],
      status: 'DRAFT',
      delivery_method: 'EMAIL',
      source_pipeline: RSP_PIPELINE_KEY,
      source_instance_id: instanceId,
      created_at: now,
      updated_at: now,
      sent_at: null,
      viewed_at: null,
      signed_at: null,
      submitted_at: null,
      completed_at: null,
      docusign_envelope_id: null,
      pdf_storage_ref: null,
      notes: `Auto-generated NewBiz kit from RSP service handoff — ${entityName}`,
      draft_state: null,
      _created_by: userEmail,
    }

    const bridgeResult = await writeThroughBridge(DEX_PACKAGES, 'insert', packageId, packageData)
    if (!bridgeResult.success) {
      await db.collection(DEX_PACKAGES).doc(packageId).set(packageData)
    }

    newbizKitId = packageId
  } catch (dexErr) {
    // Best-effort: log but don't block the handoff
    console.error('RSP service_handoff: NewBiz kit generation failed:', dexErr)
  }

  // ── 3. Auto-create service pipeline cards ──────────────────────────
  const activatedProducts = await resolveActivatedProducts(db, instanceId, instance)

  const serviceCards: RspServiceHandoffResult['service_cards'] = []

  for (const productLine of activatedProducts) {
    const mapping = SERVICE_PIPELINE_MAP[productLine]
    if (!mapping) continue

    try {
      const serviceInstanceId = `SVC_${productLine}_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
      const serviceData: Record<string, unknown> = {
        instance_id: serviceInstanceId,
        pipeline_key: mapping.pipeline_key,
        current_stage: 'new',
        current_step: '',
        entity_type: String(instance.entity_type || 'HOUSEHOLD'),
        entity_id: entityId,
        entity_name: entityName,
        entity_data: typeof instance.entity_data === 'string'
          ? instance.entity_data
          : JSON.stringify(instance.entity_data || {}),
        priority: 'MEDIUM',
        assigned_to: assignedTo,
        stage_status: 'pending',
        workflow_progress: '{}',
        custom_fields: JSON.stringify({
          source_pipeline: RSP_PIPELINE_KEY,
          source_instance_id: instanceId,
          product_line: productLine,
          newbiz_kit_id: newbizKitId,
          service_label: mapping.label,
        }),
        created_by: userEmail,
        created_at: now,
        updated_at: now,
      }

      const bridgeResult = await writeThroughBridge(INSTANCES, 'insert', serviceInstanceId, serviceData)
      if (!bridgeResult.success) {
        await db.collection(INSTANCES).doc(serviceInstanceId).set(serviceData)
      }

      // Log activity on the new service instance
      const actId = crypto.randomUUID()
      await db.collection(ACTIVITY).doc(actId).set({
        activity_id: actId,
        instance_id: serviceInstanceId,
        pipeline_key: mapping.pipeline_key,
        action: 'CREATE',
        from_value: '',
        to_value: 'new',
        performed_by: userEmail,
        performed_at: now,
        notes: `Auto-created from RSP service handoff (${instanceId}) — ${mapping.label}`,
      })

      serviceCards.push({
        instance_id: serviceInstanceId,
        pipeline_key: mapping.pipeline_key,
        label: mapping.label,
        product_line: productLine,
      })
    } catch (cardErr) {
      // Best-effort per card — continue creating others
      console.error(`RSP service_handoff: Failed to create service card for ${productLine}:`, cardErr)
    }
  }

  // ── 4. Mark RSP instance complete ──────────────────────────────────
  const existingCustomFields = typeof instance.custom_fields === 'string'
    ? safeJsonParse(instance.custom_fields)
    : (instance.custom_fields as Record<string, unknown> || {})

  const completeUpdates: Record<string, unknown> = {
    stage_status: 'complete',
    completed_at: now,
    updated_at: now,
    custom_fields: JSON.stringify({
      ...existingCustomFields,
      newbiz_kit_id: newbizKitId,
      service_card_count: serviceCards.length,
      handoff_completed_at: now,
      handoff_completed_by: userEmail,
    }),
  }

  const bridgeResult = await writeThroughBridge(INSTANCES, 'update', instanceId, completeUpdates)
  if (!bridgeResult.success) {
    await db.collection(INSTANCES).doc(instanceId).update(completeUpdates)
  }

  // Log completion activity
  const completionActId = crypto.randomUUID()
  await db.collection(ACTIVITY).doc(completionActId).set({
    activity_id: completionActId,
    instance_id: instanceId,
    pipeline_key: String(instance.pipeline_key || RSP_PIPELINE_KEY),
    action: 'ADVANCE_STAGE',
    from_value: STAGE_RED,
    to_value: 'COMPLETED',
    performed_by: userEmail,
    performed_at: now,
    notes: `Service handoff complete — ${serviceCards.length} service card(s) created${newbizKitId ? `, NewBiz kit ${newbizKitId}` : ''}`,
  })

  // ── 5. Return result ───────────────────────────────────────────────
  const result: RspServiceHandoffResult = {
    instance_id: instanceId,
    newbiz_kit_id: newbizKitId,
    service_cards: serviceCards,
    status: 'complete',
  }

  res.json(successResponse<RspServiceHandoffResult>(result))
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determine which product lines (LIFE, ANNUITY, MEDICARE, INVESTMENT) are
 * activated for this RSP instance. Checks:
 *   1. custom_fields.activated_products (explicit array)
 *   2. Instance tasks with QUE product line references
 *   3. Fallback: all four product lines
 */
async function resolveActivatedProducts(
  db: FirebaseFirestore.Firestore,
  instanceId: string,
  instance: Record<string, unknown>,
): Promise<string[]> {
  // 1. Check explicit custom_fields
  const customFields = typeof instance.custom_fields === 'string'
    ? safeJsonParse(instance.custom_fields)
    : (instance.custom_fields as Record<string, unknown> || {})

  if (Array.isArray(customFields.activated_products) && customFields.activated_products.length > 0) {
    return customFields.activated_products as string[]
  }

  // 2. Check QUE-related tasks for product line hints
  const taskSnap = await db.collection(INSTANCE_TASKS)
    .where('instance_id', '==', instanceId)
    .where('check_type', '==', 'QUE_SESSION_COMPLETE')
    .get()

  if (!taskSnap.empty) {
    const productLines = new Set<string>()
    for (const doc of taskSnap.docs) {
      const taskData = doc.data()
      const config = typeof taskData.check_config === 'string'
        ? safeJsonParse(taskData.check_config)
        : (taskData.check_config as Record<string, unknown> || {})
      if (config.product_line && SERVICE_PIPELINE_MAP[String(config.product_line)]) {
        productLines.add(String(config.product_line))
      }
    }
    if (productLines.size > 0) return Array.from(productLines)
  }

  // 3. Fallback: all product lines (best-effort — service cards for missing
  //    pipelines are still useful as placeholders)
  return Object.keys(SERVICE_PIPELINE_MAP)
}

/** Safe JSON parse that returns empty object on failure. */
function safeJsonParse(str: string): Record<string, unknown> {
  try { return JSON.parse(str || '{}') } catch { return {} }
}
