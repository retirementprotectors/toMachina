import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

async function main() {
  const now = new Date().toISOString()

  const existingSnap = await db.collection('tracker_items').orderBy('item_id', 'desc').limit(1).get()
  let nextNum = 1
  if (!existingSnap.empty) {
    nextNum = parseInt((existingSnap.docs[0].data().item_id as string).replace('TRK-', ''), 10) + 1
  }

  const items = [
    // Phase 1: SUPER_PREPARE — The Missing Bridge
    { title: 'Build SUPER_PREPARE super tool — Drive file to local images', description: 'The critical missing piece. Downloads file from Drive by file_id, converts PDF to per-page PNG images via pdf-to-image, passes image_paths + file_name + taxonomy_types to next stage. Connects intake queue to SUPER_CLASSIFY. Without it, all 4 intake sources dead-end at wire execution.', type: 'feat', scope: 'core', component: 'atlas/super-tools/prepare', priority: 'P0' },
    { title: 'Register SUPER_PREPARE in wire executor SUPER_TOOL_MAP', description: 'Add SUPER_PREPARE to static import map in wire-executor.ts. Insert BEFORE SUPER_CLASSIFY in WIRE_INCOMING_CORRESPONDENCE super_tools array. Update wire definition stages.', type: 'feat', scope: 'core', component: 'atlas/wire-executor', priority: 'P0' },
    { title: 'Install PDF-to-image conversion dependency', description: 'Evaluate: pdf-poppler, pdf2pic, ghostscript CLI, or Cloud Run with poppler-utils. Must work in Cloud Functions/Cloud Run. If no native deps work, move wire execution to Cloud Run (tm-api already runs there).', type: 'feat', scope: 'intake', component: 'dependencies', priority: 'P0' },
    { title: 'SUPER_PREPARE temp file cleanup after wire completion', description: 'After wire completes (success or error), clean up temp directory with downloaded files and page images. Prevent disk bloat on Cloud Run/Functions.', type: 'feat', scope: 'core', component: 'atlas/super-tools/prepare', priority: 'P1' },

    // Phase 2: ACF_FINALIZE — File Lifecycle After Wire
    { title: 'Build ACF_FINALIZE super tool — route file to client ACF', description: 'After SUPER_WRITE: look up matched client_id from wire output, find acf_folder_id, determine target subfolder from document classification, move file from staging to ACF subfolder. Create ACF if needed. Update document_index with document_type.', type: 'feat', scope: 'core', component: 'atlas/super-tools/acf-finalize', priority: 'P0' },
    { title: 'Register ACF_FINALIZE in wire executor + wire definition', description: 'Add ACF_FINALIZE after SUPER_WRITE in SUPER_TOOL_MAP and super_tools array.', type: 'feat', scope: 'core', component: 'atlas/wire-executor', priority: 'P0' },
    { title: 'MAIL source: move Incoming to Processed AFTER wire, not before', description: 'Currently mail-intake.ts moves files to Processed pre-wire. Refactor so file stays in Incoming until ACF_FINALIZE succeeds, then moves to Processed. On wire error, move to Errors folder.', type: 'feat', scope: 'intake', component: 'mail-intake', priority: 'P1' },
    { title: 'SPC_INTAKE source: add Processed folder + post-wire cleanup', description: 'Add Processed subfolder to each specialist folder. After successful wire, move file from specialist folder to Processed. Prevents folders from growing forever with already-processed files.', type: 'feat', scope: 'intake', component: 'spc-intake', priority: 'P1' },

    // Phase 3: Wire Input Normalization
    { title: 'Normalize wire input across all 4 intake sources', description: 'Each source queues different fields (specialist_name, acf_subfolder, content_preview). Build normalizer in wire-trigger that produces consistent WireInput regardless of source: { file_id, file_ids, file_name, mime_type, client_id, source, mode }.', type: 'feat', scope: 'intake', component: 'wire-trigger', priority: 'P1' },
    { title: 'ACF_UPLOAD: pass client_id through to wire context', description: 'ACF_UPLOAD already knows client_id (in URL). Pass through intake_queue so SUPER_MATCH can skip matching and go straight to known client. Saves Claude Vision API calls.', type: 'feat', scope: 'api', component: 'acf-routes', priority: 'P1' },
    { title: 'ACF_SCAN: pass client_id through to wire context', description: 'ACF_SCAN knows which client owns each folder. Pass client_id through intake_queue so SUPER_MATCH can skip matching step.', type: 'feat', scope: 'api', component: 'document-index', priority: 'P1' },

    // Phase 4: End-to-End Integration Testing
    { title: 'E2E test: ACF_UPLOAD full wire to ACF subfolder + Firestore', description: 'Upload test PDF via drag-and-drop on a test client. Verify: intake_queue created, wire executes all stages (PREPARE, CLASSIFY, EXTRACT, VALIDATE, NORMALIZE, MATCH, WRITE, ACF_FINALIZE), document_type populated in document_index, file in correct ACF subfolder, client record updated.', type: 'test', scope: 'integration', component: 'e2e', priority: 'P0' },
    { title: 'E2E test: MAIL full wire to ACF + Processed folder', description: 'Drop test PDF in MAIL_INTAKE/Incoming. Verify: scanner queues, wire runs all stages, file ends up in matched client ACF subfolder, original moved to Processed.', type: 'test', scope: 'integration', component: 'e2e', priority: 'P1' },
    { title: 'E2E test: SPC_INTAKE full wire to ACF subfolder', description: 'Drop test PDF in a specialist folder. Verify full pipeline including file move to Processed.', type: 'test', scope: 'integration', component: 'e2e', priority: 'P1' },
    { title: 'E2E test: ACF_SCAN hourly catches unclassified files', description: 'Manually upload PDF to client ACF via Drive (bypassing ProDash). Run scan-all. Verify: file queued, wire runs, document_type set in document_index.', type: 'test', scope: 'integration', component: 'e2e', priority: 'P1' },

    // Phase 5: Approval Pipeline Wiring
    { title: 'Wire Notifications APPROVALS tab to intake_queue', description: 'Notifications Module APPROVALS tab is a mockup. Wire to show intake_queue entries with status awaiting_approval. Show extracted data, matched client, confidence. Approve/reject buttons call resumeWireAfterApproval.', type: 'feat', scope: 'ui', component: 'NotificationsModule', priority: 'P1' },
    { title: 'Build resume/reject wire API endpoints', description: 'POST /api/intake/:executionId/approve — calls resumeWireAfterApproval. POST /api/intake/:executionId/reject — marks REJECTED. Handles approved data payload from Notifications UI.', type: 'feat', scope: 'api', component: 'intake-routes', priority: 'P1' },

    // Phase 6: document_index Completion
    { title: 'Update document_index after successful wire completion', description: 'After SUPER_WRITE: update document_index entry with document_type (from CLASSIFY), extraction_queued: false, wire_execution_id, classified_at. Makes checklist widgets show correct document type.', type: 'feat', scope: 'core', component: 'atlas/super-tools/write', priority: 'P1' },
    { title: 'Backfill document_type on existing document_index entries', description: 'Script to classify existing indexed documents by filename pattern matching against document_link_config.file_patterns. Regex matching only, no Claude Vision. Sets document_type so checklist widgets work immediately.', type: 'feat', scope: 'scripts', component: 'backfill', priority: 'P2' },
  ]

  const itemIds: string[] = []
  const batch = db.batch()
  for (let i = 0; i < items.length; i++) {
    const itemId = `TRK-${String(nextNum + i).padStart(3, '0')}`
    itemIds.push(itemId)
    batch.set(db.collection('tracker_items').doc(itemId), {
      ...items[i],
      item_id: itemId,
      status: 'backlog',
      sprint_id: null,
      created_at: now,
      updated_at: now,
      _created_by: 'josh@retireprotected.com',
    })
  }
  await batch.commit()

  const sprintRef = db.collection('sprints').doc()
  await sprintRef.set({
    name: 'Intake Wires — Document Processing Pipeline',
    description: 'Close every gap between file intake and Firestore. Build SUPER_PREPARE (Drive→images bridge), ACF_FINALIZE (post-wire file routing), wire input normalization, approval pipeline UI, and document_index completion. When done, all 4 intake sources (MAIL, SPC_INTAKE, ACF_UPLOAD, ACF_SCAN) run end-to-end through WIRE_INCOMING_CORRESPONDENCE with zero manual steps.',
    discovery_url: null,
    status: 'active',
    item_ids: itemIds,
    created_at: now,
    updated_at: now,
    _created_by: 'josh@retireprotected.com',
  })

  const batch2 = db.batch()
  for (const id of itemIds) {
    batch2.update(db.collection('tracker_items').doc(id), { sprint_id: sprintRef.id, status: 'in_sprint', updated_at: now })
  }
  await batch2.commit()

  console.log(`Sprint: ${sprintRef.id}`)
  console.log(`Name: Intake Wires — Document Processing Pipeline`)
  console.log(`Items: ${itemIds.length} tickets (${itemIds[0]} → ${itemIds[itemIds.length - 1]})`)
  console.log(`Phase 1 (SUPER_PREPARE): 4 items — P0`)
  console.log(`Phase 2 (ACF_FINALIZE): 4 items — P0/P1`)
  console.log(`Phase 3 (Wire Input Normalization): 3 items — P1`)
  console.log(`Phase 4 (Integration Testing): 4 items — P0/P1`)
  console.log(`Phase 5 (Approval Pipeline): 2 items — P1`)
  console.log(`Phase 6 (document_index Completion): 2 items — P1/P2`)
}
main()
