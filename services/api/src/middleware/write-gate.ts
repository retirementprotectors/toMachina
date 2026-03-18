import { type Request, type Response, type NextFunction } from 'express'
import {
  PROTECTED_COLLECTIONS,
  validateSchema,
} from '@tomachina/core'
import { logWriteLineage } from '../lib/guardian-lineage.js'

/**
 * Write Gate Middleware — Guardian Data Protection Engine
 *
 * Wraps ALL POST/PUT/PATCH/DELETE to protected collections.
 * Enforces:
 *   1. Lineage metadata attachment (agent_session_id, source_script, user_email)
 *   2. Bulk write check (>10 items without x-bulk-approved header → 403)
 *   3. Schema validation (required on create, neverNull + immutable on update)
 *   4. Fire-and-forget lineage logging to guardian_writes
 */
export function writeGate(req: Request, res: Response, next: NextFunction): void {
  // Only gate mutation methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next()
    return
  }

  // Determine collection from path: /api/{collection}/...
  const pathParts = req.path.split('/').filter(Boolean) // e.g. ['clients', 'abc123']
  const collection = pathParts[0] || ''

  // Only gate protected collections
  if (!PROTECTED_COLLECTIONS.includes(collection)) {
    next()
    return
  }

  // Extract lineage metadata from headers
  const agentSessionId = (req.headers['x-agent-session-id'] as string) || ''
  const sourceScript = (req.headers['x-source-script'] as string) || req.path
  const userEmail =
    ((req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email) || 'api'
  const now = new Date().toISOString()

  // Bulk write check: if body is array with >10 items and no approval header → 403
  const body = req.body as unknown
  if (Array.isArray(body) && body.length > 10) {
    const bulkApproved = req.headers['x-bulk-approved'] as string
    if (!bulkApproved) {
      res.status(403).json({
        success: false,
        error: `Bulk write blocked: ${body.length} items exceeds threshold of 10. Set x-bulk-approved header to proceed.`,
      })
      return
    }
  }

  // Schema validation
  const isCreate = req.method === 'POST'
  const docBody = (Array.isArray(body) ? undefined : body) as Record<string, unknown> | undefined

  if (docBody && typeof docBody === 'object') {
    const errors = validateSchema(collection, docBody, isCreate)
    if (errors.length > 0) {
      // Log the failed write attempt
      logWriteLineage({
        timestamp: now,
        collection,
        doc_id: pathParts[1] || 'new',
        operation: isCreate ? 'create' : 'update',
        agent_session_id: agentSessionId,
        source_script: sourceScript,
        user_email: userEmail,
        fields_modified: Object.keys(docBody),
        doc_count: 1,
        validation_passed: false,
        schema_errors: errors,
      })

      res.status(400).json({
        success: false,
        error: 'Schema validation failed',
        violations: errors,
      })
      return
    }
  }

  // Log the write (fire-and-forget, non-blocking)
  const docCount = Array.isArray(body) ? (body as unknown[]).length : 1
  const fieldsModified = docBody ? Object.keys(docBody) : []

  logWriteLineage({
    timestamp: now,
    collection,
    doc_id: pathParts[1] || 'new',
    operation: isCreate ? 'create' : req.method === 'DELETE' ? 'delete' : 'update',
    agent_session_id: agentSessionId,
    source_script: sourceScript,
    user_email: userEmail,
    fields_modified: fieldsModified,
    doc_count: docCount,
    validation_passed: true,
    schema_errors: [],
  })

  next()
}
