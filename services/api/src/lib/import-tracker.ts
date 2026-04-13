import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportRunRecord {
  run_id: string
  wire_id?: string
  import_type: string
  source: string
  status: 'running' | 'completed' | 'failed' | 'partial'
  total_records: number
  imported: number
  skipped: number
  duplicates: number
  errors: number
  total_amount?: number
  error_details: Array<{ index: number; error: string }>
  triggered_by: string
  started_at: string
  completed_at?: string
  duration_ms?: number
}

export interface StartImportRunParams {
  wire_id?: string
  import_type: string
  source: string
  total_records: number
  triggered_by: string
}

export interface CompleteImportRunParams {
  imported: number
  skipped: number
  duplicates: number
  errors: number
  total_amount?: number
  error_details: Array<{ index: number; error: string }>
  status?: 'completed' | 'failed' | 'partial'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORT_RUNS_COLLECTION = 'import_runs'
const SOURCE_COLLECTION = 'source_registry'

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Start a new import run. Returns the run_id for tracking.
 */
export async function startImportRun(params: StartImportRunParams): Promise<string> {
  const db = getFirestore()
  const runId = `RUN_${randomUUID().slice(0, 12)}`
  const now = new Date().toISOString()

  const record: ImportRunRecord = {
    run_id: runId,
    wire_id: params.wire_id,
    import_type: params.import_type,
    source: params.source,
    status: 'running',
    total_records: params.total_records,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    errors: 0,
    error_details: [],
    triggered_by: params.triggered_by,
    started_at: now,
  }

  await db.collection(IMPORT_RUNS_COLLECTION).doc(runId).set(record)
  return runId
}

/**
 * Complete an import run with results. Also auto-updates source_registry
 * last_import metadata if a matching source is found.
 */
export async function completeImportRun(
  runId: string,
  results: CompleteImportRunParams
): Promise<void> {
  const db = getFirestore()
  const now = new Date().toISOString()
  const docRef = db.collection(IMPORT_RUNS_COLLECTION).doc(runId)
  const doc = await docRef.get()

  if (!doc.exists) {
    console.warn(`[IMPORT_TRACKER] Run ${runId} not found — skipping completion`)
    return
  }

  const existing = doc.data() as ImportRunRecord
  const startedAt = existing.started_at ? new Date(existing.started_at).getTime() : Date.now()
  const durationMs = Date.now() - startedAt

  // Determine status: if caller didn't specify, infer from results
  let status: ImportRunRecord['status'] = results.status || 'completed'
  if (!results.status) {
    if (results.errors > 0 && results.imported === 0) {
      status = 'failed'
    } else if (results.errors > 0 && results.imported > 0) {
      status = 'partial'
    }
  }

  // Trim error_details to 100 max
  const errorDetails = results.error_details.length > 100
    ? results.error_details.slice(0, 100)
    : results.error_details

  const updates: Partial<ImportRunRecord> = {
    status,
    imported: results.imported,
    skipped: results.skipped,
    duplicates: results.duplicates,
    errors: results.errors,
    total_amount: results.total_amount,
    error_details: errorDetails,
    completed_at: now,
    duration_ms: durationMs,
  }

  await docRef.update(updates)

  // Auto-update source_registry if we can match the source
  try {
    await updateSourceRegistryFromRun(existing.source, status, now)
  } catch (err) {
    // Non-critical — log but don't fail the completion
    console.warn(`[IMPORT_TRACKER] Failed to update source_registry for ${existing.source}:`, err)
  }
}

/**
 * Get recent import runs, optionally filtered by import_type.
 */
export async function getRecentRuns(
  limit: number = 20,
  importType?: string
): Promise<ImportRunRecord[]> {
  const db = getFirestore()
  let query = db.collection(IMPORT_RUNS_COLLECTION)
    .orderBy('started_at', 'desc') as FirebaseFirestore.Query

  if (importType) {
    query = query.where('import_type', '==', importType)
  }

  const snap = await query.limit(Math.min(limit, 100)).get()
  return snap.docs.map(d => ({ ...d.data() } as ImportRunRecord))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Try to find a source_registry entry matching the import source name,
 * and update its last_import_at + last_import_status fields.
 */
async function updateSourceRegistryFromRun(
  source: string,
  status: ImportRunRecord['status'],
  timestamp: string
): Promise<void> {
  const db = getFirestore()

  // Try matching by carrier or source_name
  const queries = [
    db.collection(SOURCE_COLLECTION).where('carrier', '==', source).limit(1),
    db.collection(SOURCE_COLLECTION).where('source_name', '==', source).limit(1),
  ]

  for (const query of queries) {
    const snap = await query.get()
    if (!snap.empty) {
      const docRef = snap.docs[0].ref
      await docRef.update({
        last_import_at: timestamp,
        last_import_status: status,
        updated_at: timestamp,
      })
      return
    }
  }
}
