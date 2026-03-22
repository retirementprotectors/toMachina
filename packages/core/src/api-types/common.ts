/**
 * Common API response types — shared by all route groups.
 * These describe the envelope that wraps every API response,
 * NOT the domain-specific payload (that's in the group files).
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/** What every API call returns over the wire. */
export interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  error?: string
  pagination?: PaginatedMeta
}

/** Cursor-based pagination metadata returned by list endpoints. */
export interface PaginatedMeta {
  count: number
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
}

// ---------------------------------------------------------------------------
// Generic mutation results (used across many route groups)
// ---------------------------------------------------------------------------

/** Standard result for DELETE endpoints. */
export interface DeleteResult {
  id: string
  deleted: true
}

/** Standard result for bulk-update / batch endpoints. */
export interface BulkUpdateResult {
  updated: number
  errors?: string[]
}

/** Standard result for create endpoints that return only the new ID. */
export interface CreateResult {
  id: string
  created_at: string
}
