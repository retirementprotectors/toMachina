import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { successResponse, errorResponse, param } from '../lib/helpers.js'
import { randomUUID } from 'crypto'

export const leadershipRoutes = Router()

const MEETINGS_COLLECTION = 'leadership_meetings'
const ROADMAPS_COLLECTION = 'leadership_roadmaps'

// ============================================================================
// MEETINGS
// ============================================================================

/** GET /api/leadership/meetings — List meetings */
leadershipRoutes.get('/meetings', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let q = db.collection(MEETINGS_COLLECTION).orderBy('date', 'desc') as FirebaseFirestore.Query

    if (req.query.after) q = q.where('date', '>=', String(req.query.after))
    if (req.query.before) q = q.where('date', '<=', String(req.query.before))

    const limit = Math.min(parseInt(String(req.query.limit) || '25', 10), 100)
    const snap = await q.limit(limit).get()

    const meetings = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(meetings))
  } catch (err) {
    console.error('GET /api/leadership/meetings error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** GET /api/leadership/meetings/actions — All open action items across meetings */
leadershipRoutes.get('/meetings/actions', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(MEETINGS_COLLECTION)
      .orderBy('date', 'desc')
      .limit(50)
      .get()

    const actions: Array<Record<string, unknown>> = []
    for (const doc of snap.docs) {
      const data = doc.data()
      const items = (data.action_items || []) as Array<Record<string, unknown>>
      for (const item of items) {
        if (item.status !== 'completed') {
          actions.push({
            ...item,
            meeting_id: doc.id,
            meeting_title: data.title,
            meeting_date: data.date,
          })
        }
      }
    }

    // Sort by due_date ascending (soonest first)
    actions.sort((a, b) => {
      const da = String(a.due_date || '9999-12-31')
      const db2 = String(b.due_date || '9999-12-31')
      return da.localeCompare(db2)
    })

    const owner = req.query.owner ? String(req.query.owner).toLowerCase() : null
    const filtered = owner
      ? actions.filter(a => String(a.owner || '').toLowerCase().includes(owner))
      : actions

    res.json(successResponse(filtered))
  } catch (err) {
    console.error('GET /api/leadership/meetings/actions error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** GET /api/leadership/meetings/:id — Meeting detail */
leadershipRoutes.get('/meetings/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(MEETINGS_COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Meeting not found')); return }
    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/leadership/meetings/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** POST /api/leadership/meetings — Create meeting record */
leadershipRoutes.post('/meetings', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const data = req.body

    if (!data.title || !data.date) {
      res.status(400).json(errorResponse('Missing required fields: title, date'))
      return
    }

    const meetingId = data.meeting_id || randomUUID()
    const now = new Date().toISOString()

    const meeting = {
      meeting_id: meetingId,
      title: data.title,
      date: data.date,
      attendees: data.attendees || [],
      recording_url: data.recording_url || null,
      transcript_url: data.transcript_url || null,
      action_items: (data.action_items || []).map((ai: Record<string, unknown>) => ({
        id: randomUUID(),
        item: ai.item || '',
        owner: ai.owner || '',
        due_date: ai.due_date || null,
        status: ai.status || 'open',
        priority: ai.priority || 'medium',
      })),
      decisions: data.decisions || [],
      follow_ups: data.follow_ups || [],
      summary: data.summary || '',
      sentiment: data.sentiment || null,
      duration_minutes: data.duration_minutes || null,
      analysis_source: data.analysis_source || 'manual',
      created_at: now,
      updated_at: now,
    }

    await db.collection(MEETINGS_COLLECTION).doc(meetingId).set(meeting)
    res.status(201).json(successResponse({ meeting_id: meetingId }))
  } catch (err) {
    console.error('POST /api/leadership/meetings error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** PATCH /api/leadership/meetings/actions/:id — Update action item status */
leadershipRoutes.patch('/meetings/actions/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const actionId = param(req.params.id)
    const { status, meeting_id } = req.body

    if (!meeting_id || !status) {
      res.status(400).json(errorResponse('Missing required fields: meeting_id, status'))
      return
    }

    const docRef = db.collection(MEETINGS_COLLECTION).doc(meeting_id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Meeting not found')); return }

    const data = doc.data()!
    const items = (data.action_items || []) as Array<Record<string, unknown>>
    const idx = items.findIndex(i => i.id === actionId)
    if (idx === -1) { res.status(404).json(errorResponse('Action item not found')); return }

    items[idx].status = status
    if (status === 'completed') items[idx].completed_at = new Date().toISOString()

    await docRef.update({ action_items: items, updated_at: new Date().toISOString() })
    res.json(successResponse({ action_id: actionId, status }))
  } catch (err) {
    console.error('PATCH /api/leadership/meetings/actions/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ROADMAPS
// ============================================================================

/** GET /api/leadership/roadmaps — List all team roadmaps */
leadershipRoutes.get('/roadmaps', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(ROADMAPS_COLLECTION).orderBy('owner_name').get()
    const roadmaps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(roadmaps))
  } catch (err) {
    console.error('GET /api/leadership/roadmaps error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** GET /api/leadership/roadmaps/:id — Roadmap detail */
leadershipRoutes.get('/roadmaps/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(ROADMAPS_COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Roadmap not found')); return }
    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/leadership/roadmaps/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** POST /api/leadership/roadmaps — Create roadmap */
leadershipRoutes.post('/roadmaps', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const data = req.body
    if (!data.owner_email || !data.title) {
      res.status(400).json(errorResponse('Missing required fields: owner_email, title'))
      return
    }

    const roadmapId = data.roadmap_id || randomUUID()
    const now = new Date().toISOString()

    const roadmap = {
      roadmap_id: roadmapId,
      owner_email: data.owner_email,
      owner_name: data.owner_name || '',
      division: data.division || '',
      title: data.title,
      description: data.description || '',
      milestones: data.milestones || [],
      status: data.status || 'on_track',
      google_doc_id: data.google_doc_id || null,
      last_updated: now,
      created_at: now,
    }

    await db.collection(ROADMAPS_COLLECTION).doc(roadmapId).set(roadmap)
    res.status(201).json(successResponse({ roadmap_id: roadmapId }))
  } catch (err) {
    console.error('POST /api/leadership/roadmaps error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** PATCH /api/leadership/roadmaps/:id — Update roadmap */
leadershipRoutes.patch('/roadmaps/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const updates = { ...req.body, last_updated: new Date().toISOString() }
    delete updates.roadmap_id
    delete updates.created_at

    await db.collection(ROADMAPS_COLLECTION).doc(id).update(updates)
    res.json(successResponse({ roadmap_id: id }))
  } catch (err) {
    console.error('PATCH /api/leadership/roadmaps/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** POST /api/leadership/roadmaps/:id/milestone — Add milestone */
leadershipRoutes.post('/roadmaps/:id/milestone', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const milestone = {
      id: randomUUID(),
      title: req.body.title || '',
      target_date: req.body.target_date || null,
      status: req.body.status || 'on_track',
      notes: req.body.notes || '',
      completed_date: null,
    }

    const docRef = db.collection(ROADMAPS_COLLECTION).doc(id)
    await docRef.update({
      milestones: FieldValue.arrayUnion(milestone),
      last_updated: new Date().toISOString(),
    })

    res.status(201).json(successResponse({ milestone_id: milestone.id }))
  } catch (err) {
    console.error('POST /api/leadership/roadmaps/:id/milestone error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// CROSS-TEAM
// ============================================================================

/** GET /api/leadership/dashboard — Aggregated leadership dashboard */
leadershipRoutes.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [meetingsSnap, roadmapsSnap, tasksSnap, usersSnap] = await Promise.all([
      db.collection(MEETINGS_COLLECTION).where('date', '>=', weekAgo).get(),
      db.collection(ROADMAPS_COLLECTION).get(),
      db.collection('case_tasks').where('status', 'in', ['open', 'in_progress']).get(),
      db.collection('users').where('status', '==', 'active').get(),
    ])

    // Aggregate action items
    let totalActions = 0
    let overdueActions = 0
    const today = now.toISOString().split('T')[0]

    for (const doc of meetingsSnap.docs) {
      const items = (doc.data().action_items || []) as Array<Record<string, unknown>>
      for (const item of items) {
        if (item.status !== 'completed') {
          totalActions++
          if (item.due_date && String(item.due_date) < today) overdueActions++
        }
      }
    }

    // Roadmap health
    const roadmapStatuses: Record<string, number> = {}
    for (const doc of roadmapsSnap.docs) {
      const status = doc.data().status || 'on_track'
      roadmapStatuses[status] = (roadmapStatuses[status] || 0) + 1
    }

    res.json(successResponse({
      meetings_this_week: meetingsSnap.size,
      open_action_items: totalActions,
      overdue_action_items: overdueActions,
      roadmap_statuses: roadmapStatuses,
      total_roadmaps: roadmapsSnap.size,
      open_tasks: tasksSnap.size,
      active_team_members: usersSnap.size,
    }))
  } catch (err) {
    console.error('GET /api/leadership/dashboard error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/** GET /api/leadership/divisions — Per-division summary */
leadershipRoutes.get('/divisions', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const [usersSnap, tasksSnap, roadmapsSnap] = await Promise.all([
      db.collection('users').where('status', '==', 'active').get(),
      db.collection('case_tasks').where('status', 'in', ['open', 'in_progress']).get(),
      db.collection(ROADMAPS_COLLECTION).get(),
    ])

    const divisions: Record<string, { team_size: number; open_tasks: number; roadmap_status: string }> = {
      Sales: { team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      Service: { team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      Legacy: { team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      'B2B': { team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      Tech: { team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
    }

    for (const doc of usersSnap.docs) {
      const div = doc.data().division || ''
      if (divisions[div]) divisions[div].team_size++
    }

    for (const doc of tasksSnap.docs) {
      const assignee = doc.data().assigned_to || ''
      // Simple heuristic: match division by user lookup (not ideal but functional)
      for (const div of Object.keys(divisions)) {
        if (assignee.toLowerCase().includes(div.toLowerCase())) {
          divisions[div].open_tasks++
        }
      }
    }

    for (const doc of roadmapsSnap.docs) {
      const div = doc.data().division || ''
      if (divisions[div]) divisions[div].roadmap_status = doc.data().status || 'on_track'
    }

    res.json(successResponse(divisions))
  } catch (err) {
    console.error('GET /api/leadership/divisions error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
