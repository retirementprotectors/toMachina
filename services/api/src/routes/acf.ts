/**
 * ACF (Active Client File) API Routes
 * Implements 5 ATLAS-registered tools: acf-status, acf-create, acf-route, acf-audit, acf-rebuild
 * Plus config management (GET/PUT /config) and full detail (GET /:clientId)
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  param,
  validateRequired,
} from '../lib/helpers.js'
import {
  createFolder,
  copyFile,
  shareWithDomain,
  listSubfolders,
  listFolderFiles,
  folderExists,
  moveFileToDrive,
  renameFile,
  searchFoldersByName,
  uploadFileToDrive,
} from '../lib/drive-client.js'
import type {
  ACFConfig,
  ACFStatus,
  ACFCreateOutput,
  ACFRouteOutput,
  ACFAuditOutput,
  ACFRebuildOutput,
} from '@tomachina/core'

export const acfRoutes = Router()

// ---------------------------------------------------------------------------
// Helper: load ACF config from Firestore
// ---------------------------------------------------------------------------
async function loadConfig(): Promise<ACFConfig> {
  const store = getFirestore()
  const acfColl = store.collection('acf_config')
  const doc = await acfColl.doc('default').get()
  if (!doc.exists) {
    throw new Error('ACF config not found — run populate-acf-config.ts first')
  }
  return doc.data() as ACFConfig
}

// ---------------------------------------------------------------------------
// Helper: build ACF status for a single client
// ---------------------------------------------------------------------------
async function getACFStatus(clientId: string): Promise<ACFStatus> {
  const store = getFirestore()
  const clientsColl = store.collection('clients')
  const clientDoc = await clientsColl.doc(clientId).get()

  const empty: ACFStatus = {
    exists: false,
    folder_id: null,
    folder_url: null,
    complete: false,
    subfolder_count: 0,
    document_count: 0,
    ai3_present: false,
    last_updated: null,
  }

  if (!clientDoc.exists) return empty

  const data = clientDoc.data()!
  const folderId = data.acf_folder_id as string | undefined
  const folderUrl = data.acf_folder_url as string | undefined

  if (!folderId) {
    return { ...empty, folder_url: folderUrl || null }
  }

  // Trust Firestore — if folder ID exists, report it as existing.
  // Drive listing may fail if service account lacks access to legacy folders.
  const baseStatus: ACFStatus = {
    exists: true,
    folder_id: folderId,
    folder_url: folderUrl || `https://drive.google.com/drive/folders/${folderId}`,
    complete: false,
    subfolder_count: 0,
    document_count: 0,
    ai3_present: false,
    last_updated: null,
  }

  try {
    const accessible = await folderExists(folderId)
    if (!accessible) return baseStatus // Folder exists in Firestore but Drive can't verify — return basic status

    const config = await loadConfig()
    const subfolders = await listSubfolders(folderId)
    const rootFiles = await listFolderFiles(folderId)

    let totalDocs = rootFiles.length
    for (const sf of subfolders) {
      const sfFiles = await listFolderFiles(sf.id)
      totalDocs += sfFiles.length
    }

    const ai3Present = rootFiles.some(
      (f) =>
        f.mimeType === 'application/vnd.google-apps.spreadsheet' &&
        f.name.toLowerCase().includes('ai3')
    )

    const complete =
      subfolders.length >= config.subfolders.length && ai3Present

    const lastMod =
      rootFiles.length > 0
        ? rootFiles.reduce(
            (latest, f) =>
              f.modifiedTime > latest ? f.modifiedTime : latest,
            rootFiles[0].modifiedTime
          )
        : null

    return {
      exists: true,
      folder_id: folderId,
      folder_url: folderUrl || `https://drive.google.com/drive/folders/${folderId}`,
      complete,
      subfolder_count: subfolders.length,
      document_count: totalDocs,
      ai3_present: ai3Present,
      last_updated: lastMod,
    }
  } catch {
    // Drive API failure — return basic status from Firestore
    return baseStatus
  }
}

// ---------------------------------------------------------------------------
// Helper: create ACF for a client
// ---------------------------------------------------------------------------
async function createACF(
  clientId: string,
  clientName: string,
  sourceFileIds?: string[],
  householdId?: string,
  configOverride?: Partial<ACFConfig>
): Promise<ACFCreateOutput> {
  const store = getFirestore()
  const config = { ...(await loadConfig()), ...configOverride }

  // Household-aware: check if should nest under household folder
  let parentFolderId = config.template_folder_id
  if (householdId) {
    const hhColl = store.collection('households')
    const hhDoc = await hhColl.doc(householdId).get()
    if (hhDoc.exists && hhDoc.data()?.acf_folder_id) {
      parentFolderId = hhDoc.data()!.acf_folder_id as string
    }
  }

  // Build folder name from naming pattern
  const nameParts = clientName.split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  const folderName = config.naming_pattern
    .replace('{first_name}', firstName)
    .replace('{last_name}', lastName)

  // Create main folder
  const folder = await createFolder(folderName, parentFolderId)

  // Create subfolders
  const subfolderIds: Record<string, string> = {}
  for (const sfName of config.subfolders) {
    const sf = await createFolder(sfName, folder.id)
    subfolderIds[sfName] = sf.id
  }

  // Copy Ai3 template
  let ai3Id: string | undefined
  if (config.ai3_template_id) {
    try {
      ai3Id = await copyFile(
        config.ai3_template_id,
        `Ai3 - ${clientName}`,
        folder.id
      )
    } catch {
      // Ai3 copy failed — non-fatal
    }
  }

  // Share with domain
  if (config.share_domain) {
    try {
      await shareWithDomain(folder.id, config.share_domain)
    } catch {
      // Sharing failed — non-fatal
    }
  }

  // Copy source documents if provided
  let filesCopied = 0
  if (sourceFileIds?.length && subfolderIds[config.default_subfolder]) {
    for (const fileId of sourceFileIds) {
      try {
        await moveFileToDrive(fileId, subfolderIds[config.default_subfolder])
        filesCopied++
      } catch {
        // Skip failed file moves
      }
    }
  }

  // Write ACF reference to client doc
  const clientsColl = store.collection('clients')
  const clientRef = clientsColl.doc(clientId)
  await clientRef.update({
    acf_folder_id: folder.id,
    acf_folder_url: folder.url,
    updated_at: new Date().toISOString(),
  })

  // Log activity
  const activitiesColl = clientRef.collection('activities')
  await activitiesColl.add({
    type: 'acf_created',
    description: `ACF folder created: ${folderName}`,
    folder_id: folder.id,
    folder_url: folder.url,
    created_at: new Date().toISOString(),
  })

  return {
    success: true,
    folder_id: folder.id,
    folder_url: folder.url,
    subfolder_ids: subfolderIds,
    ai3_id: ai3Id,
    files_copied: filesCopied,
    action: 'created_new',
  }
}

// ===================================================================
// STATIC ROUTES (must be registered before parameterized routes)
// ===================================================================

// ---------------------------------------------------------------------------
// GET /api/acf/config — get ACF configuration
// ---------------------------------------------------------------------------
acfRoutes.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await loadConfig()
    res.json(successResponse(config))
  } catch (err) {
    console.error('GET /api/acf/config error:', err)
    res.status(500).json(errorResponse('Failed to get ACF config'))
  }
})

// ---------------------------------------------------------------------------
// PUT /api/acf/config — update ACF configuration
// ---------------------------------------------------------------------------
acfRoutes.put('/config', async (req: Request, res: Response) => {
  try {
    const store = getFirestore()
    const updates = req.body as Partial<ACFConfig>
    const acfColl = store.collection('acf_config')
    const configRef = acfColl.doc('default')
    await configRef.update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    const config = await loadConfig()
    res.json(successResponse(config))
  } catch (err) {
    console.error('PUT /api/acf/config error:', err)
    res.status(500).json(errorResponse('Failed to update ACF config'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/acf/audit — audit all clients for ACF completeness
// ---------------------------------------------------------------------------
acfRoutes.post('/audit', async (_req: Request, res: Response) => {
  try {
    const store = getFirestore()
    const clientsColl = store.collection('clients')
    const clientsSnap = await clientsColl
      .select('acf_folder_id', 'acf_folder_url', 'first_name', 'last_name')
      .get()

    const result: ACFAuditOutput = {
      total_clients: clientsSnap.size,
      with_acf: 0,
      missing_acf: 0,
      broken_links: 0,
      incomplete_acf: 0,
      orphaned_acfs: 0,
      clients_missing_acf: [],
      clients_broken: [],
      clients_incomplete: [],
    }

    const config = await loadConfig()

    for (const doc of clientsSnap.docs) {
      const data = doc.data()
      const folderId = data.acf_folder_id as string | undefined

      if (!folderId) {
        result.missing_acf++
        result.clients_missing_acf.push(doc.id)
        continue
      }

      // Verify accessibility
      const accessible = await folderExists(folderId)
      if (!accessible) {
        result.broken_links++
        result.clients_broken.push(doc.id)
        continue
      }

      // Check completeness
      const subfolders = await listSubfolders(folderId)
      const rootFiles = await listFolderFiles(folderId)
      const ai3Present = rootFiles.some(
        (f) =>
          f.mimeType === 'application/vnd.google-apps.spreadsheet' &&
          f.name.toLowerCase().includes('ai3')
      )
      const complete =
        subfolders.length >= config.subfolders.length && ai3Present

      if (!complete) {
        result.incomplete_acf++
        result.clients_incomplete.push(doc.id)
      }

      result.with_acf++
    }

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/acf/audit error:', err)
    res.status(500).json(errorResponse('ACF audit failed'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/acf/rebuild — bulk rebuild ACFs
// ---------------------------------------------------------------------------
acfRoutes.post('/rebuild', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['client_ids', 'mode'])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const { client_ids, mode, dry_run } = req.body as {
      client_ids: string[]
      mode: string
      dry_run?: boolean
    }
    const store = getFirestore()
    const config = await loadConfig()
    const clientsColl = store.collection('clients')

    const result: ACFRebuildOutput = {
      processed: 0,
      created: 0,
      fixed: 0,
      skipped: 0,
      errors: [],
    }

    for (const clientId of client_ids) {
      result.processed++
      const clientDoc = await clientsColl.doc(clientId).get()

      if (!clientDoc.exists) {
        result.errors.push({ client_id: clientId, error: 'Client not found' })
        continue
      }

      const client = clientDoc.data()!
      const clientName =
        `${client.first_name || ''} ${client.last_name || ''}`.trim() ||
        clientId

      if (dry_run) {
        if (mode === 'create_missing' && !client.acf_folder_id)
          result.created++
        else if (mode === 'fix_broken' && client.acf_folder_id)
          result.fixed++
        else if (mode === 'full_rebuild') result.created++
        else result.skipped++
        continue
      }

      try {
        if (mode === 'create_missing') {
          if (client.acf_folder_id) {
            result.skipped++
            continue
          }
          await createACF(
            clientId,
            clientName,
            undefined,
            client.household_id as string | undefined
          )
          result.created++
        } else if (mode === 'fix_broken') {
          if (!client.acf_folder_id) {
            result.skipped++
            continue
          }
          const accessible = await folderExists(
            client.acf_folder_id as string
          )
          if (accessible) {
            result.skipped++
            continue
          }

          // Try to find existing folder by name pattern
          const nameParts = clientName.split(' ')
          const searchName = config.naming_pattern
            .replace('{first_name}', nameParts[0] || '')
            .replace('{last_name}', nameParts.slice(1).join(' ') || '')

          const found = await searchFoldersByName(
            config.template_folder_id,
            searchName
          )
          if (found.length > 0) {
            const clientRef = clientsColl.doc(clientId)
            await clientRef.update({
              acf_folder_id: found[0].id,
              acf_folder_url: found[0].url,
              updated_at: new Date().toISOString(),
            })
            result.fixed++
          } else {
            await createACF(
              clientId,
              clientName,
              undefined,
              client.household_id as string | undefined
            )
            result.created++
          }
        } else if (mode === 'full_rebuild') {
          // Archive existing
          if (client.acf_folder_id) {
            try {
              await renameFile(
                client.acf_folder_id as string,
                `${clientName} - OLD ${new Date().toISOString().slice(0, 10)}`
              )
            } catch {
              // Rename failed — folder may not exist
            }
          }
          await createACF(
            clientId,
            clientName,
            undefined,
            client.household_id as string | undefined
          )
          result.created++
        }
      } catch (e) {
        result.errors.push({
          client_id: clientId,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/acf/rebuild error:', err)
    res.status(500).json(errorResponse('ACF rebuild failed'))
  }
})

// ===================================================================
// PARAMETERIZED ROUTES
// ===================================================================

// ---------------------------------------------------------------------------
// GET /api/acf/status/:clientId — ACF status for a single client
// ---------------------------------------------------------------------------
acfRoutes.get('/status/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const status = await getACFStatus(clientId)
    res.json(successResponse(status))
  } catch (err) {
    console.error('GET /api/acf/status error:', err)
    res.status(500).json(errorResponse('Failed to get ACF status'))
  }
})

// ---------------------------------------------------------------------------
// GET /api/acf/:clientId — full ACF detail (subfolders + files)
// ---------------------------------------------------------------------------
acfRoutes.get('/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const store = getFirestore()
    const clientsColl = store.collection('clients')
    const clientDoc = await clientsColl.doc(clientId).get()

    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const data = clientDoc.data()!
    const folderId = data.acf_folder_id as string | undefined

    if (!folderId) {
      res.json(successResponse({ exists: false, subfolders: [] }))
      return
    }

    const folderUrl = (data.acf_folder_url || `https://drive.google.com/drive/folders/${folderId}`) as string

    // Try Drive listing — gracefully degrade if service account lacks access
    try {
      const accessible = await folderExists(folderId)
      if (!accessible) {
        // Folder ID in Firestore but Drive can't verify — return basic info with Open in Drive link
        res.json(
          successResponse({
            exists: true,
            folder_id: folderId,
            folder_url: folderUrl,
            subfolders: [],
            root_files: [],
            drive_limited: true,
          })
        )
        return
      }

      // Full Drive listing
      const subfolders = await listSubfolders(folderId)
      const subfolderDetails = await Promise.all(
        subfolders.map(async (sf) => {
          const files = await listFolderFiles(sf.id)
          return {
            id: sf.id,
            name: sf.name,
            file_count: files.length,
            files: files.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              modifiedTime: f.modifiedTime,
              size: f.size,
            })),
          }
        })
      )

      const rootFiles = await listFolderFiles(folderId)

      res.json(
        successResponse({
          exists: true,
          folder_id: folderId,
          folder_url: folderUrl,
          subfolders: subfolderDetails,
          root_files: rootFiles,
        })
      )
    } catch {
      // Drive API failure — return basic info from Firestore
      res.json(
        successResponse({
          exists: true,
          folder_id: folderId,
          folder_url: folderUrl,
          subfolders: [],
          root_files: [],
          drive_limited: true,
        })
      )
    }
  } catch (err) {
    console.error('GET /api/acf/:clientId error:', err)
    res.status(500).json(errorResponse('Failed to get ACF details'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/acf/:clientId/create — create ACF for a client
// ---------------------------------------------------------------------------
acfRoutes.post('/:clientId/create', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const store = getFirestore()
    const clientsColl = store.collection('clients')
    const clientDoc = await clientsColl.doc(clientId).get()

    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const client = clientDoc.data()!
    if (client.acf_folder_id) {
      const accessible = await folderExists(client.acf_folder_id as string)
      if (accessible) {
        res.status(409).json(errorResponse('Client already has an ACF folder'))
        return
      }
    }

    const clientName =
      `${client.first_name || ''} ${client.last_name || ''}`.trim() ||
      clientId
    const result = await createACF(
      clientId,
      clientName,
      req.body.source_file_ids,
      client.household_id as string | undefined,
      req.body.config
    )
    res.json(successResponse(result))
  } catch (err) {
    console.error('POST /api/acf/:clientId/create error:', err)
    res.status(500).json(errorResponse('Failed to create ACF'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/acf/:clientId/route — route documents to ACF subfolder
// ---------------------------------------------------------------------------
acfRoutes.post('/:clientId/route', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const err = validateRequired(req.body, ['file_ids', 'target_subfolder'])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const { file_ids, target_subfolder, label, enforce_naming } = req.body as {
      file_ids: string[]
      target_subfolder: string
      label?: string
      enforce_naming?: boolean
    }
    const store = getFirestore()
    const clientsColl = store.collection('clients')
    const clientDoc = await clientsColl.doc(clientId).get()

    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const data = clientDoc.data()!
    const folderId = data.acf_folder_id as string | undefined

    if (!folderId) {
      const output: ACFRouteOutput = {
        success: true,
        routed: 0,
        skipped: 0,
        acf_missing: true,
      }
      res.json(successResponse(output))
      return
    }

    // Find target subfolder
    const subfolders = await listSubfolders(folderId)
    const targetSf = subfolders.find((sf) => sf.name === target_subfolder)

    if (!targetSf) {
      res
        .status(400)
        .json(
          errorResponse(`Subfolder '${target_subfolder}' not found in ACF`)
        )
      return
    }

    let routed = 0
    let skipped = 0
    const renamed: string[] = []

    // TRK-466: File naming enforcement
    // If enforce_naming is true or label is provided, rename files to match
    // the taxonomy naming convention: "ClientLastName - DocumentType"
    const clientName = (data.last_name as string) || (data.display_name as string) || ''

    for (const fileId of file_ids) {
      try {
        // Build standardized name if enforcement is on
        let newName: string | undefined = label || undefined
        if (enforce_naming && clientName && !label) {
          // Look up taxonomy for the target subfolder to get file_label_template
          const taxSnap = await store
            .collection('document_taxonomy')
            .where('acf_subfolder', '==', target_subfolder)
            .where('active', '==', true)
            .limit(1)
            .get()
          if (!taxSnap.empty) {
            const taxData = taxSnap.docs[0].data()
            const template = taxData.file_label_template as string | undefined
            if (template) {
              newName = template
                .replace('{client_name}', clientName)
                .replace('{date}', new Date().toISOString().slice(0, 10))
            }
          }
        }

        await moveFileToDrive(fileId, targetSf.id, newName)
        routed++
        if (newName) renamed.push(newName)
      } catch {
        skipped++
      }
    }

    // Log activity
    const clientRef = clientsColl.doc(clientId)
    const activitiesColl = clientRef.collection('activities')
    await activitiesColl.add({
      type: 'acf_route',
      description: `Routed ${routed} file(s) to ${target_subfolder}`,
      target_subfolder,
      routed,
      skipped,
      created_at: new Date().toISOString(),
    })

    const output: ACFRouteOutput = {
      success: true,
      routed,
      skipped,
      acf_missing: false,
    }
    res.json(successResponse(output))
  } catch (err) {
    console.error('POST /api/acf/:clientId/route error:', err)
    res.status(500).json(errorResponse('Failed to route documents'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/acf/:clientId/upload — upload a file to an ACF subfolder
// Accepts base64-encoded file in JSON body (consistent with tracker attachments)
// ---------------------------------------------------------------------------
acfRoutes.post('/:clientId/upload', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const err = validateRequired(req.body, [
      'file_name',
      'file_data',
      'mime_type',
      'target_subfolder',
    ])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const { file_name, file_data, mime_type, target_subfolder } = req.body as {
      file_name: string
      file_data: string // base64
      mime_type: string
      target_subfolder: string
    }

    // Validate base64 payload size (10MB max after decode)
    const buffer = Buffer.from(file_data, 'base64')
    if (buffer.length > 10 * 1024 * 1024) {
      res.status(413).json(errorResponse('File exceeds 10MB limit'))
      return
    }

    const store = getFirestore()
    const clientsColl = store.collection('clients')
    const clientDoc = await clientsColl.doc(clientId).get()

    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const data = clientDoc.data()!
    const folderId = data.acf_folder_id as string | undefined

    if (!folderId) {
      res.status(400).json(errorResponse('Client has no ACF folder — create one first'))
      return
    }

    // Find the target subfolder
    const subfolders = await listSubfolders(folderId)
    const targetSf = subfolders.find((sf) => sf.name === target_subfolder)

    if (!targetSf) {
      res
        .status(400)
        .json(
          errorResponse(`Subfolder '${target_subfolder}' not found in ACF`)
        )
      return
    }

    // Upload to Drive
    const uploaded = await uploadFileToDrive(
      file_name,
      mime_type,
      buffer,
      targetSf.id
    )

    // Log activity
    const clientRef = clientsColl.doc(clientId)
    const activitiesColl = clientRef.collection('activities')
    const userEmail =
      (
        req as unknown as Record<string, unknown> & {
          user?: { email?: string }
        }
      ).user?.email || 'api'

    await activitiesColl.add({
      type: 'acf_upload',
      description: `Uploaded ${file_name} to ${target_subfolder}`,
      file_id: uploaded.id,
      file_name,
      target_subfolder,
      uploaded_by: userEmail,
      created_at: new Date().toISOString(),
    })

    // Queue extractable files (PDF, images) for SUPER_EXTRACT pipeline
    const extractable = mime_type === 'application/pdf' || mime_type.startsWith('image/')
    if (extractable) {
      const store = getFirestore()
      await store.collection('intake_queue').add({
        status: 'QUEUED',
        source: 'ACF_UPLOAD',
        file_id: uploaded.id,
        file_ids: [uploaded.id],
        client_id: clientId,
        file_name,
        mime_type,
        acf_subfolder: target_subfolder,
        mode: 'document',
        user_email: userEmail,
        created_at: new Date().toISOString(),
      })
    }

    res.json(
      successResponse({
        file_id: uploaded.id,
        file_url: uploaded.url,
        file_name,
        target_subfolder,
        extraction_queued: extractable,
      })
    )
  } catch (err) {
    console.error('POST /api/acf/:clientId/upload error:', err)
    res.status(500).json(errorResponse('Failed to upload file'))
  }
})

// ---------------------------------------------------------------------------
// GET /api/acf/file/:fileId/preview — get embeddable preview URL
// ---------------------------------------------------------------------------
acfRoutes.get('/file/:fileId/preview', async (req: Request, res: Response) => {
  try {
    const fileId = param(req.params.fileId)
    const { getPreviewUrl } = await import('../lib/drive-client.js')

    // Get file metadata to determine mime type
    const { getDriveClient } = await import('../lib/drive-client.js')
    const drive = getDriveClient()
    const meta = await drive.files.get({ fileId, fields: 'mimeType, name, webViewLink' })

    res.json(successResponse({
      preview_url: getPreviewUrl(fileId, meta.data.mimeType!),
      file_name: meta.data.name,
      mime_type: meta.data.mimeType,
    }))
  } catch (err) {
    console.error('GET /api/acf/file/:fileId/preview error:', err)
    res.status(500).json(errorResponse('Failed to get file preview'))
  }
})

// ---------------------------------------------------------------------------
// GET /api/acf/file/:fileId/download — stream file download through our API
// ---------------------------------------------------------------------------
acfRoutes.get('/file/:fileId/download', async (req: Request, res: Response) => {
  try {
    const fileId = param(req.params.fileId)
    const { downloadFile } = await import('../lib/drive-client.js')

    const { buffer, mimeType, name } = await downloadFile(fileId)

    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (err) {
    console.error('GET /api/acf/file/:fileId/download error:', err)
    res.status(500).json(errorResponse('Failed to download file'))
  }
})

// ---------------------------------------------------------------------------
// POST /api/acf/:clientId/move — move a file between ACF subfolders
// ---------------------------------------------------------------------------
acfRoutes.post('/:clientId/move', async (req: Request, res: Response) => {
  try {
    const clientId = param(req.params.clientId)
    const err = validateRequired(req.body, ['file_id', 'from_subfolder', 'to_subfolder'])
    if (err) {
      res.status(400).json(errorResponse(err))
      return
    }

    const { file_id, from_subfolder, to_subfolder } = req.body as {
      file_id: string
      from_subfolder: string
      to_subfolder: string
    }

    if (from_subfolder === to_subfolder) {
      res.json(successResponse({ moved: false, reason: 'Same subfolder' }))
      return
    }

    const store = getFirestore()
    const clientDoc = await store.collection('clients').doc(clientId).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const folderId = clientDoc.data()!.acf_folder_id as string
    if (!folderId) {
      res.status(400).json(errorResponse('Client has no ACF folder'))
      return
    }

    const subfolders = await listSubfolders(folderId)
    const fromSf = subfolders.find(sf => sf.name === from_subfolder)
    const toSf = subfolders.find(sf => sf.name === to_subfolder)

    if (!fromSf || !toSf) {
      res.status(400).json(errorResponse(`Subfolder not found: ${!fromSf ? from_subfolder : to_subfolder}`))
      return
    }

    await moveFileToDrive(file_id, toSf.id)

    // Log activity
    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'
    await store.collection('clients').doc(clientId).collection('activities').add({
      type: 'acf_move',
      description: `Moved file from ${from_subfolder} to ${to_subfolder}`,
      file_id,
      from_subfolder,
      to_subfolder,
      moved_by: userEmail,
      created_at: new Date().toISOString(),
    })

    res.json(successResponse({ moved: true, file_id, from_subfolder, to_subfolder }))
  } catch (err) {
    console.error('POST /api/acf/:clientId/move error:', err)
    res.status(500).json(errorResponse('Failed to move file'))
  }
})
