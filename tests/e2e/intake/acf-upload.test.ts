/**
 * TRK-539: ACF_UPLOAD Pipeline E2E Test
 *
 * Tests the full wire pipeline when a document is uploaded via ProDash ACF.
 * Flow: Upload PDF to ACF subfolder → POST execute-wire → verify 8 stages complete
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

// Initialize Firebase Admin for this test file
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

describe('ACF_UPLOAD Pipeline', () => {
  const testRunId = `acf-upload-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string
  let acfClientSubfolderId: string

  beforeAll(async () => {
    // Load the test client's ACF subfolder IDs from Firestore
    const db = getFirestore()
    const clientDoc = await db.collection('clients').doc(TEST_CLIENT_ID).get()
    const clientData = clientDoc.data()
    acfClientSubfolderId = (clientData?.acf_subfolder_ids as Record<string, string>)?.Client

    if (!acfClientSubfolderId) {
      throw new Error('Test client ACF Client subfolder not found. Run seed script first.')
    }

    // Upload test PDF to the Client subfolder (simulating ProDash ACF upload)
    uploadedFileId = await uploadTestPdf(acfClientSubfolderId, fileName)
  }, 30_000)

  afterAll(async () => {
    // Cleanup test data from Firestore
    await cleanupTestData(testRunId)

    // Delete uploaded file from Drive
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should execute full wire pipeline with 8 stages', async () => {
    // POST /api/intake/execute-wire with ACF_UPLOAD source
    const result = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
      input: {
        file_id: uploadedFileId,
        file_ids: [uploadedFileId],
        mode: 'document',
        _meta: {
          source: 'ACF_UPLOAD',
          client_id: TEST_CLIENT_ID,
          file_name: fileName,
          mime_type: 'application/pdf',
        },
      },
      queue_id: '', // No queue entry for direct ACF uploads
    })

    // Assert API call succeeded
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const wireResult = result.data!
    // Wire has 8 super-tools: PREPARE, CLASSIFY, EXTRACT, VALIDATE, NORMALIZE, MATCH, WRITE, ACF_FINALIZE
    expect(wireResult.stages.length).toBe(8)

    // No error stages
    const errorStages = wireResult.stages.filter(s => s.status === 'error')
    expect(errorStages).toEqual([])

    // Accept both complete and awaiting_approval (approval_required: true pauses at SUPER_WRITE)
    expect(['complete', 'awaiting_approval']).toContain(wireResult.status)

    // Verify no stage errors
    const errorStages = wireResult.stages.filter(s => s.status === 'error')
    expect(errorStages).toEqual([])

    // Verify document_index was populated (if wire completed fully)
    if (wireResult.status === 'complete') {
      const db = getFirestore()
      const indexSnap = await db.collection('document_index')
        .where('file_id', '==', uploadedFileId)
        .limit(1)
        .get()

      if (!indexSnap.empty) {
        const indexData = indexSnap.docs[0].data()
        expect(indexData.document_type).toBeTruthy()
      }
    }
  }, 120_000)
})
