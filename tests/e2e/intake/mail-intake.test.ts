/**
 * TRK-540: MAIL Intake E2E Test
 *
 * Tests the mail intake pipeline: scan Incoming folder → create queue entry → execute wire.
 * Flow: Upload to MAIL_INTAKE/Incoming → scanMailIntake() → POST execute-wire
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { uploadTestPdf, deleteTestFile, listFolderFiles } from '../helpers/drive-client.js'
import { apiPost } from '../helpers/api-client.js'
import { cleanupTestData } from '../helpers/cleanup.js'
import {
  MAIL_INTAKE_INCOMING_FOLDER_ID,
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

describe('MAIL Intake Pipeline', () => {
  const testRunId = `mail-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string
  // Track the Incoming subfolder ID (the actual Incoming folder under MAIL_INTAKE)
  let incomingFolderId: string

  beforeAll(async () => {
    // The MAIL_INTAKE_INCOMING_FOLDER_ID is the root MAIL_INTAKE folder.
    // We need to find the "Incoming" subfolder within it.
    const db = getFirestore()

    // List subfolders to find Incoming
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })
    const subs = await drive.files.list({
      q: `'${MAIL_INTAKE_INCOMING_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name)',
    })

    const incoming = subs.data.files?.find(f => f.name?.toLowerCase() === 'incoming')
    if (!incoming?.id) {
      throw new Error('MAIL_INTAKE/Incoming subfolder not found')
    }
    incomingFolderId = incoming.id

    // Upload test PDF to Incoming
    uploadedFileId = await uploadTestPdf(incomingFolderId, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)

    // Try to delete file from both Incoming and any Processed folder
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should scan mail intake and execute wire pipeline', async () => {
    const db = getFirestore()

    // Import and call scanMailIntake to create a queue entry
    // Since this is an E2E test against the real system, we call the scanner
    // which creates a queue entry in Firestore
    const { scanMailIntake } = await import(
      /* webpackIgnore: true */
      '../../../services/intake/src/mail-intake.js'
    )
    const scanResult = await scanMailIntake()

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

    expect(queueEntry.source).toBe('MAIL')
    expect(queueEntry.status).toBe('QUEUED')

    // Execute the wire pipeline via API
    const result = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
      input: {
        file_id: uploadedFileId,
        file_ids: [uploadedFileId],
        mode: 'document',
        _meta: {
          source: 'MAIL',
          file_name: fileName,
          mime_type: 'application/pdf',
          source_folder_id: incomingFolderId,
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
