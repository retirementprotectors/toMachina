/**
 * TRK-536: Cleanup Helper — batch delete test data from Firestore + Drive.
 * Idempotent — safe to call multiple times.
 */

import { getFirestore } from 'firebase-admin/firestore'
import { deleteTestFile, listFolderFiles } from './drive-client.js'
import { TEST_CLIENT_ID, TEST_FILE_PREFIX } from './constants.js'

/**
 * Clean up all test data created during a test run.
 * Deletes from: intake_queue, wire_executions, document_index, notifications.
 * Also removes test files from Drive.
 */
export async function cleanupTestData(testRunId: string): Promise<void> {
  const db = getFirestore()

  // 1. Find and delete intake_queue entries matching this test run
  const queueSnap = await db.collection('intake_queue')
    .where('client_id', '==', TEST_CLIENT_ID)
    .get()

  const testQueueDocs = queueSnap.docs.filter(d => {
    const data = d.data()
    const fileName = (data.file_name as string) || ''
    return fileName.includes(testRunId) || fileName.startsWith(TEST_FILE_PREFIX)
  })

  // Collect execution IDs for cascade delete
  const executionIds: string[] = []
  for (const doc of testQueueDocs) {
    const data = doc.data()
    if (data.wire_result?.execution_id) {
      executionIds.push(data.wire_result.execution_id as string)
    }
  }

  // Also check for ACF_SCAN source entries (no client_id set at queue time)
  const scanSnap = await db.collection('intake_queue')
    .where('source', '==', 'ACF_SCAN')
    .get()

  for (const doc of scanSnap.docs) {
    const data = doc.data()
    const fileName = (data.file_name as string) || ''
    if (fileName.includes(testRunId) || fileName.startsWith(TEST_FILE_PREFIX)) {
      testQueueDocs.push(doc)
      if (data.wire_result?.execution_id) {
        executionIds.push(data.wire_result.execution_id as string)
      }
    }
  }

  // Batch delete queue entries
  if (testQueueDocs.length > 0) {
    const batch = db.batch()
    for (const doc of testQueueDocs) {
      batch.delete(doc.ref)
    }
    await batch.commit()
  }

  // 2. Delete wire_executions
  if (executionIds.length > 0) {
    // Firestore 'in' query supports max 30 values
    for (let i = 0; i < executionIds.length; i += 30) {
      const chunk = executionIds.slice(i, i + 30)
      const execSnap = await db.collection('wire_executions')
        .where('execution_id', 'in', chunk)
        .get()

      if (!execSnap.empty) {
        const batch = db.batch()
        for (const doc of execSnap.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
      }
    }
  }

  // 3. Delete document_index entries for test client
  const indexSnap = await db.collection('document_index')
    .where('client_id', '==', TEST_CLIENT_ID)
    .get()

  const testIndexDocs = indexSnap.docs.filter(d => {
    const data = d.data()
    const fileName = (data.file_name as string) || ''
    return fileName.includes(testRunId) || fileName.startsWith(TEST_FILE_PREFIX)
  })

  if (testIndexDocs.length > 0) {
    const batch = db.batch()
    for (const doc of testIndexDocs) {
      batch.delete(doc.ref)
    }
    await batch.commit()
  }

  // 4. Delete notifications for test executions
  if (executionIds.length > 0) {
    for (const execId of executionIds) {
      const notifSnap = await db.collection('notifications')
        .where('metadata.execution_id', '==', execId)
        .get()

      if (!notifSnap.empty) {
        const batch = db.batch()
        for (const doc of notifSnap.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
      }
    }
  }
}

/**
 * Delete all test files from a Drive folder (files matching test prefix).
 */
export async function cleanupDriveFolder(folderId: string): Promise<void> {
  const files = await listFolderFiles(folderId)
  const testFiles = files.filter(f => f.name.startsWith(TEST_FILE_PREFIX))

  for (const file of testFiles) {
    await deleteTestFile(file.id)
  }
}
