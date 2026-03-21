/**
 * Document Index API — serves cached document metadata to ProDash UI
 * Reads from Firestore document_index + document_link_config collections
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'

type FsDoc = Record<string, unknown>

export const documentIndexRoutes = Router()

// GET /api/document-index/client/:clientId — get linked documents for client detail page
documentIndexRoutes.get('/client/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const db = getFirestore()

    // Get document link configs for client_detail
    const configSnap = await db.collection('document_link_config')
      .where('target_ui', '==', 'client_detail')
      .get()
    const configs: FsDoc[] = configSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Get indexed documents for this client
    const indexSnap = await db.collection('document_index')
      .where('client_id', '==', clientId)
      .get()
    const docs: FsDoc[] = indexSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Match documents to configs
    const linked = configs.map(config => {
      const patterns = (config.file_patterns as string[]) || []
      const matching = docs.filter(doc => {
        const fileName = ((doc.file_name as string) || '').toLowerCase()
        return patterns.some(p => {
          if (p === '*') return true
          const pattern = p.replace(/\*/g, '').toLowerCase()
          return fileName.includes(pattern)
        })
      })
      // Sort by modified date, take latest
      matching.sort((a, b) =>
        ((b.modified_at as string) || '').localeCompare((a.modified_at as string) || '')
      )
      return {
        ...config,
        document: matching[0] || null,
        count: matching.length,
      }
    })

    // Sort by priority
    linked.sort((a, b) => (((a as FsDoc).priority as number) || 0) - (((b as FsDoc).priority as number) || 0))

    res.json(successResponse(linked))
  } catch (err) {
    console.error('GET /api/document-index/client error:', err)
    res.status(500).json(errorResponse('Failed to get client documents'))
  }
})

// GET /api/document-index/account/:accountId — get linked documents for account detail page
documentIndexRoutes.get('/account/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = param(req.params.accountId)
    const db = getFirestore()

    // Get the account to find the client_id and product type
    const accountDoc = await db.collection('accounts').doc(accountId).get()
    if (!accountDoc.exists) {
      res.status(404).json(errorResponse('Account not found'))
      return
    }
    const account = accountDoc.data()!
    const clientId = account.client_id as string
    const productType = (account.product_type as string) || (account.account_type as string) || '*'

    // Get document link configs for account_detail
    const configSnap = await db.collection('document_link_config')
      .where('target_ui', '==', 'account_detail')
      .get()
    const configs: FsDoc[] = configSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Filter configs by product type
    const applicable = configs.filter(c => {
      const types = (c.product_types as string[]) || ['*']
      return types.includes('*') || types.includes(productType)
    })

    // Get indexed documents for this client
    const indexSnap = await db.collection('document_index')
      .where('client_id', '==', clientId)
      .get()
    const docs: FsDoc[] = indexSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const linked = applicable.map(config => {
      const patterns = (config.file_patterns as string[]) || []
      const matching = docs.filter(doc => {
        const fileName = ((doc.file_name as string) || '').toLowerCase()
        return patterns.some(p => {
          if (p === '*') return true
          const pattern = p.replace(/\*/g, '').toLowerCase()
          return fileName.includes(pattern)
        })
      })
      matching.sort((a, b) =>
        ((b.modified_at as string) || '').localeCompare((a.modified_at as string) || '')
      )
      return {
        ...config,
        document: matching[0] || null,
        count: matching.length,
      }
    })

    linked.sort((a, b) => (((a as FsDoc).priority as number) || 0) - (((b as FsDoc).priority as number) || 0))

    res.json(successResponse(linked))
  } catch (err) {
    console.error('GET /api/document-index/account error:', err)
    res.status(500).json(errorResponse('Failed to get account documents'))
  }
})

// GET /api/document-index/config — get all document link configs (for admin)
documentIndexRoutes.get('/config', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('document_link_config').orderBy('priority', 'asc').get()
    const configs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(configs))
  } catch (err) {
    console.error('GET /api/document-index/config error:', err)
    res.status(500).json(errorResponse('Failed to get document link config'))
  }
})

// POST /api/document-index/scan/:clientId — scan a client's ACF and index documents
documentIndexRoutes.post('/scan/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const db = getFirestore()

    // Get client's ACF folder ID
    const clientDoc = await db.collection('clients').doc(clientId).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }
    const clientData = clientDoc.data()!
    const folderId = clientData.acf_folder_id as string
    if (!folderId) {
      res.json(successResponse({ indexed: 0, message: 'No ACF folder linked' }))
      return
    }

    // Import drive client to list files
    const { listSubfolders, listFolderFiles } = await import('../lib/drive-client.js')

    // List all subfolders and their files
    let indexed = 0
    const batch = db.batch()
    const now = new Date().toISOString()

    try {
      const subfolders = await listSubfolders(folderId)

      for (const sf of subfolders) {
        try {
          const files = await listFolderFiles(sf.id)
          for (const file of files) {
            const docId = `${clientId}_${file.id}`
            batch.set(db.collection('document_index').doc(docId), {
              client_id: clientId,
              file_id: file.id,
              file_name: file.name,
              document_type: '', // Classification happens separately
              acf_subfolder: sf.name,
              drive_url: `https://drive.google.com/file/d/${file.id}/view`,
              mime_type: file.mimeType,
              size: file.size,
              modified_at: file.modifiedTime,
              indexed_at: now,
            })
            indexed++
          }
        } catch {
          // Skip inaccessible subfolders
        }
      }

      // Also index root-level files
      try {
        const rootFiles = await listFolderFiles(folderId)
        for (const file of rootFiles) {
          const docId = `${clientId}_${file.id}`
          batch.set(db.collection('document_index').doc(docId), {
            client_id: clientId,
            file_id: file.id,
            file_name: file.name,
            document_type: '',
            acf_subfolder: '_root',
            drive_url: `https://drive.google.com/file/d/${file.id}/view`,
            mime_type: file.mimeType,
            size: file.size,
            modified_at: file.modifiedTime,
            indexed_at: now,
          })
          indexed++
        }
      } catch {
        // Skip if root listing fails
      }

      if (indexed > 0) await batch.commit()
    } catch {
      // Drive access failed — return partial results
    }

    res.json(successResponse({ indexed, client_id: clientId }))
  } catch (err) {
    console.error('POST /api/document-index/scan error:', err)
    res.status(500).json(errorResponse('Failed to scan client documents'))
  }
})

// GET /api/document-index/taxonomy — get all document taxonomy entries (for admin)
documentIndexRoutes.get('/taxonomy', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('document_taxonomy').get()
    const entries: FsDoc[] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(entries))
  } catch (err) {
    console.error('GET /api/document-index/taxonomy error:', err)
    res.status(500).json(errorResponse('Failed to get document taxonomy'))
  }
})
