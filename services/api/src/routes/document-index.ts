/**
 * Document Index API — serves cached document metadata to ProDash UI
 * Reads from Firestore document_index + document_link_config collections
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import type {
  DocumentClientLinksData,
  DocumentAccountLinksData,
  DocumentLinkConfigListDTO,
  DocumentLinkConfigResult,
  DocumentLinkConfigUpdateResult,
  DocumentLinkConfigDeleteResult,
  DocumentScanResult,
  DocumentScanAllResult,
  DocumentDedupData,
  DocumentDedupReportData,
  DocumentTaxonomyListDTO,
} from '@tomachina/core'

type FsDoc = Record<string, unknown>

export const documentIndexRoutes = Router()

// GET /api/document-index/client/:clientId — get linked documents for client detail page
documentIndexRoutes.get('/client/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const db = getFirestore()

    // Get document link configs for client_detail (only visible ones)
    const configSnap = await db.collection('document_link_config')
      .where('target_ui', '==', 'client_detail')
      .get()
    const configs: FsDoc[] = configSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as FsDoc))
      .filter(c => c.visible !== false) // hidden configs don't show on UI

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

    res.json(successResponse<DocumentClientLinksData>(linked as unknown as DocumentClientLinksData))
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

    // Resolve the account doc — supports both top-level and clients/{id}/accounts subcollection layouts
    let accountDoc: FirebaseFirestore.DocumentSnapshot | undefined
    const topLevel = await db.collection('accounts').doc(accountId).get()
    if (topLevel.exists) {
      accountDoc = topLevel
    } else {
      const cg = await db.collectionGroup('accounts').get()
      const match = cg.docs.find((d) => d.id === accountId)
      if (match) accountDoc = match
    }

    if (!accountDoc) {
      res.status(404).json(errorResponse('Account not found'))
      return
    }
    const account = accountDoc.data()!
    const clientId = (account.client_id as string) || accountDoc.ref.parent.parent?.id || ''
    const productType = (account.product_type as string) || (account.account_type as string) || '*'

    // Get document link configs for account_detail
    const configSnap = await db.collection('document_link_config')
      .where('target_ui', '==', 'account_detail')
      .get()
    const configs: FsDoc[] = configSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as FsDoc))
      .filter(c => c.visible !== false) // hidden configs don't show on UI

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

    res.json(successResponse<DocumentAccountLinksData>(linked as unknown as DocumentAccountLinksData))
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
    res.json(successResponse<DocumentLinkConfigListDTO>(configs as unknown as DocumentLinkConfigListDTO))
  } catch (err) {
    console.error('GET /api/document-index/config error:', err)
    res.status(500).json(errorResponse('Failed to get document link config'))
  }
})

// POST /api/document-index/config — create or update a document link config
documentIndexRoutes.post('/config', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { document_type, ...rest } = req.body as Record<string, unknown>
    if (!document_type || typeof document_type !== 'string') {
      res.status(400).json(errorResponse('document_type is required'))
      return
    }

    const docId = (document_type as string).toLowerCase().replace(/[^a-z0-9]+/g, '_')
    await db.collection('document_link_config').doc(docId).set(
      { document_type, ...rest, updated_at: new Date().toISOString() },
      { merge: true }
    )
    res.json(successResponse<DocumentLinkConfigResult>({ id: docId, document_type } as unknown as DocumentLinkConfigResult))
  } catch (err) {
    console.error('POST /api/document-index/config error:', err)
    res.status(500).json(errorResponse('Failed to save document link config'))
  }
})

// PUT /api/document-index/config/:configId — update a specific config
documentIndexRoutes.put('/config/:configId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const configId = param(req.params.configId)
    const updates = req.body as Record<string, unknown>

    await db.collection('document_link_config').doc(configId).update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    res.json(successResponse<DocumentLinkConfigUpdateResult>({ id: configId, updated: true } as unknown as DocumentLinkConfigUpdateResult))
  } catch (err) {
    console.error('PUT /api/document-index/config error:', err)
    res.status(500).json(errorResponse('Failed to update document link config'))
  }
})

// DELETE /api/document-index/config/:configId — delete a config
documentIndexRoutes.delete('/config/:configId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const configId = param(req.params.configId)
    await db.collection('document_link_config').doc(configId).delete()
    res.json(successResponse<DocumentLinkConfigDeleteResult>({ id: configId, deleted: true } as unknown as DocumentLinkConfigDeleteResult))
  } catch (err) {
    console.error('DELETE /api/document-index/config error:', err)
    res.status(500).json(errorResponse('Failed to delete document link config'))
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
      res.json(successResponse<DocumentScanResult>({ indexed: 0, message: 'No ACF folder linked' } as unknown as DocumentScanResult))
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

    res.json(successResponse<DocumentScanResult>({ indexed, client_id: clientId } as unknown as DocumentScanResult))
  } catch (err) {
    console.error('POST /api/document-index/scan error:', err)
    res.status(500).json(errorResponse('Failed to scan client documents'))
  }
})

// POST /api/document-index/scan-all — incremental scan of clients with ACF folders
// Only indexes files modified since the last scan. Called daily by Cloud Scheduler.
// Pass ?full=true to force a full re-index of everything.
documentIndexRoutes.post('/scan-all', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { listSubfolders, listFolderFiles } = await import('../lib/drive-client.js')
    const forceFull = req.query.full === 'true'

    // Read last scan timestamp
    const metaRef = db.collection('system_meta').doc('document_index_scan')
    const metaDoc = await metaRef.get()
    const lastScanTime = (!forceFull && metaDoc.exists)
      ? (metaDoc.data()!.last_scan_at as string)
      : undefined

    // Get all clients with ACF folders
    const clientsSnap = await db.collection('clients')
      .where('acf_folder_id', '!=', '')
      .select('acf_folder_id', 'display_name')
      .get()

    const now = new Date().toISOString()
    let totalIndexed = 0
    let clientsScanned = 0
    let clientsSkipped = 0
    let clientsFailed = 0

    // Process 5 clients at a time
    const clients = clientsSnap.docs
    for (let i = 0; i < clients.length; i += 5) {
      const chunk = clients.slice(i, i + 5)
      const results = await Promise.all(chunk.map(async (clientDoc) => {
        const clientId = clientDoc.id
        const folderId = clientDoc.data().acf_folder_id as string
        if (!folderId) return { indexed: 0, ok: true, skipped: true }

        try {
          const batch = db.batch()
          let indexed = 0

          const subfolders = await listSubfolders(folderId)
          for (const sf of subfolders) {
            try {
              const files = await listFolderFiles(sf.id)
              for (const file of files) {
                // Incremental: skip files not modified since last scan
                if (lastScanTime && file.modifiedTime <= lastScanTime) continue

                const docId = `${clientId}_${file.id}`
                const existingDoc = await db.collection('document_index').doc(docId).get()
                const isNew = !existingDoc.exists

                batch.set(db.collection('document_index').doc(docId), {
                  client_id: clientId,
                  file_id: file.id,
                  file_name: file.name,
                  document_type: existingDoc.exists ? (existingDoc.data()!.document_type || '') : '',
                  acf_subfolder: sf.name,
                  drive_url: `https://drive.google.com/file/d/${file.id}/view`,
                  mime_type: file.mimeType,
                  size: file.size,
                  modified_at: file.modifiedTime,
                  indexed_at: now,
                })
                indexed++

                // Queue files for SUPER_EXTRACT pipeline ONLY if:
                // 1. File is extractable (PDF or image)
                // 2. File hasn't already been classified (document_type is empty)
                // 3. File isn't already in the intake queue
                const extractable = file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/')
                const alreadyClassified = existingDoc.exists && (existingDoc.data()!.document_type as string || '').length > 0
                const alreadyQueued = existingDoc.exists && existingDoc.data()!.extraction_queued === true
                if (extractable && !alreadyClassified && !alreadyQueued) {
                  // Mark as queued so we don't re-queue next scan
                  batch.update(db.collection('document_index').doc(docId), { extraction_queued: true })
                  batch.set(db.collection('intake_queue').doc(), {
                    status: 'QUEUED',
                    source: 'ACF_SCAN',
                    file_id: file.id,
                    file_ids: [file.id],
                    client_id: clientId,
                    file_name: file.name,
                    mime_type: file.mimeType,
                    acf_subfolder: sf.name,
                    mode: 'document',
                    created_at: now,
                  })
                }
              }
            } catch {
              // Skip inaccessible subfolder
            }
          }

          if (indexed > 0) await batch.commit()
          return { indexed, ok: true, skipped: false }
        } catch {
          return { indexed: 0, ok: false, skipped: false }
        }
      }))

      for (const r of results) {
        totalIndexed += r.indexed
        if (r.skipped) clientsSkipped++
        else if (r.ok) clientsScanned++
        else clientsFailed++
      }
    }

    // Save scan timestamp for next incremental run
    await metaRef.set({ last_scan_at: now, total_indexed: totalIndexed, mode: forceFull ? 'full' : 'incremental' })

    res.json(successResponse<DocumentScanAllResult>({
      mode: forceFull ? 'full' : 'incremental',
      since: lastScanTime || 'never (first run)',
      clients_scanned: clientsScanned,
      clients_skipped: clientsSkipped,
      clients_failed: clientsFailed,
      total_indexed: totalIndexed,
      scanned_at: now,
    } as unknown as DocumentScanAllResult))
  } catch (err) {
    console.error('POST /api/document-index/scan-all error:', err)
    res.status(500).json(errorResponse('Failed to run proactive scan'))
  }
})

// GET /api/document-index/dedup/:clientId — scan for duplicate files within a client's ACF
documentIndexRoutes.get('/dedup/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const db = getFirestore()

    const clientDoc = await db.collection('clients').doc(clientId).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }
    const clientData = clientDoc.data()!
    const folderId = clientData.acf_folder_id as string
    if (!folderId) {
      res.json(successResponse<DocumentDedupData>({ duplicates: [], total_files: 0, duplicate_groups: 0 } as unknown as DocumentDedupData))
      return
    }

    const { listSubfolders, listFolderFiles } = await import('../lib/drive-client.js')
    const subfolders = await listSubfolders(folderId)

    // Collect all files across all subfolders
    const allFiles: Array<{ name: string; id: string; subfolder: string; size: number; modifiedTime: string }> = []

    for (const sf of subfolders) {
      const files = await listFolderFiles(sf.id)
      for (const f of files) {
        allFiles.push({ name: f.name, id: f.id, subfolder: sf.name, size: f.size, modifiedTime: f.modifiedTime })
      }
    }

    // Also check root-level files
    const rootFiles = await listFolderFiles(folderId)
    for (const f of rootFiles) {
      allFiles.push({ name: f.name, id: f.id, subfolder: '_root', size: f.size, modifiedTime: f.modifiedTime })
    }

    // Find duplicates by exact name match
    const nameMap = new Map<string, typeof allFiles>()
    for (const f of allFiles) {
      const key = f.name.toLowerCase().trim()
      const arr = nameMap.get(key) || []
      arr.push(f)
      nameMap.set(key, arr)
    }

    const duplicates = Array.from(nameMap.entries())
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => ({
        name,
        count: files.length,
        files: files.map(f => ({
          id: f.id,
          subfolder: f.subfolder,
          size: f.size,
          modified_at: f.modifiedTime,
        })),
      }))
      .sort((a, b) => b.count - a.count)

    res.json(successResponse<DocumentDedupData>({ duplicates, total_files: allFiles.length, duplicate_groups: duplicates.length } as unknown as DocumentDedupData))
  } catch (err) {
    console.error('GET /api/document-index/dedup error:', err)
    res.status(500).json(errorResponse('Failed to scan for duplicates'))
  }
})

// GET /api/document-index/dedup-report — scan ALL ACF folders for duplicates (admin)
documentIndexRoutes.get('/dedup-report', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()

    // Get all clients with ACF folders
    const clientsSnap = await db.collection('clients')
      .where('acf_folder_id', '!=', '')
      .select('display_name', 'acf_folder_id')
      .get()

    const { listSubfolders, listFolderFiles } = await import('../lib/drive-client.js')
    const report: Array<{ client_id: string; client_name: string; duplicate_groups: number; total_duplicates: number }> = []

    // Process in batches of 5 to avoid rate limits
    const clients = clientsSnap.docs
    for (let i = 0; i < clients.length; i += 5) {
      const batch = clients.slice(i, i + 5)
      const results = await Promise.all(batch.map(async (clientDoc) => {
        const data = clientDoc.data()
        const folderId = data.acf_folder_id as string
        if (!folderId) return null

        try {
          const subfolders = await listSubfolders(folderId)
          const allFiles: Array<{ name: string }> = []

          for (const sf of subfolders) {
            const files = await listFolderFiles(sf.id)
            allFiles.push(...files.map(f => ({ name: f.name })))
          }

          const nameMap = new Map<string, number>()
          for (const f of allFiles) {
            const key = f.name.toLowerCase().trim()
            nameMap.set(key, (nameMap.get(key) || 0) + 1)
          }

          const dupeGroups = Array.from(nameMap.values()).filter(c => c > 1)
          if (dupeGroups.length === 0) return null

          return {
            client_id: clientDoc.id,
            client_name: (data.display_name as string) || clientDoc.id,
            duplicate_groups: dupeGroups.length,
            total_duplicates: dupeGroups.reduce((sum, c) => sum + c, 0),
          }
        } catch {
          return null
        }
      }))

      report.push(...results.filter((r): r is NonNullable<typeof r> => r !== null))
    }

    report.sort((a, b) => b.total_duplicates - a.total_duplicates)

    res.json(successResponse<DocumentDedupReportData>({
      clients_with_duplicates: report.length,
      total_duplicate_groups: report.reduce((s, r) => s + r.duplicate_groups, 0),
      report,
    } as unknown as DocumentDedupReportData))
  } catch (err) {
    console.error('GET /api/document-index/dedup-report error:', err)
    res.status(500).json(errorResponse('Failed to generate dedup report'))
  }
})

// GET /api/document-index/taxonomy — get all document taxonomy entries (for admin)
documentIndexRoutes.get('/taxonomy', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('document_taxonomy').get()
    const entries: FsDoc[] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse<DocumentTaxonomyListDTO>(entries as unknown as DocumentTaxonomyListDTO))
  } catch (err) {
    console.error('GET /api/document-index/taxonomy error:', err)
    res.status(500).json(errorResponse('Failed to get document taxonomy'))
  }
})
