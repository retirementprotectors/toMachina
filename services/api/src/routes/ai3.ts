import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'

export const ai3Routes = Router()

/**
 * Derive account category from account_type string.
 * Used to group accounts in the AI3 report.
 */
function deriveCategory(accountType: string): string {
  const t = (accountType || '').toLowerCase()
  if (t.includes('annuity') || t.includes('fia') || t.includes('myga')) return 'Annuity'
  if (t.includes('life') || t.includes('term') || t.includes('whole') || t.includes('iul') || t.includes('ul')) return 'Life'
  if (t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('supplement')) return 'Medicare'
  if (t.includes('ria') || t.includes('bd') || t.includes('brokerage') || t.includes('advisory') || t.includes('mutual')) return 'BD/RIA'
  if (t.includes('bank') || t.includes('cd') || t.includes('savings') || t.includes('checking')) return 'Banking'
  return 'Other'
}

/**
 * GET /api/ai3/:clientId
 * Aggregates all client data needed for the AI3 PDF report.
 * AI3 = Assets, Income, Insurance, Inventory
 */
ai3Routes.get('/:clientId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const clientId = param(req.params.clientId)

    // 1. Fetch client doc
    const clientDoc = await db.collection('clients').doc(clientId).get()
    if (!clientDoc.exists) {
      res.status(404).json(errorResponse('Client not found'))
      return
    }

    const clientData = { id: clientDoc.id, ...clientDoc.data() } as Record<string, unknown>

    // 2. Fetch all subcollections in parallel
    const [accountsSnap, accessSnap, activitiesSnap] = await Promise.all([
      db.collection('clients').doc(clientId).collection('accounts').get(),
      db.collection('clients').doc(clientId).collection('access_items').get(),
      db.collection('clients').doc(clientId).collection('activities')
        .orderBy('created_at', 'desc')
        .limit(20)
        .get(),
    ])

    // 3. Transform accounts with category
    const accounts = accountsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      category: deriveCategory((d.data().account_type as string) || ''),
    }))

    // 4. Map access items
    const accessItems = accessSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))

    // 5. Map activities
    const recentActivities = activitiesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))

    // 6. Connected contacts from client doc field
    const connectedContacts = Array.isArray(clientData.connected_contacts)
      ? clientData.connected_contacts as Array<Record<string, unknown>>
      : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userEmail = (req as any).user?.email || 'unknown'

    res.json(successResponse({
      client: clientData,
      accounts,
      connected_contacts: connectedContacts,
      access_items: accessItems,
      recent_activities: recentActivities,
      generated_at: new Date().toISOString(),
      generated_by: userEmail,
    }))
  } catch (err) {
    console.error('GET /api/ai3/:clientId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
