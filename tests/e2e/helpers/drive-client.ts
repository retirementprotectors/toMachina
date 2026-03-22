/**
 * TRK-534: Drive Client Helper — upload/delete/move test PDFs on Shared Drive.
 * Uses googleapis Drive v3 with Application Default Credentials.
 */

import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Readable } from 'stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PDF_PATH = join(__dirname, '..', 'fixtures', 'test-correspondence.pdf')

let driveClient: ReturnType<typeof google.drive> | null = null

function getDrive() {
  if (!driveClient) {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    driveClient = google.drive({ version: 'v3', auth })
  }
  return driveClient
}

/**
 * Upload the test fixture PDF to a Drive folder.
 * Returns the uploaded file's ID.
 */
export async function uploadTestPdf(folderId: string, fileName: string): Promise<string> {
  const drive = getDrive()
  const fileContent = readFileSync(FIXTURE_PDF_PATH)

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(fileContent),
    },
    supportsAllDrives: true,
    fields: 'id',
  })

  return response.data.id!
}

/**
 * Delete a test file from Drive.
 */
export async function deleteTestFile(fileId: string): Promise<void> {
  const drive = getDrive()
  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    })
  } catch {
    // File may already be deleted — ignore
  }
}

/**
 * Move a file between Drive folders.
 */
export async function moveTestFile(
  fileId: string,
  fromFolderId: string,
  toFolderId: string
): Promise<void> {
  const drive = getDrive()
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    supportsAllDrives: true,
  })
}

/**
 * List files in a Drive folder.
 */
export async function listFolderFiles(
  folderId: string
): Promise<Array<{ id: string; name: string }>> {
  const drive = getDrive()
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'files(id, name)',
  })

  return (response.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
  }))
}

/**
 * Find or create a subfolder within a parent folder.
 */
export async function getOrCreateSubfolder(
  parentId: string,
  name: string
): Promise<string> {
  const drive = getDrive()

  // Check if exists
  const existing = await drive.files.list({
    q: `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'files(id)',
  })

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!
  }

  // Create new
  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    supportsAllDrives: true,
    fields: 'id',
  })

  return folder.data.id!
}
