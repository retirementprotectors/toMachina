/**
 * TRK-542: ACF_SCAN E2E Test
 *
 * Tests the proactive ACF scan pipeline: upload file directly to ACF → scan-all → execute wire.
 * Flow: Upload to Client subfolder → POST scan-all → find queue entry → POST execute-wire
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { uploadTestPdf, deleteTestFile } from '../helpers/drive-client.js'
import { apiPost } from '../helpers/api-client.js'
import { cleanupTestData } from '../helpers/cleanup.js'
import {
  TEST_CLIENT_ID,
  TEST_FILE_PREFIX,
  GCP_PROJECT_ID,
} from '../helpers/constants.js'

if (getApps().length === 0) {
  initializeApp({ projectId: GCP_PROJECT_ID })
}

interface WireResponse {
  success: boolean
  wire_id: string
  execution_id: string
  stages: Array<{ stage: string; status: string; error?: string }>
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  status: string
}

interface ScanAllResponse {
  mode: string
  clients_scanned: number
  total_indexed: number
}

describe.skip('ACF_SCAN Pipeline', () => {
  const testRunId = `acf-scan-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string
  let acfClientSubfolderId: string
  let driveAvailable = false

  beforeAll(async () => {
    try {
      const db = getFirestore()
      const clientDoc = await db.collection('clients').doc(TEST_CLIENT_ID).get()
      const clientData = clientDoc.data()
      acfClientSubfolderId = (clientData?.acf_subfolder_ids as Record<string, string>)?.Client

      if (!acfClientSubfolderId) {
        console.log('SKIP: Test client ACF subfolder not found — run seed script first')
        return
      }

      uploadedFileId = await uploadTestPdf(acfClientSubfolderId, fileName)
      driveAvailable = true
    } catch (err) {
      console.log(`SKIP: Setup failed — ${(err as Error).message}`)
    }
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)

    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }

    // Clean up document_index entry
    const db = getFirestore()
    const docId = `${TEST_CLIENT_ID}_${uploadedFileId}`
    try {
      await db.collection('document_index').doc(docId).delete()
    } catch {
      // May not exist
    }
  }, 30_000)

  it('should scan ACF folders and create + execute wire pipeline', async () => {
    if (!driveAvailable || !process.env.TEST_API_URL) {
      console.log('SKIP: requires Drive access + running API')
      return
    }
    const db = getFirestore()

    // POST /api/document-index/scan-all to trigger proactive scan
    // Force full scan to ensure our test file is picked up
    const scanResult = await apiPost<ScanAllResponse>('/api/document-index/scan-all?full=true', {})

    expect(scanResult.success).toBe(true)
    expect(scanResult.data).toBeDefined()
    expect(scanResult.data!.clients_scanned).toBeGreaterThanOrEqual(1)

    // Find the queue entry created by scan-all for our test file
    // scan-all creates entries with source: 'ACF_SCAN'
    // Give it a moment to process
    await new Promise(resolve => setTimeout(resolve, 2000))

    const queueSnap = await db.collection('intake_queue')
      .where('source', '==', 'ACF_SCAN')
      .where('file_id', '==', uploadedFileId)
      .limit(1)
      .get()

    expect(queueSnap.empty).toBe(false)
    const queueEntry = queueSnap.docs[0].data()
    const queueId = queueSnap.docs[0].id

    expect(queueEntry.source).toBe('ACF_SCAN')
    expect(queueEntry.client_id).toBe(TEST_CLIENT_ID)

    // Execute the wire pipeline via API
    const result = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
      input: {
        file_id: uploadedFileId,
        file_ids: [uploadedFileId],
        mode: 'document',
        _meta: {
          source: 'ACF_SCAN',
          client_id: TEST_CLIENT_ID,
          file_name: fileName,
          mime_type: 'application/pdf',
        },
      },
      queue_id: queueId,
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.stages.length).toBe(8)

    // Verify no error stages
    const errorStages = result.data!.stages.filter(s => s.status === 'error')
    expect(errorStages).toEqual([])

    // Verify document_index was updated with document_type
    if (result.data!.status === 'complete') {
      const docId = `${TEST_CLIENT_ID}_${uploadedFileId}`
      const indexDoc = await db.collection('document_index').doc(docId).get()

      if (indexDoc.exists) {
        const indexData = indexDoc.data()!
        // After wire execution, document_type should be populated
        expect(indexData.document_type).toBeTruthy()
      }
    }

    expect(['complete', 'awaiting_approval']).toContain(result.data!.status)
  }, 120_000)
})
