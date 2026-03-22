import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'
import type { DropzoneUploadResult } from '@tomachina/core'
import { randomUUID } from 'crypto'
import multer from 'multer'
import { uploadFileToDrive } from '../lib/drive-client.js'

export const dropzoneRoutes = Router()

// Multer: store file in memory (Buffer) for Drive upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
})

// Intake uploads land in this Drive folder (Shared Drive root for intake)
const INTAKE_UPLOAD_FOLDER = process.env.INTAKE_UPLOAD_FOLDER_ID || '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'

function getUserEmail(req: Request): string {
  return (
    (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
  )
}

// POST / — Upload file + create intake_queue entry
dropzoneRoutes.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const source = (req.body as Record<string, string>).source || 'INTAKE_UPLOAD'
    const file = (req as Request & { file?: Express.Multer.File }).file

    // Support legacy metadata-only requests (backward compat)
    if (!file) {
      const { file_name, file_type, file_size } = req.body as {
        file_name?: string
        file_type?: string
        file_size?: number
      }
      if (!file_name || !file_type) {
        res.status(400).json(errorResponse('file is required (multipart) or file_name + file_type (metadata-only)'))
        return
      }

      const db = getFirestore()
      const queue_id = randomUUID()
      const now = new Date().toISOString()
      await db.collection('intake_queue').doc(queue_id).set({
        queue_id, source, file_name, file_type,
        file_size: file_size ?? null, file_id: null,
        status: 'pending', _created_by: getUserEmail(req),
        created_at: now, updated_at: now,
      })
      res.json(successResponse({ queue_id, file_id: null }))
      return
    }

    // Upload file bytes to Google Drive
    const driveResult = await uploadFileToDrive(
      file.originalname,
      file.mimetype,
      file.buffer,
      INTAKE_UPLOAD_FOLDER
    )

    // Create intake_queue entry with real file_id
    const db = getFirestore()
    const queue_id = randomUUID()
    const _created_by = getUserEmail(req)
    const now = new Date().toISOString()

    const entry = {
      queue_id,
      source,
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      file_id: driveResult.id,
      file_url: driveResult.url,
      status: 'pending',
      _created_by,
      created_at: now,
      updated_at: now,
    }

    await db.collection('intake_queue').doc(queue_id).set(entry)

    res.json(successResponse({
      queue_id,
      file_id: driveResult.id,
      file_url: driveResult.url,
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json(errorResponse(msg))
  }
})
