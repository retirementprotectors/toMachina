import { getFirestore } from 'firebase-admin/firestore'

/**
 * Guardian Lineage Logger
 * Logs every write that passes through the Write Gate to the guardian_writes
 * Firestore collection. Fire-and-forget — never blocks the request.
 */

export interface LineageEntry {
  timestamp: string
  collection: string
  doc_id: string
  operation: 'create' | 'update' | 'delete'
  agent_session_id: string
  source_script: string
  user_email: string
  fields_modified: string[]
  doc_count: number
  validation_passed: boolean
  schema_errors: string[]
}

/**
 * Log a write operation to guardian_writes. Fire-and-forget.
 * Errors are silently swallowed — lineage logging must NEVER break a request.
 */
export function logWriteLineage(entry: LineageEntry): void {
  const db = getFirestore()
  db.collection('guardian_writes')
    .add(entry)
    .catch(() => {
      // Silently swallow — lineage logging must never break a request
    })
}
