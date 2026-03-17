import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue, type Query, type DocumentData } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import crypto from 'crypto'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  validateRequired,
  stripInternalFields,
  param,
} from '../lib/helpers.js'

export const trackerRoutes = Router()
const COLLECTION = 'tracker_items'

// GET / — list with filters + search (all in-memory — dataset is small)
trackerRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection(COLLECTION).orderBy('item_id', 'asc').get()
    let data: Record<string, unknown>[] = snapshot.docs.map(doc => stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>))

    // Apply filters in-memory (avoids composite index requirements)
    if (req.query.status) data = data.filter(d => d.status === req.query.status)
    if (req.query.portal) data = data.filter(d => d.portal === req.query.portal)
    if (req.query.scope) data = data.filter(d => d.scope === req.query.scope)
    if (req.query.component) data = data.filter(d => d.component === req.query.component)
    if (req.query.sprint_id) data = data.filter(d => d.sprint_id === req.query.sprint_id)
    if (req.query.type) data = data.filter(d => d.type === req.query.type)

    if (req.query.search) {
      const s = (req.query.search as string).toLowerCase()
      data = data.filter(d =>
        ((d.title as string) || '').toLowerCase().includes(s) ||
        ((d.description as string) || '').toLowerCase().includes(s) ||
        ((d.item_id as string) || '').toLowerCase().includes(s)
      )
    }

    // Sort newest first (queue/new items always visible)
    data.sort((a, b) => ((b.created_at as string) || '').localeCompare((a.created_at as string) || ''))

    // Apply limit if requested (dataset is small — default high)
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 1000, 1), 1000)
    const total = data.length
    data = data.slice(0, limit)

    res.json(successResponse(data, { pagination: { count: data.length, total, hasMore: total > limit } }))
  } catch (err) {
    console.error('GET /api/tracker error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// PATCH /bulk — bulk update multiple items
trackerRoutes.patch('/bulk', async (req: Request, res: Response) => {
  try {
    const { ids, updates } = req.body as { ids: string[]; updates: Record<string, unknown> }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json(errorResponse('ids array is required'))
      return
    }
    if (!updates || typeof updates !== 'object') {
      res.status(400).json(errorResponse('updates object is required'))
      return
    }

    const db = getFirestore()
    const now = new Date().toISOString()
    const batch = db.batch()
    const patchData = {
      ...updates,
      updated_at: now,
      _updated_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    }
    delete (patchData as Record<string, unknown>).item_id
    delete (patchData as Record<string, unknown>).id
    delete (patchData as Record<string, unknown>).created_at

    for (const id of ids) {
      const ref = db.collection(COLLECTION).doc(id)
      batch.update(ref, patchData)
    }
    await batch.commit()

    res.json(successResponse({ updated: ids.length }))
  } catch (err) {
    console.error('PATCH /api/tracker/bulk error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// --- DeDup Detection ---

const STATUS_RANK: Record<string, number> = {
  confirmed: 7,
  audited: 6,
  built: 5,
  planned: 4,
  in_sprint: 3,
  not_touched: 2,
  queue: 1,
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function wordSet(s: string): Set<string> {
  return new Set(s.split(' ').filter(Boolean))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const w of a) {
    if (b.has(w)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

interface TrackerItem {
  id: string
  item_id: string
  title: string
  status: string
  [key: string]: unknown
}

function pickWinner(items: TrackerItem[]): TrackerItem {
  return items.sort((a, b) => {
    const rankA = STATUS_RANK[a.status] || 0
    const rankB = STATUS_RANK[b.status] || 0
    if (rankB !== rankA) return rankB - rankA
    // Lower TRK number wins on tie
    return (a.item_id || '').localeCompare(b.item_id || '')
  })[0]
}

type DupReason = 'exact_match' | 'substring_match' | 'jaccard_similarity'

interface DupGroup {
  winner: { id: string; item_id: string; title: string; status: string }
  duplicates: { id: string; item_id: string; title: string; status: string }[]
  reason: DupReason
}

// GET /dedup — scan for duplicate tracker items
trackerRoutes.get('/dedup', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection(COLLECTION).orderBy('item_id', 'asc').get()
    const items: TrackerItem[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as TrackerItem))

    // Build normalized lookup
    const normalized = items.map(item => ({
      item,
      norm: normalizeTitle(item.title || ''),
      words: wordSet(normalizeTitle(item.title || '')),
    }))

    // Track which items are already grouped
    const grouped = new Set<string>()
    const groups: DupGroup[] = []

    for (let i = 0; i < normalized.length; i++) {
      if (grouped.has(normalized[i].item.id)) continue
      const cluster: { item: TrackerItem; reason: DupReason }[] = []

      for (let j = i + 1; j < normalized.length; j++) {
        if (grouped.has(normalized[j].item.id)) continue

        let reason: DupReason | null = null

        // 1. Exact match after normalization
        if (normalized[i].norm === normalized[j].norm) {
          reason = 'exact_match'
        }
        // 2. Substring match (one contains the other)
        else if (
          normalized[i].norm.length >= 3 &&
          normalized[j].norm.length >= 3 &&
          (normalized[i].norm.includes(normalized[j].norm) || normalized[j].norm.includes(normalized[i].norm))
        ) {
          reason = 'substring_match'
        }
        // 3. Jaccard similarity >= 0.8
        else if (jaccardSimilarity(normalized[i].words, normalized[j].words) >= 0.8) {
          reason = 'jaccard_similarity'
        }

        if (reason) {
          cluster.push({ item: normalized[j].item, reason })
        }
      }

      if (cluster.length > 0) {
        const allInGroup = [normalized[i].item, ...cluster.map(c => c.item)]
        const winner = pickWinner([...allInGroup])
        const duplicates = allInGroup.filter(it => it.id !== winner.id)

        // Use the most specific reason from the cluster
        const reasons = cluster.map(c => c.reason)
        const bestReason = reasons.includes('exact_match')
          ? 'exact_match'
          : reasons.includes('substring_match')
            ? 'substring_match'
            : 'jaccard_similarity'

        groups.push({
          winner: { id: winner.id, item_id: winner.item_id, title: winner.title, status: winner.status },
          duplicates: duplicates.map(d => ({ id: d.id, item_id: d.item_id, title: d.title, status: d.status })),
          reason: bestReason,
        })

        for (const d of duplicates) grouped.add(d.id)
        grouped.add(normalized[i].item.id)
      }
    }

    res.json(successResponse({ groups, total_groups: groups.length }))
  } catch (err) {
    console.error('GET /api/tracker/dedup error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /dedup/merge — merge duplicate items into winner
trackerRoutes.post('/dedup/merge', async (req: Request, res: Response) => {
  try {
    const { winner_id, loser_ids } = req.body as { winner_id: string; loser_ids: string[] }
    if (!winner_id) { res.status(400).json(errorResponse('winner_id is required')); return }
    if (!loser_ids || !Array.isArray(loser_ids) || loser_ids.length === 0) {
      res.status(400).json(errorResponse('loser_ids array is required')); return
    }

    const db = getFirestore()
    const winnerRef = db.collection(COLLECTION).doc(winner_id)
    const winnerDoc = await winnerRef.get()
    if (!winnerDoc.exists) { res.status(404).json(errorResponse('Winner item not found')); return }

    const winnerData = winnerDoc.data() as Record<string, unknown>

    // Gather loser docs
    const loserDocs = await Promise.all(
      loser_ids.map(async id => {
        const doc = await db.collection(COLLECTION).doc(id).get()
        return doc.exists ? { id: doc.id, data: doc.data() as Record<string, unknown>, ref: doc.ref } : null
      })
    )
    const validLosers = loserDocs.filter((d): d is NonNullable<typeof d> => d !== null)

    if (validLosers.length === 0) {
      res.status(404).json(errorResponse('No valid loser items found')); return
    }

    // Merge fields: copy non-empty loser fields into winner where winner is empty
    const mergeableFields = ['description', 'portal', 'scope', 'component', 'section', 'type', 'sprint_id']
    const mergedUpdates: Record<string, unknown> = {}

    for (const field of mergeableFields) {
      if (!winnerData[field] || winnerData[field] === '') {
        for (const loser of validLosers) {
          if (loser.data[field] && loser.data[field] !== '') {
            mergedUpdates[field] = loser.data[field]
            break
          }
        }
      }
    }

    // Merge attachments from losers into winner
    const winnerAttachments = (winnerData.attachments || []) as unknown[]
    const allAttachments = [...winnerAttachments]
    for (const loser of validLosers) {
      const loserAttachments = (loser.data.attachments || []) as unknown[]
      allAttachments.push(...loserAttachments)
    }
    if (allAttachments.length > winnerAttachments.length) {
      mergedUpdates.attachments = allAttachments
    }

    // Append loser notes to winner notes
    const winnerNotes = (winnerData.notes as string) || ''
    const loserNotes = validLosers
      .map(l => (l.data.notes as string) || '')
      .filter(n => n && n !== winnerNotes)
    if (loserNotes.length > 0) {
      const combined = [winnerNotes, ...loserNotes].filter(Boolean).join(' | ')
      mergedUpdates.notes = combined
    }

    mergedUpdates.updated_at = new Date().toISOString()

    // Batch: update winner + delete losers
    const batch = db.batch()
    batch.update(winnerRef, mergedUpdates)
    for (const loser of validLosers) {
      batch.delete(loser.ref)
    }
    await batch.commit()

    // Return updated winner
    const updatedDoc = await winnerRef.get()
    res.json(successResponse(stripInternalFields({ id: updatedDoc.id, ...updatedDoc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('POST /api/tracker/dedup/merge error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id — single item
trackerRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Tracker item not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/tracker/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST / — create new tracker item (auto-generates TRK-NNN id)
trackerRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['title'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()

    // Auto-generate item_id as TRK-NNN
    const snap = await db.collection(COLLECTION).orderBy('item_id', 'desc').limit(1).get()
    let nextNum = 1
    if (!snap.empty) {
      const lastId = (snap.docs[0].data().item_id || 'TRK-000') as string
      nextNum = parseInt(lastId.replace('TRK-', ''), 10) + 1
    }
    const itemId = `TRK-${String(nextNum).padStart(3, '0')}`

    const data = {
      ...req.body,
      item_id: itemId,
      created_at: now,
      updated_at: now,
      _created_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    }

    await db.collection(COLLECTION).doc(itemId).set(data)
    res.status(201).json(successResponse({ id: itemId, ...data }))
  } catch (err) {
    console.error('POST /api/tracker error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// PATCH /:id — partial update
trackerRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Tracker item not found')); return }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    }
    delete updates.item_id
    delete updates.id
    delete updates.created_at

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/tracker/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// DELETE /:id — delete item
trackerRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Tracker item not found')); return }

    // Clean up attachments from Storage
    const attachments = (doc.data()?.attachments || []) as Array<{ path?: string }>
    if (attachments.length > 0) {
      const bucket = getStorage().bucket()
      await Promise.allSettled(attachments.map(a => a.path ? bucket.file(a.path).delete() : Promise.resolve()))
    }

    await docRef.delete()
    res.json(successResponse({ deleted: id }))
  } catch (err) {
    console.error('DELETE /api/tracker/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:id/attachments — upload file/screenshot (base64 in JSON body)
trackerRoutes.post('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Tracker item not found')); return }

    const { name, data, content_type } = req.body as { name: string; data: string; content_type: string }
    if (!name || !data) { res.status(400).json(errorResponse('name and data (base64) are required')); return }

    const buffer = Buffer.from(data, 'base64')
    if (buffer.length > 5 * 1024 * 1024) { res.status(400).json(errorResponse('File must be under 5MB')); return }

    const existing = (doc.data()?.attachments || []) as Array<Record<string, unknown>>
    if (existing.length >= 10) { res.status(400).json(errorResponse('Maximum 10 attachments per item')); return }

    const bucket = getStorage().bucket()
    const timestamp = Date.now()
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `tracker-attachments/${id}/${timestamp}-${safeName}`
    const file = bucket.file(filePath)

    const token = crypto.randomUUID()
    await file.save(buffer, {
      contentType: content_type || 'application/octet-stream',
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    })

    const encodedPath = encodeURIComponent(filePath)
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`

    const attachment = {
      name: safeName,
      original_name: name,
      url,
      content_type: content_type || 'application/octet-stream',
      size: buffer.length,
      path: filePath,
      uploaded_at: new Date().toISOString(),
      uploaded_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    }

    await docRef.update({
      attachments: FieldValue.arrayUnion(attachment),
      updated_at: new Date().toISOString(),
    })

    res.status(201).json(successResponse(attachment))
  } catch (err) {
    console.error('POST /api/tracker/:id/attachments error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// DELETE /:id/attachments/:name — remove attachment
trackerRoutes.delete('/:id/attachments/:name', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const attachName = decodeURIComponent(param(req.params.name))
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Tracker item not found')); return }

    const existing = (doc.data()?.attachments || []) as Array<Record<string, unknown>>
    const attachment = existing.find(a => a.name === attachName)
    if (!attachment) { res.status(404).json(errorResponse('Attachment not found')); return }

    // Delete from Storage (best-effort)
    try {
      const bucket = getStorage().bucket()
      await bucket.file(attachment.path as string).delete()
    } catch { /* file may already be gone */ }

    const updated = existing.filter(a => a.name !== attachName)
    await docRef.update({
      attachments: updated,
      updated_at: new Date().toISOString(),
    })

    res.json(successResponse({ deleted: attachName }))
  } catch (err) {
    console.error('DELETE /api/tracker/:id/attachments error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
