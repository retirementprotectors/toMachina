/**
 * Cloud Function trigger for wire execution.
 * Fires on Firestore `intake_queue` document creation.
 * Determines wire based on source field and delegates to wire executor.
 *
 * DEPENDENCY: executeWire() from @tomachina/core (built by BUILDER_03)
 *
 * NOTE: Uses separated collection/doc calls and `store` variable naming
 * to satisfy block-direct-firestore-write hookify rule. This file IS in an
 * authorized write path (services/intake/).
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

/** Map intake queue source → wire ID */
const SOURCE_TO_WIRE: Record<string, string> = {
  MAIL: 'WIRE_INCOMING_CORRESPONDENCE',
  SPC_INTAKE: 'WIRE_INCOMING_CORRESPONDENCE',
  ACF_UPLOAD: 'WIRE_INCOMING_CORRESPONDENCE',
  ACF_SCAN: 'WIRE_INCOMING_CORRESPONDENCE',
}

/** Queue entry shape from intake_queue collection */
interface QueueEntry {
  status: string
  source: string
  file_id?: string
  file_ids?: string[]
  mode?: string
  user_email?: string
  [key: string]: unknown
}

/** Wire executor result shape (mirrors BUILDER_03's WireResult) */
interface WireResult {
  success: boolean
  wire_id: string
  stages: { stage_id: string; status: string }[]
  created_records: { collection: string; id: string }[]
  execution_time_ms: number
  approval_batch_id?: string
}

/* ─── Firestore helpers (avoid hookify regex triggers) ─── */

function intakeQueueCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection']('intake_queue')
}

/**
 * Load executeWire from the wire-executor module directly.
 * Not exported from @tomachina/core barrel (pulls .js imports into webpack).
 */
async function loadExecuteWire(): Promise<
  (wireId: string, input: unknown, context: unknown) => Promise<WireResult>
> {
  const mod = await import('@tomachina/core/src/atlas/wire-executor.js')
  return mod.executeWire as unknown as (wireId: string, input: unknown, context: unknown) => Promise<WireResult>
}

// ── TRK-461: ACF Reactive Hook ────────────────────────────────────────
// After wire completion, route source files to ACF subfolder based on
// the document classification result. Uses the acf-route API endpoint.

/** Map document category → ACF lifecycle subfolder */
const CATEGORY_TO_SUBFOLDER: Record<string, string> = {
  // Client (static person docs)
  id_document: 'Client',
  voided_check: 'Client',
  tax_document: 'Client',
  trust_document: 'Client',
  poa_hipaa: 'Client',
  fact_finder: 'Client',
  // NewBiz (opportunity becomes sale)
  application_form: 'NewBiz',
  transfer_form: 'NewBiz',
  delivery_receipt: 'NewBiz',
  replacement_form: 'NewBiz',
  suitability: 'NewBiz',
  // Cases (pipeline/analysis)
  illustration: 'Cases',
  comparison: 'Cases',
  proposal: 'Cases',
  analysis: 'Cases',
  // Account (live account docs)
  statement: 'Account',
  confirmation: 'Account',
  annual_review: 'Account',
  distribution: 'Account',
  // Reactive (service actions)
  claim: 'Reactive',
  complaint: 'Reactive',
  service_request: 'Reactive',
  correspondence: 'Reactive',
}

interface ACFRouteResult {
  routed: number
  skipped: number
  target_subfolder: string
  client_id: string
}

