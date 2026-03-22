import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import type { Ai3ClientData, Ai3HouseholdData } from '@tomachina/core'

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
  if (t.includes('ria') || t.includes('bd') || t.includes('brokerage') || t.includes('advisory') || t.includes('mutual') || t.includes('investment')) return 'Investments'
  if (t.includes('bank') || t.includes('cd') || t.includes('savings') || t.includes('checking')) return 'Banking'
  return 'Other'
}

/**
 * GET /api/ai3/household/:householdId
 * Aggregates all data across household members for AI3-style reporting.
 * Returns household + members + accounts + access_items + connected + activities + combined totals.
 * NOTE: Must be registered BEFORE /:clientId to avoid Express treating "household" as a clientId.
 */
ai3Routes.get('/household/:householdId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const householdId = param(req.params.householdId)

    // 1. Fetch household doc
    const householdDoc = await db.collection('households').doc(householdId).get()
    if (!householdDoc.exists) {
      res.status(404).json(errorResponse('Household not found'))
      return
    }

    const household = { id: householdDoc.id, ...householdDoc.data() } as Record<string, unknown>
    const memberList = (household.members || []) as Array<{ client_id: string; client_name?: string; role?: string }>

    // 2. Fetch all member data in parallel
    const memberData: Array<{
      client: Record<string, unknown>
      accounts: Array<Record<string, unknown>>
      access_items: Array<Record<string, unknown>>
      connected_contacts: Array<Record<string, unknown>>
      recent_activities: Array<Record<string, unknown>>
    }> = []

    await Promise.all(
      memberList.map(async (member) => {
        try {
          const clientDoc = await db.collection('clients').doc(member.client_id).get()
          if (!clientDoc.exists) return

          const clientData = { id: clientDoc.id, ...clientDoc.data() } as Record<string, unknown>

          // Fetch subcollections in parallel
          const [accountsSnap, accessSnap, activitiesSnap] = await Promise.all([
            db.collection('clients').doc(member.client_id).collection('accounts').get(),
            db.collection('clients').doc(member.client_id).collection('access_items').get(),
            db.collection('clients').doc(member.client_id).collection('activities')
              .orderBy('created_at', 'desc')
              .limit(20)
              .get(),
          ])

          const accounts = accountsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            category: deriveCategory((d.data().account_type as string) || ''),
          }))

          const accessItems = accessSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          const recentActivities = activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          const connectedContacts = Array.isArray(clientData.connected_contacts)
            ? clientData.connected_contacts as Array<Record<string, unknown>>
            : []

          memberData.push({
            client: clientData,
            accounts,
            access_items: accessItems,
            connected_contacts: connectedContacts,
            recent_activities: recentActivities,
          })
        } catch {
          // Skip failed member loads
        }
      })
    )

    // 3. Calculate combined totals
    let totalAccounts = 0
    let totalPremium = 0
    let totalFaceAmount = 0
    const byCategory: Record<string, { count: number; premium: number; face_amount: number }> = {}

    for (const member of memberData) {
      totalAccounts += member.accounts.length
      for (const acct of member.accounts) {
        const premium = parseFloat(String(acct.premium || 0)) || 0
        const faceAmount = parseFloat(String(acct.face_amount || 0)) || 0
        totalPremium += premium
        totalFaceAmount += faceAmount

        const cat = String(acct.category || 'Other')
        if (!byCategory[cat]) byCategory[cat] = { count: 0, premium: 0, face_amount: 0 }
        byCategory[cat].count++
        byCategory[cat].premium += premium
        byCategory[cat].face_amount += faceAmount
      }
    }

    // 4. Beneficiary summary (basic completeness check)
    let beneficiaryComplete = 0
    let beneficiaryTotal = 0
    for (const member of memberData) {
      for (const acct of member.accounts) {
        beneficiaryTotal++
        const hasPrimary = Boolean(acct.primary_beneficiary || acct.beneficiaries_json)
        if (hasPrimary) beneficiaryComplete++
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userEmail = (req as any).user?.email || 'unknown'

    res.json(successResponse<Ai3HouseholdData>({
      household,
      members: memberData,
      combined_totals: {
        total_accounts: totalAccounts,
        total_premium: totalPremium,
        total_face_amount: totalFaceAmount,
        by_category: byCategory,
      },
      beneficiary_summary: {
        completeness_rate: beneficiaryTotal > 0 ? Math.round((beneficiaryComplete / beneficiaryTotal) * 100) : 0,
        total: beneficiaryTotal,
        complete: beneficiaryComplete,
      },
      generated_at: new Date().toISOString(),
      generated_by: userEmail,
    } as unknown as Ai3HouseholdData))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errBody = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    if (errMsg.includes('invalid_grant') || errBody === 'invalid_grant' || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('GET /api/ai3/household/:householdId error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})

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

    res.json(successResponse<Ai3ClientData>({
      client: clientData,
      accounts,
      connected_contacts: connectedContacts,
      access_items: accessItems,
      recent_activities: recentActivities,
      generated_at: new Date().toISOString(),
      generated_by: userEmail,
    } as unknown as Ai3ClientData))
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errBody = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    if (errMsg.includes('invalid_grant') || errBody === 'invalid_grant' || errMsg.includes('Token has been expired')) {
      res.status(401).json(errorResponse('Google session expired. Please sign out and sign back in.'))
      return
    }
    console.error('GET /api/ai3/:clientId error:', err)
    res.status(500).json(errorResponse(errMsg))
  }
})
