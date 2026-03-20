/**
 * Google Drive API client for ACF operations.
 * Uses service account auth (full drive scope for create/copy/share).
 * Pattern matches services/intake/src/lib/drive-scanner.ts.
 */

import { google, type drive_v3 } from 'googleapis'

let driveClient: drive_v3.Drive | null = null

export function getDriveClient(): drive_v3.Drive {
  if (!driveClient) {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    driveClient = google.drive({ version: 'v3', auth })
  }
  return driveClient
}

/** Create a folder in Google Drive */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, webViewLink',
  })
  return {
    id: res.data.id!,
    url: res.data.webViewLink || `https://drive.google.com/drive/folders/${res.data.id}`,
  }
}

/** Copy a file (e.g. Ai3 template) into a target folder */
export async function copyFile(
  fileId: string,
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.copy({
    fileId,
    requestBody: { name, parents: [parentId] },
    fields: 'id',
  })
  return res.data.id!
}

/** Move a file to a new folder, optionally renaming it */
export async function moveFileToDrive(
  fileId: string,
  toFolderId: string,
  newName?: string
): Promise<void> {
  const drive = getDriveClient()
  const file = await drive.files.get({ fileId, fields: 'parents' })
  const previousParents = (file.data.parents || []).join(',')
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: previousParents,
    requestBody: newName ? { name: newName } : undefined,
    fields: 'id',
  })
}

/** Share a folder with a Google Workspace domain */
export async function shareWithDomain(
  folderId: string,
  domain: string
): Promise<void> {
  const drive = getDriveClient()
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      role: 'reader',
      type: 'domain',
      domain,
    },
  })
}

/** List subfolders in a given folder */
export async function listSubfolders(
  folderId: string
): Promise<Array<{ id: string; name: string }>> {
  const drive = getDriveClient()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 100,
  })
  return (res.data.files || []).map((f) => ({ id: f.id!, name: f.name! }))
}

/** List non-folder files in a folder (paginated) */
export async function listFolderFiles(
  folderId: string
): Promise<
  Array<{
    id: string
    name: string
    mimeType: string
    modifiedTime: string
    size: number
  }>
> {
  const drive = getDriveClient()
  const files: Array<{
    id: string
    name: string
    mimeType: string
    modifiedTime: string
    size: number
  }> = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields:
        'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 100,
      pageToken,
    })
    for (const f of res.data.files || []) {
      files.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        modifiedTime: f.modifiedTime!,
        size: parseInt(f.size || '0', 10),
      })
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return files
}

/** Check if a Drive folder is accessible */
export async function folderExists(folderId: string): Promise<boolean> {
  const drive = getDriveClient()
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id, trashed',
    })
    return !res.data.trashed
  } catch {
    return false
  }
}

/** Rename a file/folder in Drive */
export async function renameFile(
  fileId: string,
  newName: string
): Promise<void> {
  const drive = getDriveClient()
  await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: 'id',
  })
}

/** Upload a file to a Drive folder from a Buffer */
export async function uploadFileToDrive(
  name: string,
  mimeType: string,
  buffer: Buffer,
  parentId: string
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient()
  const { Readable } = await import('stream')
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
  })
  return {
    id: res.data.id!,
    url: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
  }
}

/** Search for folders by name pattern within a parent */
export async function searchFoldersByName(
  parentId: string,
  namePattern: string
): Promise<Array<{ id: string; name: string; url: string }>> {
  const drive = getDriveClient()
  // Escape single quotes in search pattern
  const safeName = namePattern.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains '${safeName}' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    pageSize: 50,
  })
  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    url:
      f.webViewLink ||
      `https://drive.google.com/drive/folders/${f.id}`,
  }))
}
