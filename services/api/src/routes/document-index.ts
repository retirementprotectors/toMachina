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
