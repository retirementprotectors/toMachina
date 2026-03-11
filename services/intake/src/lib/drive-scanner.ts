/**
 * Google Drive API folder scanning — replaces GAS DriveApp.
 * Uses googleapis library for server-side Drive access.
 */

import { google, type drive_v3 } from 'googleapis'

let driveClient: drive_v3.Drive | null = null

function getDrive(): drive_v3.Drive {
  if (!driveClient) {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })
    driveClient = google.drive({ version: 'v3', auth })
  }
  return driveClient
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  createdTime: string
  modifiedTime: string
  parents?: string[]
  webViewLink?: string
}

/**
 * List files in a folder, optionally filtering by modified time.
 */
export async function listFolderFiles(
  folderId: string,
  modifiedAfter?: string
): Promise<DriveFile[]> {
  const drive = getDrive()
  const files: DriveFile[] = []

  let query = `'${folderId}' in parents and trashed = false`
  if (modifiedAfter) {
    query += ` and modifiedTime > '${modifiedAfter}'`
  }

  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)',
      pageSize: 100,
      pageToken,
      orderBy: 'modifiedTime desc',
    })

    for (const f of res.data.files || []) {
      files.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: parseInt(f.size || '0', 10),
        createdTime: f.createdTime!,
        modifiedTime: f.modifiedTime!,
        parents: f.parents as string[] | undefined,
        webViewLink: f.webViewLink || undefined,
      })
    }

    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return files
}

/**
 * List subfolders in a given folder.
 */
export async function listSubfolders(folderId: string): Promise<Array<{ id: string; name: string }>> {
  const drive = getDrive()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 100,
  })

  return (res.data.files || []).map(f => ({ id: f.id!, name: f.name! }))
}

/**
 * Move a file from one folder to another.
 */
export async function moveFile(fileId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  const drive = getDrive()
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    fields: 'id, parents',
  })
}

/**
 * Get file metadata.
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile | null> {
  const drive = getDrive()
  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink',
    })
    const f = res.data
    return {
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: parseInt(f.size || '0', 10),
      createdTime: f.createdTime!,
      modifiedTime: f.modifiedTime!,
      parents: f.parents as string[] | undefined,
      webViewLink: f.webViewLink || undefined,
    }
  } catch {
    return null
  }
}
