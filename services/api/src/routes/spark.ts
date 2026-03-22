import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
} from '../lib/helpers.js'
import type { SparkHealthData, SparkStatusData, SparkWebhookResult } from '@tomachina/core'
import { randomUUID } from 'crypto'

export const sparkRoutes = Router()

// ============================================================================
// HEALTH CHECK (no auth required for webhook verification)
// ============================================================================

/**
 * GET /api/spark/test
 * Health check for SPARK webhook URL verification
 */
sparkRoutes.get('/test', (_req: Request, res: Response) => {
  res.json(successResponse<unknown>({
    message: 'SPARK webhook handler active',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  }))
})

// ============================================================================
// WEBHOOK STATUS
// ============================================================================

/**
 * GET /api/spark/status
 * Get last events and sync stats
 */
sparkRoutes.get('/status', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const configDoc = await db.collection('spark_config').doc('status').get()
    const config = configDoc.exists ? configDoc.data() : {}

    res.json(successResponse<unknown>({
      last_events: config?.last_events || [],
      stats: config?.stats || { total: 0, contacts: 0, policies: 0, soas: 0 },
      webhook_active: true,
      version: '2.0.0',
    }))
  } catch (err) {
    console.error('GET /api/spark/status error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * POST /api/spark/webhook
 * Receive SPARK webhook events
 *
 * SPARK pushes: CONTACT_CREATED, CONTACT_UPDATED, NEEDS_ASSESSMENT_COMPLETED,
 * POLICY_CREATED, POLICY_UPDATED, SOA_CREATED, SOA_UPDATED
 */
sparkRoutes.post('/webhook', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const payload = req.body

    const eventType = payload?.metadata?.event_type || 'UNKNOWN'
    const sparkContactId = payload?.unique_id || ''
    const timestamp = payload?.timestamp || new Date().toISOString()

    // Log the event
    await logSparkEvent(db, eventType, sparkContactId, timestamp)

    // Route by event type
    let result: Record<string, unknown>

    switch (eventType) {
      case 'CONTACT_CREATED':
      case 'CONTACT_UPDATED':
        result = await syncContact(db, payload)
        break
      case 'POLICY_CREATED':
      case 'POLICY_UPDATED':
        result = await syncPolicy(db, payload)
        break
      case 'SOA_CREATED':
      case 'SOA_UPDATED':
        result = await syncSOA(db, payload)
        break
      case 'NEEDS_ASSESSMENT_COMPLETED':
        result = await syncNeedsAssessment(db, payload)
        break
      default:
        result = { action: 'ignored', event_type: eventType }
    }

    res.json(successResponse<unknown>({
      event_type: eventType,
      spark_contact_id: sparkContactId,
      result,
    }))
  } catch (err) {
    console.error('POST /api/spark/webhook error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// Also accept POST to /api/spark directly (shorthand)
sparkRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const payload = req.body

    const eventType = payload?.metadata?.event_type || 'UNKNOWN'
    const sparkContactId = payload?.unique_id || ''
    const timestamp = payload?.timestamp || new Date().toISOString()

    await logSparkEvent(db, eventType, sparkContactId, timestamp)

    let result: Record<string, unknown>
    switch (eventType) {
      case 'CONTACT_CREATED':
      case 'CONTACT_UPDATED':
        result = await syncContact(db, payload)
        break
      case 'POLICY_CREATED':
      case 'POLICY_UPDATED':
        result = await syncPolicy(db, payload)
        break
      case 'SOA_CREATED':
      case 'SOA_UPDATED':
        result = await syncSOA(db, payload)
        break
      case 'NEEDS_ASSESSMENT_COMPLETED':
        result = await syncNeedsAssessment(db, payload)
        break
      default:
        result = { action: 'ignored', event_type: eventType }
    }

    res.json(successResponse<unknown>({ event_type: eventType, spark_contact_id: sparkContactId, result }))
  } catch (err) {
    console.error('POST /api/spark error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

async function syncContact(
  db: FirebaseFirestore.Firestore,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const details = (payload.details || {}) as Record<string, unknown>
  const phi = (payload.phi || {}) as Record<string, unknown>
  const address = (details.home_address || {}) as Record<string, unknown>
  const agent = (details.agent || {}) as Record<string, unknown>

  const clientData: Record<string, unknown> = {
    first_name: details.first_name || '',
    last_name: details.last_name || '',
    middle_name: details.middle_name || '',
    preferred_name: details.preferred_name || '',
    gender: details.sex || details.gender || '',
    phone: details.home_phone || '',
    cell_phone: details.mobile_phone || '',
    email: details.email || '',
    address: address.street || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.postal_code || '',
    county: address.county || '',
    dob: phi.dob || '',
    medicare_number: phi.mbi || '',
    spark_contact_id: details.id || payload.unique_id || '',
    spark_contact_stage: details.contact_stage || '',
    spark_agent_npn: agent.npn || '',
    spark_agent_name: agent.full_name || '',
    spark_last_sync: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const sparkId = clientData.spark_contact_id as string

  // Find existing by spark_contact_id
  const existingSnap = await db
    .collection('clients')
    .where('spark_contact_id', '==', sparkId)
    .limit(1)
    .get()

  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0]
    await existingDoc.ref.update(clientData)
    await writeThroughBridge('clients', 'update', existingDoc.id, clientData)
    return { action: 'updated', client_id: existingDoc.id }
  }

  // Create new
  const clientId = randomUUID()
  clientData.client_id = clientId
  clientData.created_at = new Date().toISOString()

  await db.collection('clients').doc(clientId).set(clientData)
  await writeThroughBridge('clients', 'insert', clientId, clientData)

  return { action: 'created', client_id: clientId }
}

async function syncPolicy(
  db: FirebaseFirestore.Firestore,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const details = (payload.details || {}) as Record<string, unknown>
  const phi = (payload.phi || {}) as Record<string, unknown>
  const policies = (phi.policies || {}) as Record<string, unknown>
  const sparkContactId = (details.id as string) || (payload.unique_id as string) || ''

  // Find client by spark_contact_id
  const clientSnap = await db
    .collection('clients')
    .where('spark_contact_id', '==', sparkContactId)
    .limit(1)
    .get()

  if (clientSnap.empty) {
    return { error: `Client not found for spark_contact_id: ${sparkContactId}` }
  }

  const clientDoc = clientSnap.docs[0]
  let synced = 0

  for (const category of ['active', 'pending']) {
    const categoryPolicies = (policies[category] || {}) as Record<string, unknown>
    for (let i = 1; i <= 4; i++) {
      const policy = categoryPolicies[`policy_${i}`] as Record<string, unknown> | undefined
      if (!policy || !policy.name) continue

      const accountData: Record<string, unknown> = {
        client_id: clientDoc.id,
        carrier_name: policy.carrier || '',
        plan_name: policy.name || '',
        plan_bid_id: policy.bid_id || '',
        core_product_type: policy.product_type || '',
        effective_date: policy.effective_date || '',
        status: category === 'active' ? 'Active' : 'Pending',
        spark_policy_id: policy.policy_id || '',
        spark_contact_id: sparkContactId,
        spark_last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const accountId = randomUUID()
      accountData.account_id = accountId
      accountData.created_at = new Date().toISOString()

      await clientDoc.ref.collection('accounts').doc(accountId).set(accountData)
      synced++
    }
  }

  // Update client sync timestamp
  await clientDoc.ref.update({ spark_last_sync: new Date().toISOString() })

  return { action: 'synced', policies_synced: synced }
}

async function syncSOA(
  db: FirebaseFirestore.Firestore,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const details = (payload.details || {}) as Record<string, unknown>
  const sparkContactId = (details.id as string) || (payload.unique_id as string) || ''

  const clientSnap = await db
    .collection('clients')
    .where('spark_contact_id', '==', sparkContactId)
    .limit(1)
    .get()

  if (clientSnap.empty) {
    return { error: 'Client not found' }
  }

  const clientDoc = clientSnap.docs[0]
  await clientDoc.ref.update({
    soa_signed: details.soa_is_signed || false,
    soa_signed_at: details.soa_signed_at || '',
    spark_last_sync: new Date().toISOString(),
  })

  return { action: 'updated', client_id: clientDoc.id }
}

async function syncNeedsAssessment(
  db: FirebaseFirestore.Firestore,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const details = (payload.details || {}) as Record<string, unknown>
  const sparkContactId = (details.id as string) || (payload.unique_id as string) || ''

  const clientSnap = await db
    .collection('clients')
    .where('spark_contact_id', '==', sparkContactId)
    .limit(1)
    .get()

  if (clientSnap.empty) {
    return { error: 'Client not found' }
  }

  const clientDoc = clientSnap.docs[0]
  await clientDoc.ref.update({
    spark_contact_stage: 'NEEDS_ASSESSMENT_COMPLETED',
    spark_needs_assessment_link: details.needs_assessment_link || '',
    spark_last_sync: new Date().toISOString(),
  })

  return { action: 'updated', client_id: clientDoc.id }
}

// ============================================================================
// LOGGING
// ============================================================================

async function logSparkEvent(
  db: FirebaseFirestore.Firestore,
  eventType: string,
  sparkContactId: string,
  timestamp: string
) {
  try {
    const statusRef = db.collection('spark_config').doc('status')
    const statusDoc = await statusRef.get()
    const current = statusDoc.exists ? statusDoc.data() || {} : {}

    // Rolling event log (last 20)
    const events = (current.last_events || []) as Array<Record<string, unknown>>
    events.unshift({
      event_type: eventType,
      spark_contact_id: sparkContactId,
      timestamp,
      received_at: new Date().toISOString(),
    })
    if (events.length > 20) events.splice(20)

    // Stats counter
    const stats = (current.stats || {}) as Record<string, number>
    stats.total = (stats.total || 0) + 1
    if (eventType.includes('CONTACT')) stats.contacts = (stats.contacts || 0) + 1
    if (eventType.includes('POLICY')) stats.policies = (stats.policies || 0) + 1
    if (eventType.includes('SOA')) stats.soas = (stats.soas || 0) + 1
    if (eventType.includes('NEEDS')) stats.assessments = (stats.assessments || 0) + 1

    await statusRef.set({ last_events: events, stats }, { merge: true })
  } catch (_err) {
    // Non-fatal — webhook processing should not fail due to logging
  }
}
