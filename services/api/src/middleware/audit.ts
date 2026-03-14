import { type Request, type Response, type NextFunction } from 'express'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Audit middleware — auto-logs every mutation (POST/PUT/PATCH/DELETE)
 * to Firestore activity collections. Fire-and-forget, non-blocking.
 *
 * Writes to:
 *   - `activities` (top-level global audit trail)
 *   - `clients/{clientId}/activities` (client-scoped, if client_id can be determined)
 *
 * PHI SAFETY: Only field NAMES are recorded in `changes`, NEVER values.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only audit mutations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next()
  }

  const originalJson = res.json.bind(res)

  res.json = function (body: unknown) {
    // Fire and forget — don't slow down the response
    const typedBody = body as Record<string, unknown> | null
    if (typedBody?.success && res.statusCode < 400) {
      logActivity(req, typedBody).catch(() => {
        // Silently swallow audit failures — never break the request
      })
    }
    return originalJson(body)
  } as typeof res.json

  next()
}

/**
 * Log an activity record to Firestore.
 * Writes to both the top-level `activities` collection and,
 * if a client_id can be determined, to the client's subcollection.
 */
async function logActivity(req: Request, _responseBody: Record<string, unknown>): Promise<void> {
  const db = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth middleware attaches user to req
  const user = (req as any).user as Record<string, unknown> | undefined
  const userEmail = (user?.email as string) || 'system'
  const now = new Date().toISOString()

  // Parse the route to determine entity type and ID
  // Pattern: /api/{collection}/{id} or /api/{collection}/{parentId}/{sub}/{subId}
  const pathParts = req.path.split('/').filter(Boolean) // e.g. ['api', 'clients', 'abc123']
  const entityType = pathParts[1] || 'unknown'
  const entityId = pathParts[2] || ''

  // Determine activity type from HTTP method
  const methodMap: Record<string, string> = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  }
  const action = methodMap[req.method] || 'unknown'
  const activityType = `${entityType}_${action}` // e.g. 'clients_update'

  // Build description
  const description = buildDescription(action, entityType, req.body as Record<string, unknown> | undefined)

  const activity: Record<string, unknown> = {
    activity_id: '', // set after creation
    activity_type: activityType,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    user_email: userEmail,
    user_name: (user?.name as string) || userEmail.split('@')[0],
    method: req.method,
    path: req.path,
    changes: sanitizeChanges(req.body as Record<string, unknown> | undefined),
    created_at: now,
  }

  // Write to top-level activities collection
  const topRef = await db.collection('activities').add(activity)
  activity.activity_id = topRef.id

  // If we can determine a client_id, also write to client's subcollection
  const clientId = extractClientId(req.path, req.body as Record<string, unknown> | undefined)
  if (clientId) {
    await db.collection('clients').doc(clientId).collection('activities').add({
      ...activity,
      client_id: clientId,
    })
  }
}

/**
 * Return ONLY field names from the request body — NEVER values.
 * This ensures PHI is never stored in audit records.
 */
function sanitizeChanges(body: Record<string, unknown> | undefined): string[] {
  if (!body || typeof body !== 'object') return []
  return Object.keys(body).filter(k => !k.startsWith('_'))
}

/**
 * Build a human-readable description of the activity.
 * Uses field names only — no values.
 */
function buildDescription(action: string, entityType: string, body?: Record<string, unknown>): string {
  const entity = entityType.replace(/-/g, ' ').replace(/s$/, '') // 'clients' -> 'client'
  switch (action) {
    case 'create':
      return `Created ${entity}`
    case 'update': {
      const allKeys = body ? Object.keys(body).filter(k => !k.startsWith('_')) : []
      const fields = allKeys.slice(0, 5)
      return fields.length > 0
        ? `Updated ${entity}: ${fields.join(', ')}${fields.length < allKeys.length ? '...' : ''}`
        : `Updated ${entity}`
    }
    case 'delete':
      return `Deleted ${entity}`
    default:
      return `${action} ${entity}`
  }
}

/**
 * Extract client_id from request path or body.
 * Supports multiple route patterns.
 */
function extractClientId(path: string, body?: Record<string, unknown>): string | null {
  const parts = path.split('/').filter(Boolean)
  // /api/clients/{clientId}... -> parts[2]
  if (parts[1] === 'clients' && parts[2]) return parts[2]
  // /api/access/{clientId}... -> parts[2]
  if (parts[1] === 'access' && parts[2]) return parts[2]
  // /api/accounts — check body for client_id
  if (body?.client_id && typeof body.client_id === 'string') return body.client_id
  return null
}