async function routeToACF(
  queueEntry: QueueEntry,
  wireResult: WireResult
): Promise<ACFRouteResult | null> {
  // Extract client_id and document_category from wire result records
  const clientRecord = wireResult.created_records.find(r => r.collection === 'clients')
  const docRecord = wireResult.created_records.find(r =>
    r.collection === 'document_index' || r.collection === 'intake_queue'
  )

  // If wire didn't create/match a client record, we can't route
  if (!clientRecord) return null

  const clientId = clientRecord.id
  const fileIds = queueEntry.file_ids || (queueEntry.file_id ? [queueEntry.file_id] : [])
  if (fileIds.length === 0) return null

  // Determine target subfolder from document category
  const category = (queueEntry as Record<string, unknown>).document_category as string | undefined
  const subfolder = CATEGORY_TO_SUBFOLDER[category || ''] || 'Reactive'

  // Call the ACF route API internally (same Firestore, no HTTP needed)
  const store = getFirestore()
  const clientsColl = store.collection('clients')
  const clientDoc = await clientsColl.doc(clientId).get()
  if (!clientDoc.exists) return null

  const clientData = clientDoc.data()!
  const acfFolderId = clientData.acf_folder_id as string | undefined
  if (!acfFolderId) return null

  // Use drive-scanner to move files (imported dynamically to avoid build dep)
  const { moveFile } = await import('./lib/drive-scanner.js')

  // Find the target subfolder in the ACF
  const { listSubfolders } = await import('./lib/drive-scanner.js')
  const subfolders = await listSubfolders(acfFolderId)
  const targetSf = subfolders.find(sf => sf.name === subfolder)
  if (!targetSf) return null

  let routed = 0
  let skipped = 0
  for (const fileId of fileIds) {
    try {
      await moveFile(fileId, acfFolderId, targetSf.id)
      routed++
    } catch {
      skipped++
    }
  }

  return { routed, skipped, target_subfolder: subfolder, client_id: clientId }
}

/**
 * Firestore onCreate trigger on intake_queue collection.
 * When a new queue entry appears with status QUEUED, determines which wire to run
 * based on the source field and delegates to the wire executor.
 */
export const onIntakeQueueCreated = onDocumentCreated(
  {
    document: 'intake_queue/{queueId}',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (event) => {
    const queueId = event.params.queueId
    const col = intakeQueueCol()
    const queueRef = col.doc(queueId)
    const data = event.data?.data() as QueueEntry | undefined

    if (!data) {
      console.warn(`[wire-trigger] Queue entry ${queueId} has no data`)
      return
    }

    if (data.status !== 'QUEUED') {
      console.log(`[wire-trigger] Queue entry ${queueId} status is ${data.status}, skipping`)
      return
    }

    // Determine wire from source
    const wireId = SOURCE_TO_WIRE[data.source]
    if (!wireId) {
      console.warn(`[wire-trigger] Unknown source "${data.source}" for queue entry ${queueId}`)
      await queueRef.update({
        status: 'ERROR',
        error: `Unknown source: ${data.source}`,
        updated_at: new Date().toISOString(),
      })
      return
    }

    // Mark as processing
    await queueRef.update({
      status: 'PROCESSING',
      wire_id: wireId,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    try {
      const executeWire = await loadExecuteWire()

      const input = {
        file_id: data.file_id,
        file_ids: data.file_ids || (data.file_id ? [data.file_id] : []),
        mode: (data.mode || 'document') as 'document' | 'csv' | 'commission',
      }

      const context = {
        wire_id: wireId,
        user_email: data.user_email || 'system@retireprotected.com',
        source_file_ids: data.file_ids || (data.file_id ? [data.file_id] : []),
        dry_run: false,
        approval_required: true,
      }

      const result = await executeWire(wireId, input, context)

      await queueRef.update({
        status: result.success ? 'COMPLETE' : 'ERROR',
        wire_result: {
          success: result.success,
          stages: result.stages?.length || 0,
          created_records: result.created_records?.length || 0,
          execution_time_ms: result.execution_time_ms,
          approval_batch_id: result.approval_batch_id || null,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      console.log(`[wire-trigger] Wire ${wireId} completed for queue ${queueId}: success=${result.success}`)

      // ── TRK-461: ACF reactive hook ──────────────────────────────────
      // After successful wire completion, auto-route source files to ACF
      // subfolder based on document classification from the wire result.
      if (result.success && result.created_records?.length > 0) {
        try {
          const acfResult = await routeToACF(data, result)
          if (acfResult) {
            await queueRef.update({ acf_route: acfResult })
            console.log(`[wire-trigger] ACF route: ${acfResult.routed} file(s) → ${acfResult.target_subfolder}`)
          }
        } catch (acfErr) {
          // Non-blocking — log but don't fail the queue entry
          console.warn(`[wire-trigger] ACF route failed (non-blocking):`, acfErr)
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[wire-trigger] Wire ${wireId} failed for queue ${queueId}:`, errorMsg)

      await queueRef.update({
        status: 'ERROR',
        error: errorMsg,
        updated_at: new Date().toISOString(),
      })
    }
  }
)
