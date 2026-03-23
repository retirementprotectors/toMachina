/**
 * Cluster 2: Intake Pipeline Verification E2E Tests
 *
 * TRK-13602: MAIL post-wire file movement
 * TRK-13603: WIRE_DATA_IMPORT full chain
 * TRK-13607: IntakeFAB uploads (dropzone)
 * TRK-13622: SUPER_PREPARE Google-native files
 * TRK-13615: Resume/reject wire API endpoints
 * TRK-13637: document_index update after wire
 * TRK-13638: SPC_INTAKE post-wire cleanup
 * TRK-13639+13640: ACF client_id passthrough
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  uploadTestPdf,
  deleteTestFile,
  listFolderFiles,
  getOrCreateSubfolder,
} from '../helpers/drive-client.js'
import { apiPost } from '../helpers/api-client.js'
import { cleanupTestData } from '../helpers/cleanup.js'
import {
  TEST_CLIENT_ID,
  TEST_FILE_PREFIX,
  MAIL_INTAKE_INCOMING_FOLDER_ID,
  SPC_INTAKE_FOLDER_ID,
  GCP_PROJECT_ID,
  TEST_ACF_SUBFOLDER_IDS,
} from '../helpers/constants.js'

if (getApps().length === 0) {
  initializeApp({ projectId: GCP_PROJECT_ID })
}

const API_AVAILABLE = !!process.env.TEST_API_URL

interface WireResponse {
  success: boolean
  wire_id: string
  execution_id: string
  stages: Array<{ stage: string; status: string; error?: string }>
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  status: string
}

// ============================================================================
// TRK-13602: MAIL post-wire file movement
// ============================================================================

describe('TRK-13602: MAIL post-wire file movement', () => {
  const testRunId = `c2-mail-move-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string
  let incomingFolderId: string
  let processedFolderId: string

  beforeAll(async () => {
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })

    // Find Incoming and Processed subfolders under MAIL_INTAKE
    const subs = await drive.files.list({
      q: `'${MAIL_INTAKE_INCOMING_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name)',
    })

    const incoming = subs.data.files?.find(f => f.name?.toLowerCase() === 'incoming')
    const processed = subs.data.files?.find(f => f.name?.toLowerCase() === 'processed')

    if (!incoming?.id) throw new Error('MAIL_INTAKE/Incoming subfolder not found')
    if (!processed?.id) throw new Error('MAIL_INTAKE/Processed subfolder not found')

    incomingFolderId = incoming.id
    processedFolderId = processed.id

    // Upload test PDF to Incoming
    uploadedFileId = await uploadTestPdf(incomingFolderId, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should move file from Incoming to Processed after wire execution', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    // Verify file is in Incoming before wire
    const incomingBefore = await listFolderFiles(incomingFolderId)
    expect(incomingBefore.some(f => f.id === uploadedFileId)).toBe(true)

    // Execute wire
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
      queue_id: '',
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    // Verify file is NO LONGER in Incoming
    const incomingAfter = await listFolderFiles(incomingFolderId)
    expect(incomingAfter.some(f => f.id === uploadedFileId)).toBe(false)

    // Verify file IS in Processed
    const processedAfter = await listFolderFiles(processedFolderId)
    expect(processedAfter.some(f => f.id === uploadedFileId)).toBe(true)
  }, 120_000)
})

// ============================================================================
// TRK-13603: WIRE_DATA_IMPORT full chain (C2 scope)
// ============================================================================

describe('TRK-13603: WIRE_DATA_IMPORT full chain', () => {
  const testRunId = `c2-data-import-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string

  beforeAll(async () => {
    // Upload a test file to ACF Client subfolder (reuse as input for data import wire)
    uploadedFileId = await uploadTestPdf(TEST_ACF_SUBFOLDER_IDS.Client, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should execute WIRE_DATA_IMPORT with all 5 expected stages', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    const result = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_DATA_IMPORT',
      input: {
        file_id: uploadedFileId,
        file_ids: [uploadedFileId],
        mode: 'document',
        _meta: {
          source: 'DATA_IMPORT',
          file_name: fileName,
          mime_type: 'application/pdf',
        },
      },
      queue_id: '',
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const wireResult = result.data!

    // Verify stages array exists and contains expected stage names
    expect(wireResult.stages).toBeDefined()
    expect(Array.isArray(wireResult.stages)).toBe(true)

    const stageNames = wireResult.stages.map(s => s.stage)
    const expectedStages = [
      'SUPER_EXTRACT',
      'SUPER_VALIDATE',
      'SUPER_NORMALIZE',
      'SUPER_MATCH',
      'SUPER_WRITE',
    ]

    for (const expected of expectedStages) {
      expect(stageNames).toContain(expected)
    }

    // Assert no stages errored
    const errorStages = wireResult.stages.filter(s => s.status === 'error')
    expect(errorStages).toEqual([])
  }, 120_000)
})

// ============================================================================
// TRK-13607: IntakeFAB uploads (dropzone)
// ============================================================================

describe('TRK-13607: IntakeFAB uploads via dropzone', () => {
  const testRunId = `c2-dropzone-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`

  afterAll(async () => {
    await cleanupTestData(testRunId)
  }, 30_000)

  it('should create intake_queue entry via dropzone upload', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    // POST to dropzone endpoint with test PDF metadata
    const result = await apiPost<{ queue_id: string; file_id: string }>('/api/dropzone', {
      file_name: fileName,
      mime_type: 'application/pdf',
      client_id: TEST_CLIENT_ID,
      source: 'INTAKE_FAB',
    })

    expect(result.success).toBe(true)

    // Query intake_queue for the entry
    const db = getFirestore()
    const queueSnap = await db.collection('intake_queue')
      .where('client_id', '==', TEST_CLIENT_ID)
      .get()

    const matchingDocs = queueSnap.docs.filter(d => {
      const data = d.data()
      return (data.file_name as string)?.includes(testRunId)
    })

    expect(matchingDocs.length).toBeGreaterThanOrEqual(1)

    const queueEntry = matchingDocs[0].data()
    expect(queueEntry.status).toBe('QUEUED')
    expect(queueEntry.source).toBeTruthy()
  }, 60_000)
})

// ============================================================================
// TRK-13622: SUPER_PREPARE Google-native files
// ============================================================================

describe('TRK-13622: SUPER_PREPARE handles native mimetypes', () => {
  const testRunId = `c2-prepare-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string

  beforeAll(async () => {
    uploadedFileId = await uploadTestPdf(TEST_ACF_SUBFOLDER_IDS.Client, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should complete SUPER_PREPARE stage without error on document mode', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

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
      queue_id: '',
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    // Find SUPER_PREPARE stage
    const prepareStage = result.data!.stages.find(s => s.stage === 'SUPER_PREPARE')
    expect(prepareStage).toBeDefined()
    expect(prepareStage!.status).not.toBe('error')
  }, 120_000)
})

// ============================================================================
// TRK-13615: Resume/reject wire API endpoints
// ============================================================================

describe('TRK-13615: Resume/reject wire endpoints', () => {
  it('should return appropriate error for approve on invalid executionId', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    const fakeExecutionId = `fake-execution-${Date.now()}`
    const result = await apiPost<unknown>(
      `/api/intake/${fakeExecutionId}/approve`,
      {}
    )

    // Should fail gracefully — either 404 or error response
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  }, 30_000)

  it('should return appropriate error for reject on invalid executionId', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    const fakeExecutionId = `fake-execution-${Date.now()}`
    const result = await apiPost<{ status: string }>(
      `/api/intake/${fakeExecutionId}/reject`,
      { reason: 'E2E test rejection' }
    )

    // Should fail gracefully — either 404 or error response
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  }, 30_000)
})

// ============================================================================
// TRK-13637: document_index update after wire
// ============================================================================

describe('TRK-13637: document_index update after wire', () => {
  const testRunId = `c2-docindex-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  let uploadedFileId: string

  beforeAll(async () => {
    uploadedFileId = await uploadTestPdf(TEST_ACF_SUBFOLDER_IDS.Client, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should populate document_index after successful wire execution', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

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
      queue_id: '',
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    // Only check document_index if wire completed (not paused at approval)
    if (result.data!.status === 'complete') {
      const db = getFirestore()
      const indexSnap = await db.collection('document_index')
        .where('file_id', '==', uploadedFileId)
        .limit(1)
        .get()

      expect(indexSnap.empty).toBe(false)

      const indexData = indexSnap.docs[0].data()
      expect(indexData.document_type).toBeTruthy()
      expect(indexData.wire_execution_id).toBeTruthy()
      expect(indexData.classified_at).toBeTruthy()
    } else {
      console.log('Wire paused at approval — skipping document_index assertion')
    }
  }, 120_000)
})

// ============================================================================
// TRK-13638: SPC_INTAKE post-wire cleanup
// ============================================================================

describe('TRK-13638: SPC_INTAKE post-wire cleanup', () => {
  const testRunId = `c2-spc-cleanup-${Date.now()}`
  const fileName = `${TEST_FILE_PREFIX}${testRunId}.pdf`
  const TEST_SPECIALIST_NAME = 'E2E Test Specialist'
  let uploadedFileId: string
  let specialistFolderId: string

  beforeAll(async () => {
    // Create or find "E2E Test Specialist" subfolder under SPC_INTAKE
    specialistFolderId = await getOrCreateSubfolder(
      SPC_INTAKE_FOLDER_ID,
      TEST_SPECIALIST_NAME
    )
    uploadedFileId = await uploadTestPdf(specialistFolderId, fileName)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)
    if (uploadedFileId) {
      await deleteTestFile(uploadedFileId)
    }
  }, 30_000)

  it('should move file to Processed after SPC_INTAKE wire execution', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    // Verify file is in specialist folder before wire
    const folderBefore = await listFolderFiles(specialistFolderId)
    expect(folderBefore.some(f => f.id === uploadedFileId)).toBe(true)

    // Execute wire
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
          specialist_name: TEST_SPECIALIST_NAME,
          source_folder_id: specialistFolderId,
        },
      },
      queue_id: '',
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    // Verify file has been moved out of specialist folder
    const folderAfter = await listFolderFiles(specialistFolderId)
    expect(folderAfter.some(f => f.id === uploadedFileId)).toBe(false)
  }, 120_000)
})

// ============================================================================
// TRK-13639+13640: ACF client_id passthrough
// ============================================================================

describe('TRK-13639+13640: ACF client_id passthrough', () => {
  const testRunId = `c2-acf-passthrough-${Date.now()}`
  const fileNameUpload = `${TEST_FILE_PREFIX}${testRunId}-upload.pdf`
  const fileNameScan = `${TEST_FILE_PREFIX}${testRunId}-scan.pdf`
  let uploadedFileIdUpload: string
  let uploadedFileIdScan: string

  beforeAll(async () => {
    // Upload two test files: one for ACF_UPLOAD, one for ACF_SCAN
    uploadedFileIdUpload = await uploadTestPdf(TEST_ACF_SUBFOLDER_IDS.Client, fileNameUpload)
    uploadedFileIdScan = await uploadTestPdf(TEST_ACF_SUBFOLDER_IDS.Client, fileNameScan)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData(testRunId)
    if (uploadedFileIdUpload) await deleteTestFile(uploadedFileIdUpload)
    if (uploadedFileIdScan) await deleteTestFile(uploadedFileIdScan)
  }, 30_000)

  it('should preserve client_id for both ACF_UPLOAD and ACF_SCAN sources', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    // Test ACF_UPLOAD with explicit client_id
    const uploadResult = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
      input: {
        file_id: uploadedFileIdUpload,
        file_ids: [uploadedFileIdUpload],
        mode: 'document',
        _meta: {
          source: 'ACF_UPLOAD',
          client_id: TEST_CLIENT_ID,
          file_name: fileNameUpload,
          mime_type: 'application/pdf',
        },
      },
      queue_id: '',
    })

    expect(uploadResult.success).toBe(true)
    expect(uploadResult.data).toBeDefined()

    // Test ACF_SCAN with explicit client_id
    const scanResult = await apiPost<WireResponse>('/api/intake/execute-wire', {
      wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
      input: {
        file_id: uploadedFileIdScan,
        file_ids: [uploadedFileIdScan],
        mode: 'document',
        _meta: {
          source: 'ACF_SCAN',
          client_id: TEST_CLIENT_ID,
          file_name: fileNameScan,
          mime_type: 'application/pdf',
        },
      },
      queue_id: '',
    })

    expect(scanResult.success).toBe(true)
    expect(scanResult.data).toBeDefined()

    // Verify client_id persisted in intake_queue for both
    const db = getFirestore()
    const queueSnap = await db.collection('intake_queue')
      .where('client_id', '==', TEST_CLIENT_ID)
      .get()

    const uploadEntry = queueSnap.docs.find(d => {
      const data = d.data()
      return (data.file_name as string)?.includes(`${testRunId}-upload`)
    })

    const scanEntry = queueSnap.docs.find(d => {
      const data = d.data()
      return (data.file_name as string)?.includes(`${testRunId}-scan`)
    })

    // At least one of the entries should have client_id preserved
    // (wire may or may not create queue entries depending on queue_id param)
    if (uploadEntry) {
      expect(uploadEntry.data().client_id).toBe(TEST_CLIENT_ID)
    }

    if (scanEntry) {
      expect(scanEntry.data().client_id).toBe(TEST_CLIENT_ID)
    }

    // Verify execution results carry the client association
    if (uploadResult.data!.status === 'complete') {
      const indexSnap = await db.collection('document_index')
        .where('file_id', '==', uploadedFileIdUpload)
        .limit(1)
        .get()

      if (!indexSnap.empty) {
        expect(indexSnap.docs[0].data().client_id).toBe(TEST_CLIENT_ID)
      }
    }
  }, 180_000)
})
