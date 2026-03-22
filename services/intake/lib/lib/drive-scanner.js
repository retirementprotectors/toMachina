/**
 * Google Drive API folder scanning — replaces GAS DriveApp.
 * Uses googleapis library for server-side Drive access.
 */
import { google } from 'googleapis';
let driveClient = null;
function getDrive() {
    if (!driveClient) {
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        driveClient = google.drive({ version: 'v3', auth });
    }
    return driveClient;
}
/**
 * List files in a folder, optionally filtering by modified time.
 */
export async function listFolderFiles(folderId, modifiedAfter) {
    const drive = getDrive();
    const files = [];
    let query = `'${folderId}' in parents and trashed = false`;
    if (modifiedAfter) {
        query += ` and modifiedTime > '${modifiedAfter}'`;
    }
    let pageToken;
    do {
        const res = await drive.files.list({
            q: query,
            fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)',
            pageSize: 100,
            pageToken,
            orderBy: 'modifiedTime desc',
        });
        for (const f of res.data.files || []) {
            files.push({
                id: f.id,
                name: f.name,
                mimeType: f.mimeType,
                size: parseInt(f.size || '0', 10),
                createdTime: f.createdTime,
                modifiedTime: f.modifiedTime,
                parents: f.parents,
                webViewLink: f.webViewLink || undefined,
            });
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return files;
}
/**
 * List subfolders in a given folder.
 */
export async function listSubfolders(folderId) {
    const drive = getDrive();
    const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 100,
    });
    return (res.data.files || []).map(f => ({ id: f.id, name: f.name }));
}
/**
 * Move a file from one folder to another.
 */
export async function moveFile(fileId, fromFolderId, toFolderId) {
    const drive = getDrive();
    await drive.files.update({
        fileId,
        addParents: toFolderId,
        removeParents: fromFolderId,
        fields: 'id, parents',
    });
}
/**
 * Get or create a subfolder by name within a parent folder.
 * Returns the existing subfolder if found, otherwise creates it.
 */
export async function getOrCreateSubfolder(parentId, name) {
    const existing = await listSubfolders(parentId);
    const match = existing.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (match)
        return match;
    const drive = getDrive();
    const res = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id, name',
    });
    return { id: res.data.id, name: res.data.name };
}
/**
 * Get file metadata.
 */
export async function getFileMetadata(fileId) {
    const drive = getDrive();
    try {
        const res = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink',
        });
        const f = res.data;
        return {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: parseInt(f.size || '0', 10),
            createdTime: f.createdTime,
            modifiedTime: f.modifiedTime,
            parents: f.parents,
            webViewLink: f.webViewLink || undefined,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=drive-scanner.js.map