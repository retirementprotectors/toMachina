import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  param,
} from '../lib/helpers.js'

export const activityRoutes = Router()

/**
 * GET /api/activities
 * List recent activities (top-level global audit trail, paginated).
 * Optional filter: ?entityType=clients
 */
activityRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    const entityTypeFilter = (req.query.entityType as string) || ''

    if (!params.orderBy) params.orderBy = 'created_at'
    if (!req.query.orderDir) params.orderDir = 'desc'

    let query = db.collection('activities') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>

    if (entityTypeFilter) {
      query = query.where('entity_type', '==', entityTypeFilter)
    }

    const result = await paginatedQuery(query, 'activities', params)
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/activities error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/activities/client/:clientId
 * List activities for a specific client (from subcollection).
 */
activityRoutes.get('/client/:clientId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)
    const params = getPaginationParams(req)

    if (!params.orderBy) params.orderBy = 'created_at'
    if (!req.query.orderDir) params.orderDir = 'desc'

    const collectionPath = `clients/${clientId}/activities`
    const query = db.collection('clients').doc(clientId).collection('activities') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>

    const result = await paginatedQuery(query, collectionPath, params)
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/activities/client/:clientId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/activities
 * Log a manual activity (for UI-only events that aren't captured by middleware).
 */
activityRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth middleware attaches user to req
    const user = (req as any).user as Record<string, unknown> | undefined
    const userEmail = (user?.email as string) || 'system'
    const now = new Date().toISOString()

    const { activity_type, description, client_id, entity_type, entity_id } = req.body as Record<string, string | undefined>

    if (!activity_type || !description) {
      res.status(400).json(errorResponse('Missing required fields: activity_type, description'))
      return
    }

    const activity: Record<string, unknown> = {
      activity_id: '',
      activity_type,
      description,
      entity_type: entity_type || 'manual',
      entity_id: entity_id || '',
      action: 'manual',
      user_email: userEmail,
      user_name: (user?.name as string) || userEmail.split('@')[0],
      method: 'POST',
      path: '/api/activities',
      changes: [],
      created_at: now,
    }

    // Write to top-level activities collection
    const topRef = await db.collection('activities').add(activity)
    activity.activity_id = topRef.id

    // If client_id provided, also write to client's subcollection
    if (client_id) {
      await db.collection('clients').doc(client_id).collection('activities').add({
        ...activity,
        client_id,
      })
    }

    res.status(201).json(successResponse(activity))
  } catch (err) {
    console.error('POST /api/activities error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/activities/household/:householdId
 * Merge-sorted activity feed across all household members.
 */
activityRoutes.get('/household/:householdId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const householdId = param(req.params.householdId)

    // Look up household to get member list
    const householdDoc = await db.collection('households').doc(householdId).get()
    if (!householdDoc.exists) {
      res.status(404).json(errorResponse('Household not found'))
      return
    }

    const hhData = householdDoc.data() as Record<string, unknown>
    const members = (hhData.members || []) as Array<{ client_id: string; client_name?: string }>

    if (members.length === 0) {
      res.json(successResponse([]))
      return
    }

    // Query each member's activities subcollection (limit 50 per member)
    const allActivities: Array<Record<string, unknown>> = []

    await Promise.all(
      members.map(async (member) => {
        try {
          const snap = await db
            .collection('clients')
            .doc(member.client_id)
            .collection('activities')
            .orderBy('created_at', 'desc')
            .limit(50)
            .get()

          for (const d of snap.docs) {
            allActivities.push({
              id: d.id,
              ...d.data(),
              member_name: member.client_name || member.client_id,
              member_client_id: member.client_id,
            })
          }
        } catch {
          // Skip members with no activities subcollection
        }
      })
    )

    // Merge-sort by created_at desc, take top 100
    allActivities.sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    )

    res.json(successResponse(allActivities.slice(0, 100)))
  } catch (err) {
    console.error('GET /api/activities/household/:householdId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
