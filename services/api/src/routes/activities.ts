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
