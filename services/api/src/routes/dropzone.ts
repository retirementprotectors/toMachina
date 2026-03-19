import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'
import { randomUUID } from 'crypto'

export const dropzoneRoutes = Router()

function getUserEmail(req: Request): string {
  return (
    (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
  )
}

// POST / — Create intake_queue entry
dropzoneRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { source, file_name, file_type, file_size } = req.body as {
      source?: string
      file_name?: string
      file_type?: string
      file_size?: number
    }

    if (!source || !file_name || !file_type) {
      res.status(400).json(errorResponse('source, file_name, and file_type are required'))
      return
    }

    const db = getFirestore()
    const queue_id = randomUUID()
    const created_by = getUserEmail(req)
    const now = new Date().toISOString()

    const entry = {
      queue_id,
      source,
      file_name,
      file_type,
      file_size: file_size ?? null,
      file_id: null,
      status: 'pending',
      created_by,
      created_at: now,
      updated_at: now,
    }

    await db.collection('intake_queue').doc(queue_id).set(entry)

    res.json(successResponse({ queue_id, file_id: null }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json(errorResponse(msg))
  }
})
