/**
 * Google Drive API folder scanning — replaces GAS DriveApp.
 * Uses googleapis library for server-side Drive access.
 */
export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdTime: string;
    modifiedTime: string;
    parents?: string[];
    webViewLink?: string;
}
/**
 * List files in a folder, optionally filtering by modified time.
 */
export declare function listFolderFiles(folderId: string, modifiedAfter?: string): Promise<DriveFile[]>;
/**
 * List subfolders in a given folder.
 */
export declare function listSubfolders(folderId: string): Promise<Array<{
    id: string;
    name: string;
}>>;
/**
 * Move a file from one folder to another.
 */
export declare function moveFile(fileId: string, fromFolderId: string, toFolderId: string): Promise<void>;
/**
 * Get or create a subfolder by name within a parent folder.
 * Returns the existing subfolder if found, otherwise creates it.
 */
export declare function getOrCreateSubfolder(parentId: string, name: string): Promise<{
    id: string;
    name: string;
}>;
/**
 * Get file metadata.
 */
export declare function getFileMetadata(fileId: string): Promise<DriveFile | null>;
//# sourceMappingURL=drive-scanner.d.ts.map