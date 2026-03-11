import { type Request } from 'express'
import { getFirestore, type Query, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore'

/**
 * Standard API response wrapper
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true as const, data, ...meta }
}

export function errorResponse(error: string, statusCode?: number) {
  return { success: false as const, error, statusCode }
}

type OrderDir = 'asc' | 'desc'

export interface PaginationParams {
  limit: number
  startAfter: string | null
  orderBy: string | null
  orderDir: OrderDir
}

/**
 * Parse pagination params from request query.
 * Uses Firestore cursor-based pagination (startAfter doc ID).
 */
export function getPaginationParams(req: Request): PaginationParams {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100)
  const startAfter = (req.query.startAfter as string) || null
  const orderBy = (req.query.orderBy as string) || null
  const orderDir: OrderDir = (req.query.orderDir as string) === 'asc' ? 'asc' : 'desc'
  return { limit, startAfter, orderBy, orderDir }
}

/**
 * Apply cursor-based pagination to a Firestore query.
 * Returns paginated results with a nextCursor for the next page.
 */
export async function paginatedQuery(
  baseQuery: Query<DocumentData>,
  collection: string,
  params: PaginationParams
) {
  const db = getFirestore()
  let query = baseQuery

  // Apply ordering
  const sortField = params.orderBy || 'created_at'
  query = query.orderBy(sortField, params.orderDir)

  // Apply cursor
  if (params.startAfter) {
    const cursorDoc = await db.collection(collection).doc(params.startAfter).get()
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc)
    }
  }

  // Fetch one extra to check if there's a next page
  const snapshot = await query.limit(params.limit + 1).get()
  const docs = snapshot.docs.slice(0, params.limit)
  const hasMore = snapshot.docs.length > params.limit

  const data: Record<string, unknown>[] = docs.map((doc: DocumentSnapshot) => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
  const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null

  return {
    data,
    pagination: {
      count: data.length,
      hasMore,
      nextCursor,
    },
  }
}

/**
 * Validate required fields in request body.
 * Returns null if valid, or an error message string.
 */
export function validateRequired(body: Record<string, unknown>, fields: string[]): string | null {
  const missing = fields.filter(f => body[f] == null || body[f] === '')
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`
  }
  return null
}

/**
 * Get the bridge service URL for write operations.
 */
export function getBridgeUrl(): string {
  return process.env.BRIDGE_URL || 'http://localhost:8081'
}

/**
 * Forward a write operation through the bridge service.
 * The bridge handles dual-write to Firestore + Sheets.
 */
export async function writeThroughBridge(
  collection: string,
  operation: 'insert' | 'update' | 'delete',
  id: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const bridgeUrl = getBridgeUrl()

  try {
    const response = await fetch(`${bridgeUrl}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection, operation, id, data }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return { success: false, error: `Bridge error: ${response.status} — ${errBody}` }
    }

    return await response.json() as { success: boolean; error?: string }
  } catch (_err) {
    // Bridge unavailable — caller will fall back to direct Firestore write.
    // This means Sheets will NOT get the update until bridge is online.
    console.warn(`[BRIDGE FALLBACK] Write to ${collection}/${id} went direct to Firestore — Sheets NOT synced`)
    return { success: false, error: 'bridge_unavailable' }
  }
}

/**
 * Extract a route param as a string.
 * Express v5 types allow string | string[] for params — this normalizes.
 */
export function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || ''
  return val || ''
}

/**
 * Strip internal/metadata fields before returning to client.
 */
export function stripInternalFields(doc: Record<string, unknown>): Record<string, unknown> {
  const result = { ...doc }
  delete result._migrated_at
  delete result._source
  return result
}
