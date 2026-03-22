/**
 * TRK-541: SPC_INTAKE E2E Test
 *
 * Tests the specialist intake pipeline: scan specialist folders → create queue entry → execute wire.
 * Flow: Upload to SPC_INTAKE/"E2E Test Specialist" → scanSpcFolders() → POST execute-wire
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  uploadTestPdf,
  deleteTestFile,
  getOrCreateSubfolder,
} from '../helpers/drive-client.js'
import { apiPost } from '../helpers/api-client.js'
import { cleanupTestData } from '../helpers/cleanup.js'
import {
  SPC_INTAKE_FOLDER_ID,
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

const TEST_SPECIALIST_NAME = 'E2E Test Specialist'

describe('SPC_INTAKE Pipeline', () => {
  const testRunId = `spc-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string
  let specialistFolderId: string

  beforeAll(async () => {
    // Create or find the "E2E Test Specialist" subfolder under SPC_INTAKE
    specialistFolderId = await getOrCreateSubfolder(
      SPC_INTAKE_FOLDER_ID,
      TEST_SPECIALIST_NAME
    )

    // Upload test PDF to the specialist folder
    uploadedFileId = await uploadTestPdf(specialistFolderId, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)

    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should scan specialist folders and execute wire pipeline', async () => {
    const db = getFirestore()

    // Import and call scanSpcFolders to create a queue entry
    const { scanSpcFolders } = await import(
      /* webpackIgnore: true */
      '../../../services/intake/src/spc-intake.js'
    )
    const scanResult = await scanSpcFolders()

    expect(scanResult.success).toBe(true)
    expect(scanResult.new_files).toBeGreaterThanOrEqual(1)

    // Find the queue entry for our test file
    const queueSnap = await db.collection('intake_queue')
      .where('file_id', '==', uploadedFileId)
      .limit(1)
      .get()

    expect(queueSnap.empty).toBe(false)
    const queueEntry = queueSnap.docs[0].data()
    const queueId = queueSnap.docs[0].id

    expect(queueEntry.source).toBe('SPC_INTAKE')
    expect(queueEntry.specialist_name).toBeTruthy()

    // Execute the wire pipeline via API
    const result = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
      input: {
        file_id: uploadedFileId,
        file_ids: [uploadedFileId],
        mode: 'document',
        _meta: {
          source: 'SPC_INTAKE',
          file_name: fileName,
          mime_type: 'application/pdf',
          specialist_name: queueEntry.specialist_name,
          source_folder_id: specialistFolderId,
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

    // Verify wire succeeded or is awaiting approval
    expect(['complete', 'awaiting_approval']).toContain(result.data!.status)
  }, 120_000)
})
