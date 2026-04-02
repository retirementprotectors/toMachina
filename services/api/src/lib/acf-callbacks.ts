/**
 * ACF Callbacks — injectable context functions for ACF_FINALIZE super tool.
 * These callbacks bridge between the wire executor (in @tomachina/core) and
 * the API service's access to Google Drive + Firestore.
 */

import { getFirestore } from 'firebase-admin/firestore'
import {
  listSubfolders as driveListSubfolders,
  moveFileToDrive,
  downloadFile as driveDownloadFile,
} from './drive-client.js'

/**
 * Build the 5 callbacks that ACF_FINALIZE expects on SuperToolContext:
 * - downloadFile: Download a file from Google Drive
 * - listSubfolders: List subfolders in a Drive folder
 * - moveFile: Move a file to a target Drive folder
 * - getClientAcfFolder: Look up a client's ACF folder ID from Firestore
 * - updateDocumentIndex: Update or create a document_index entry in Firestore
 */
export function buildAcfCallbacks() {
  const store = getFirestore()

  return {
    downloadFile: driveDownloadFile,
    listSubfolders: driveListSubfolders,
    moveFile: moveFileToDrive,

    getClientAcfFolder: async (clientId: string) => {
      const clientsColl = store.collection('clients')
      const clientDoc = await clientsColl.doc(clientId).get()
      if (!clientDoc.exists) return {}
      const data = clientDoc.data()!
      return { acf_folder_id: data.acf_folder_id as string | undefined }
    },

    updateDocumentIndex: async (fileId: string, updates: Record<string, unknown>) => {
      const indexColl = store.collection('document_index')
      const docRef = indexColl.doc(fileId)
      const now = new Date().toISOString()
      const existing = await docRef.get()
      if (existing.exists) {
        await docRef.update({ ...updates, updated_at: now })
      } else {
        await docRef.set({ ...updates, file_id: fileId, created_at: now, updated_at: now })
      }
    },
  }
}
