import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type {
  HouseholdDTO,
  HouseholdCreateDTO,
  HouseholdUpdateDTO,
  HouseholdDeleteResult,
  HouseholdMemberAddResult,
  HouseholdMemberRemoveResult,
  HouseholdRecalculateResult,
  HouseholdMeetingPrepData,
  HouseholdAppointmentResult,
  HouseholdEnrichTerritoriesResult,
} from '@tomachina/core'

export const householdRoutes = Router()
const COLLECTION = 'households'

// ─── GET / — list households with filters + search ───
householdRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection(COLLECTION).orderBy('household_name', 'asc').get()
    let data: Record<string, unknown>[] = snapshot.docs.map(doc =>
      stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)
    )

    // Filters
    if (req.query.status) data = data.filter(d => d.household_status === req.query.status)
    if (req.query.assigned_user_id) data = data.filter(d => d.assigned_user_id === req.query.assigned_user_id)

    // Search
    if (req.query.search) {
      const s = (req.query.search as string).toLowerCase()
      data = data.filter(d =>
        ((d.household_name as string) || '').toLowerCase().includes(s) ||
        ((d.primary_contact_name as string) || '').toLowerCase().includes(s) ||
        ((d.household_id as string) || '').toLowerCase().includes(s)
      )
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 500)
    const total = data.length
    data = data.slice(0, limit)

    res.json(successResponse<HouseholdDTO[]>(data as unknown as HouseholdDTO[], { pagination: { count: data.length, total, hasMore: total > limit } }))
  } catch (err) {
    console.error('GET /api/households error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── GET /:id — single household with members + aggregate ───
householdRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }
    res.json(successResponse<HouseholdDTO>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>) as unknown as HouseholdDTO))
  } catch (err) {
    console.error('GET /api/households/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST / — create household ───
householdRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { household_name, primary_contact_id, members } = req.body as Record<string, unknown>
    if (!household_name) { res.status(400).json(errorResponse('household_name is required')); return }
    if (!primary_contact_id) { res.status(400).json(errorResponse('primary_contact_id is required')); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const householdId = db.collection(COLLECTION).doc().id
    const email = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    const householdData: Record<string, unknown> = {
      ...req.body,
      household_id: householdId,
      household_status: (req.body as Record<string, unknown>).household_status || 'Active',
      members: members || [],
      created_at: now,
      updated_at: now,
      _created_by: email,
    }

    await db.collection(COLLECTION).doc(householdId).set(householdData)

    // Update member clients with household_id
    const memberList = (members || []) as Array<{ client_id: string }>
    const batch = db.batch()
    for (const m of memberList) {
      if (m.client_id) {
        batch.update(db.collection('clients').doc(m.client_id), {
          household_id: householdId,
          updated_at: now,
        })
      }
    }
    if (memberList.length > 0) await batch.commit()

    res.status(201).json(successResponse<HouseholdCreateDTO>(stripInternalFields({ id: householdId, ...householdData }) as unknown as HouseholdCreateDTO))
  } catch (err) {
    console.error('POST /api/households error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── PATCH /:id — update household ───
householdRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    } as Record<string, unknown>
    delete updates.household_id
    delete updates.id
    delete updates.created_at

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<HouseholdUpdateDTO>(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>) as unknown as HouseholdUpdateDTO))
  } catch (err) {
    console.error('PATCH /api/households/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── DELETE /:id — soft delete (set status inactive) ───
householdRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const email = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
    await docRef.update({
      household_status: 'Inactive',
      updated_at: new Date().toISOString(),
      _deleted_by: email,
    })
    res.json(successResponse<HouseholdDeleteResult>({ id, status: 'Inactive' } as unknown as HouseholdDeleteResult))
  } catch (err) {
    console.error('DELETE /api/households/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST /:id/members — add member to household ───
householdRoutes.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { client_id, role, relationship } = req.body as { client_id?: string; role?: string; relationship?: string }
    if (!client_id) { res.status(400).json(errorResponse('client_id is required')); return }

    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const now = new Date().toISOString()
    const householdData = doc.data() as Record<string, unknown>
    const existingMembers = (householdData.members || []) as Array<Record<string, unknown>>

    // Check for duplicate
    if (existingMembers.some(m => m.client_id === client_id)) {
      res.status(409).json(errorResponse('Client is already a member of this household'))
      return
    }

    // Look up client name
    const clientDoc = await db.collection('clients').doc(client_id).get()
    const clientData = clientDoc.exists ? clientDoc.data() as Record<string, unknown> : {}
    const clientName = [clientData.first_name, clientData.last_name].filter(Boolean).join(' ')

    const newMember = {
      client_id,
      client_name: clientName || '',
      role: role || 'other',
      relationship: relationship || 'Other',
      added_at: now,
    }

    existingMembers.push(newMember)

    const batch = db.batch()
    batch.update(docRef, { members: existingMembers, updated_at: now })
    batch.update(db.collection('clients').doc(client_id), { household_id: id, updated_at: now })
    await batch.commit()

    res.status(201).json(successResponse<HouseholdMemberAddResult>(newMember as unknown as HouseholdMemberAddResult))
  } catch (err) {
    console.error('POST /api/households/:id/members error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── DELETE /:id/members/:clientId — remove member ───
householdRoutes.delete('/:id/members/:clientId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const clientId = param(req.params.clientId)

    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const householdData = doc.data() as Record<string, unknown>
    const members = (householdData.members || []) as Array<Record<string, unknown>>
    const filtered = members.filter(m => m.client_id !== clientId)

    if (filtered.length === members.length) {
      res.status(404).json(errorResponse('Member not found in household'))
      return
    }

    const now = new Date().toISOString()
    const batch = db.batch()
    batch.update(docRef, { members: filtered, updated_at: now })
    // Clear household_id on the removed client
    batch.update(db.collection('clients').doc(clientId), { household_id: null, updated_at: now })
    await batch.commit()

    res.json(successResponse<HouseholdMemberRemoveResult>({ removed: clientId } as unknown as HouseholdMemberRemoveResult))
  } catch (err) {
    console.error('DELETE /api/households/:id/members/:clientId error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST /:id/recalculate — recalculate aggregate financials ───
householdRoutes.post('/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const householdData = doc.data() as Record<string, unknown>
    const members = (householdData.members || []) as Array<{ client_id: string }>

    let combinedIncome = 0
    let combinedNetWorth = 0
    let combinedInvestable = 0
    let totalAccounts = 0
    let totalPremium = 0
    let totalFaceAmount = 0
    let filingStatus = ''

    for (const member of members) {
      const clientDoc = await db.collection('clients').doc(member.client_id).get()
      if (!clientDoc.exists) continue
      const c = clientDoc.data() as Record<string, unknown>

      combinedIncome += parseFloat(String(c.household_income || c.annual_income || 0)) || 0
      combinedNetWorth += parseFloat(String(c.net_worth || 0)) || 0
      combinedInvestable += parseFloat(String(c.investable_assets || 0)) || 0
      if (c.filing_status && !filingStatus) filingStatus = String(c.filing_status)

      // Count accounts
      const accountsSnap = await db.collection('clients').doc(member.client_id).collection('accounts').get()
      totalAccounts += accountsSnap.size

      for (const acctDoc of accountsSnap.docs) {
        const a = acctDoc.data()
        totalPremium += parseFloat(String(a.premium || 0)) || 0
        totalFaceAmount += parseFloat(String(a.face_amount || 0)) || 0
      }
    }

    const aggregateFinancials = {
      combined_income: combinedIncome,
      combined_net_worth: combinedNetWorth,
      combined_investable_assets: combinedInvestable,
      filing_status: filingStatus,
      total_accounts: totalAccounts,
      total_premium: totalPremium,
      total_face_amount: totalFaceAmount,
      last_calculated: new Date().toISOString(),
    }

    await docRef.update({ aggregate_financials: aggregateFinancials, updated_at: new Date().toISOString() })

    res.json(successResponse<HouseholdRecalculateResult>(aggregateFinancials as unknown as HouseholdRecalculateResult))
  } catch (err) {
    console.error('POST /api/households/:id/recalculate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── GET /:id/meeting-prep — Generate household meeting preparation data ───
householdRoutes.get('/:id/meeting-prep', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docSnap = await db.collection(COLLECTION).doc(id).get()
    if (!docSnap.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const household = docSnap.data() as Record<string, unknown>
    const members = (household.members || []) as Array<{ client_id: string; client_name?: string; role?: string }>

    // Gather per-member data
    const memberInventory: Array<{
      client_id: string
      client_name: string
      role: string
      accounts_by_category: Record<string, Array<Record<string, unknown>>>
      total_premium: number
      total_face_amount: number
      account_count: number
    }> = []

    const opportunities: string[] = []
    const actionItems: string[] = []

    for (const member of members) {
      const clientDoc = await db.collection('clients').doc(member.client_id).get()
      if (!clientDoc.exists) continue
      const clientData = clientDoc.data() as Record<string, unknown>

      const accountsSnap = await db.collection('clients').doc(member.client_id).collection('accounts').get()
      const accountsByCategory: Record<string, Array<Record<string, unknown>>> = {}
      let memberPremium = 0
      let memberFaceAmount = 0

      for (const acctDoc of accountsSnap.docs) {
        const acct = acctDoc.data()
        const accountType = String(acct.account_type || '').toLowerCase()
        let category = 'Other'
        if (accountType.includes('annuity') || accountType.includes('fia') || accountType.includes('myga')) category = 'Annuity'
        else if (accountType.includes('life') || accountType.includes('term') || accountType.includes('iul')) category = 'Life'
        else if (accountType.includes('medicare') || accountType.includes('mapd')) category = 'Medicare'
        else if (accountType.includes('ria') || accountType.includes('bd') || accountType.includes('advisory') || accountType.includes('investment')) category = 'Investments'

        if (!accountsByCategory[category]) accountsByCategory[category] = []
        accountsByCategory[category].push({ id: acctDoc.id, ...acct })

        memberPremium += parseFloat(String(acct.premium || 0)) || 0
        memberFaceAmount += parseFloat(String(acct.face_amount || 0)) || 0
      }

      memberInventory.push({
        client_id: member.client_id,
        client_name: member.client_name || `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim(),
        role: member.role || 'other',
        accounts_by_category: accountsByCategory,
        total_premium: memberPremium,
        total_face_amount: memberFaceAmount,
        account_count: accountsSnap.size,
      })

      // Opportunity identification
      const age = clientData.dob ? Math.floor((Date.now() - new Date(String(clientData.dob)).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
      const hasAnnuity = Boolean(accountsByCategory['Annuity']?.length)
      const hasLife = Boolean(accountsByCategory['Life']?.length)
      const hasMedicare = Boolean(accountsByCategory['Medicare']?.length)

      if (age && age >= 62 && !hasMedicare) {
        opportunities.push(`${member.client_name || member.client_id} is ${age} — Medicare eligibility approaching or active. No Medicare account on file.`)
      }
      if (age && age >= 72 && hasAnnuity) {
        opportunities.push(`${member.client_name || member.client_id} is ${age} — RMD review needed for annuity accounts.`)
      }
      if (!hasLife && memberFaceAmount === 0) {
        opportunities.push(`${member.client_name || member.client_id} has no life insurance coverage.`)
      }

      // Check beneficiary completeness per member
      let missingBeneficiary = 0
      for (const acctDoc of accountsSnap.docs) {
        const acct = acctDoc.data()
        if (!acct.primary_beneficiary && !acct.beneficiaries_json) missingBeneficiary++
      }
      if (missingBeneficiary > 0) {
        actionItems.push(`${member.client_name || member.client_id}: ${missingBeneficiary} account(s) missing beneficiary designation`)
      }
    }

    // Household-level analysis
    if (members.length >= 2) {
      actionItems.push('Review household estate plan and beneficiary cross-references')
      opportunities.push('Household review: Confirm both members have consistent estate planning')
    }

    res.json(successResponse<HouseholdMeetingPrepData>({
      household_summary: {
        household_id: id,
        household_name: household.household_name,
        member_count: members.length,
        address: [household.address, household.city, household.state, household.zip].filter(Boolean).join(', '),
        aggregate_financials: household.aggregate_financials || {},
      },
      member_inventory: memberInventory,
      opportunities,
      action_items: actionItems,
      generated_at: new Date().toISOString(),
    } as unknown as HouseholdMeetingPrepData))
  } catch (err) {
    console.error('GET /api/households/:id/meeting-prep error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST /:id/appointments — create appointment for household ───
householdRoutes.post('/:id/appointments', async (req: Request, res: Response) => {
  try {
    const { date, time, specialist_id, zone_id, tier, type, notes } = req.body as {
      date?: string
      time?: string
      specialist_id?: string
      zone_id?: string
      tier?: string
      type?: 'field' | 'office'
      notes?: string
    }

    if (!date) { res.status(400).json(errorResponse('date is required')); return }
    if (!time) { res.status(400).json(errorResponse('time is required')); return }
    if (!specialist_id) { res.status(400).json(errorResponse('specialist_id is required')); return }

    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Household not found')); return }

    const email = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
    const now = new Date().toISOString()
    const apptRef = docRef.collection('appointments').doc()

    const appointmentData = {
      appointment_id: apptRef.id,
      date,
      time,
      specialist_id,
      zone_id: zone_id || '',
      tier: tier || '',
      type: type || 'office',
      notes: notes || '',
      status: 'scheduled',
      created_at: now,
      _created_by: email,
    }

    await apptRef.set(appointmentData)

    res.status(201).json(successResponse<HouseholdAppointmentResult>(appointmentData as unknown as HouseholdAppointmentResult))
  } catch (err) {
    console.error('POST /api/households/:id/appointments error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── POST /enrich-territories — batch enrichment of household territory data ───
householdRoutes.post('/enrich-territories', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).where('household_status', '==', 'Active').get()
    if (snap.empty) {
      res.json(successResponse<HouseholdEnrichTerritoriesResult>({ enriched: 0, skipped: 0, total: 0 } as unknown as HouseholdEnrichTerritoriesResult))
      return
    }

    let enriched = 0
    let skipped = 0
    let batchCount = 0
    let batch = db.batch()

    for (const hDoc of snap.docs) {
      const hData = hDoc.data() as Record<string, unknown>
      if (hData.territory_id && hData.zone_id) { skipped++; continue }

      const members = (hData.members || []) as Array<{ client_id: string; role?: string }>
      const primary = members.find(m => m.role === 'primary') || members[0]
      if (!primary?.client_id) { skipped++; continue }

      const clientDoc = await db.collection('clients').doc(primary.client_id).get()
      if (!clientDoc.exists) { skipped++; continue }
      const cData = clientDoc.data() as Record<string, unknown>
      if (!cData.territory_id || !cData.zone_id) { skipped++; continue }

      batch.update(hDoc.ref, {
        territory_id: cData.territory_id,
        zone_id: cData.zone_id,
        updated_at: new Date().toISOString(),
      })
      enriched++
      batchCount++

      if (batchCount >= 500) {
        await batch.commit()
        batch = db.batch()
        batchCount = 0
      }
    }

    if (batchCount > 0) await batch.commit()
    res.json(successResponse<HouseholdEnrichTerritoriesResult>({ enriched, skipped, total: snap.size } as unknown as HouseholdEnrichTerritoriesResult))
  } catch (err) {
    console.error('POST /api/households/enrich-territories error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

