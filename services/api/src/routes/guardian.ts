import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  param,
  validateRequired,
} from '../lib/helpers.js'
import {
  validatePhaseTransition,
  getNextPhase,
  type GuardianAudit,
  type GuardianFinding,
  PROTECTED_COLLECTIONS,
  COLLECTION_SCHEMAS,
  type FindingSeverity,
} from '@tomachina/core'
import { randomUUID } from 'crypto'

export const guardianRoutes = Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserEmail(req: Request): string {
  return (
    (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
  )
}

// ---------------------------------------------------------------------------
// TRK-246: GET /audit-report — Structured damage report
// ---------------------------------------------------------------------------

guardianRoutes.get('/audit-report', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()

    // Gather open findings grouped by severity
    const findingsSnap = await db
      .collection('guardian_findings')
      .where('status', '==', 'open')
      .get()

    const severityBreakdown: Record<FindingSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    const collectionIssues: Record<string, number> = {}
    let totalIssues = 0

    for (const doc of findingsSnap.docs) {
      const f = doc.data() as GuardianFinding
      const sev = f.severity as FindingSeverity
      if (sev in severityBreakdown) severityBreakdown[sev]++
      collectionIssues[f.collection] = (collectionIssues[f.collection] || 0) + 1
      totalIssues++
    }

    // Recent anomalies
    const anomalySnap = await db
      .collection('anomaly_alerts')
      .orderBy('detected_at', 'desc')
      .limit(10)
      .get()

    const recentAnomalies = anomalySnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))

    // Recent bulk operations from guardian_writes
    const bulkSnap = await db
      .collection('guardian_writes')
      .where('doc_count', '>', 1)
      .orderBy('doc_count', 'desc')
      .limit(10)
      .get()

    const bulkOperations = bulkSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))

    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_open_findings: totalIssues,
        severity_breakdown: severityBreakdown,
        collections_affected: Object.keys(collectionIssues).length,
        collection_issue_counts: collectionIssues,
      },
      timeline: {
        bulk_operations: bulkOperations,
        recent_anomalies: recentAnomalies,
      },
    }

    res.json(successResponse(report))
  } catch (err) {
    console.error('[GUARDIAN] audit-report error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to generate audit report'))
  }
})

// ---------------------------------------------------------------------------
// TRK-13495: Audit CRUD
// ---------------------------------------------------------------------------

// POST /audits — Create new audit
guardianRoutes.post('/audits', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const body = req.body as Record<string, unknown>
    const missing = validateRequired(body, ['name', 'description'])
    if (missing) {
      res.status(400).json(errorResponse(missing))
      return
    }

    const now = new Date().toISOString()
    const audit: Omit<GuardianAudit, 'id'> = {
      name: body.name as string,
      description: body.description as string,
      phase: 'scan',
      status: 'active',
      snapshot_id: null,
      finding_ids: [],
      triggered_by: (body.triggered_by as GuardianAudit['triggered_by']) || 'manual',
      created_by: getUserEmail(req),
      created_at: now,
      updated_at: now,
    }

    const ref = await db.collection('guardian_audits').add(audit)
    res.status(201).json(successResponse({ id: ref.id, ...audit }))
  } catch (err) {
    console.error('[GUARDIAN] create audit error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to create audit'))
  }
})

// GET /audits — List all audits (newest first)
guardianRoutes.get('/audits', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'
    const result = await paginatedQuery(
      db.collection('guardian_audits'),
      'guardian_audits',
      params
    )
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('[GUARDIAN] list audits error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to list audits'))
  }
})

// GET /audits/:id — Audit detail with all findings
guardianRoutes.get('/audits/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection('guardian_audits').doc(id).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Audit not found'))
      return
    }

    // Fetch all findings for this audit
    const findingsSnap = await db
      .collection('guardian_findings')
      .where('audit_id', '==', id)
      .orderBy('created_at', 'desc')
      .get()

    const findings = findingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    res.json(
      successResponse({
        id: doc.id,
        ...doc.data(),
        findings,
      })
    )
  } catch (err) {
    console.error('[GUARDIAN] get audit error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to get audit'))
  }
})

// PATCH /audits/:id — Update audit metadata
guardianRoutes.patch('/audits/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = { ...(req.body as Record<string, unknown>) }

    // Protect immutable fields
    delete body.id
    delete body.created_at
    delete body.created_by

    body.updated_at = new Date().toISOString()

    const docRef = db.collection('guardian_audits').doc(id)
    const existing = await docRef.get()
    if (!existing.exists) {
      res.status(404).json(errorResponse('Audit not found'))
      return
    }

    await docRef.update(body)
    const updated = await docRef.get()
    res.json(successResponse({ id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('[GUARDIAN] update audit error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to update audit'))
  }
})

// POST /audits/:id/findings — Create findings for an audit
guardianRoutes.post('/audits/:id/findings', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const auditId = param(req.params.id)

    // Verify audit exists
    const auditDoc = await db.collection('guardian_audits').doc(auditId).get()
    if (!auditDoc.exists) {
      res.status(404).json(errorResponse('Audit not found'))
      return
    }

    const body = req.body as Record<string, unknown>
    const missing = validateRequired(body, ['title', 'severity', 'category', 'collection'])
    if (missing) {
      res.status(400).json(errorResponse(missing))
      return
    }

    const now = new Date().toISOString()
    const findingId = randomUUID()

    const finding: Omit<GuardianFinding, 'id'> = {
      finding_id: findingId,
      audit_id: auditId,
      title: body.title as string,
      description: (body.description as string) || '',
      severity: body.severity as GuardianFinding['severity'],
      category: body.category as GuardianFinding['category'],
      collection: body.collection as string,
      doc_ids: (body.doc_ids as string[]) || [],
      status: 'open',
      resolution: null,
      resolved_by: null,
      created_at: now,
      updated_at: now,
    }

    const ref = await db.collection('guardian_findings').add(finding)

    // Update audit's finding_ids array
    const auditData = auditDoc.data() as GuardianAudit
    const updatedFindingIds = [...(auditData.finding_ids || []), ref.id]
    await db.collection('guardian_audits').doc(auditId).update({
      finding_ids: updatedFindingIds,
      updated_at: now,
    })

    res.status(201).json(successResponse({ id: ref.id, ...finding }))
  } catch (err) {
    console.error('[GUARDIAN] create finding error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to create finding'))
  }
})

// GET /audits/:id/findings — List findings for an audit
guardianRoutes.get('/audits/:id/findings', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const auditId = param(req.params.id)

    const snap = await db
      .collection('guardian_findings')
      .where('audit_id', '==', auditId)
      .orderBy('created_at', 'desc')
      .get()

    const findings = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    res.json(successResponse(findings))
  } catch (err) {
    console.error('[GUARDIAN] list findings error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to list findings'))
  }
})

// PATCH /findings/:id — Update finding (status, resolution, resolved_by)
guardianRoutes.patch('/findings/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = { ...(req.body as Record<string, unknown>) }

    // Protect immutable fields
    delete body.id
    delete body.finding_id
    delete body.audit_id
    delete body.created_at

    body.updated_at = new Date().toISOString()

    const docRef = db.collection('guardian_findings').doc(id)
    const existing = await docRef.get()
    if (!existing.exists) {
      res.status(404).json(errorResponse('Finding not found'))
      return
    }

    await docRef.update(body)
    const updated = await docRef.get()
    res.json(successResponse({ id: updated.id, ...updated.data() }))
  } catch (err) {
    console.error('[GUARDIAN] update finding error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to update finding'))
  }
})

// ---------------------------------------------------------------------------
// TRK-13494: Audit Phase Transition Engine
// ---------------------------------------------------------------------------

// POST /audits/:id/phase — Advance audit to next phase
guardianRoutes.post('/audits/:id/phase', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const auditId = param(req.params.id)

    // Load audit
    const auditDoc = await db.collection('guardian_audits').doc(auditId).get()
    if (!auditDoc.exists) {
      res.status(404).json(errorResponse('Audit not found'))
      return
    }
    const audit = { id: auditDoc.id, ...auditDoc.data() } as GuardianAudit

    // Load all findings for this audit
    const findingsSnap = await db
      .collection('guardian_findings')
      .where('audit_id', '==', auditId)
      .get()
    const findings = findingsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as GuardianFinding
    )

    // Validate transition
    const result = validatePhaseTransition(audit, findings)
    if (!result.success) {
      res.status(400).json(
        errorResponse(result.blocked_reason || 'Phase transition blocked')
      )
      return
    }

    // Apply transition
    const nextPhase = getNextPhase(audit.phase)
    if (!nextPhase) {
      res.status(400).json(errorResponse('Already at final phase'))
      return
    }

    const now = new Date().toISOString()
    await db.collection('guardian_audits').doc(auditId).update({
      phase: nextPhase,
      updated_at: now,
    })

    res.json(
      successResponse({
        from: audit.phase,
        to: nextPhase,
        audit_id: auditId,
        transitioned_at: now,
        transitioned_by: getUserEmail(req),
      })
    )
  } catch (err) {
    console.error('[GUARDIAN] phase transition error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to transition phase'))
  }
})

// ---------------------------------------------------------------------------
// TRK-259: Health, Writes, Alerts, Baselines
// ---------------------------------------------------------------------------

// GET /health — Collection health cards
guardianRoutes.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()

    const healthCards: Record<
      string,
      { doc_count: number; field_coverage: Record<string, number> }
    > = {}

    // Query each protected collection for doc count + field coverage
    for (const collection of PROTECTED_COLLECTIONS) {
      const schema = COLLECTION_SCHEMAS[collection]
      if (!schema) continue

      // Get total count (sample up to 500 docs for field coverage calc)
      const snap = await db.collection(collection).limit(500).get()
      const docCount = snap.size

      const allFields = [
        ...schema.required,
        ...(schema.neverNull || []),
        ...(schema.recommended || []),
      ]
      // Deduplicate
      const uniqueFields = [...new Set(allFields)]

      const fieldCoverage: Record<string, number> = {}
      for (const field of uniqueFields) {
        if (docCount === 0) {
          fieldCoverage[field] = 0
          continue
        }
        let populated = 0
        for (const doc of snap.docs) {
          const val = doc.data()[field]
          if (val !== undefined && val !== null && val !== '') {
            populated++
          }
        }
        fieldCoverage[field] = Math.round((populated / docCount) * 100)
      }

      healthCards[collection] = {
        doc_count: docCount,
        field_coverage: fieldCoverage,
      }
    }

    // Load latest structural report (from guardian-structural.ts runs)
    let structural = null
    try {
      const structSnap = await db
        .collection('guardian_structural_reports')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
      if (!structSnap.empty) {
        structural = { id: structSnap.docs[0].id, ...structSnap.docs[0].data() }
      }
    } catch { /* non-fatal */ }

    res.json(successResponse({ collections: healthCards, structural }))
  } catch (err) {
    console.error('[GUARDIAN] health error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to generate health cards'))
  }
})

// GET /writes — Paginated write gate log
guardianRoutes.get('/writes', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'timestamp'

    const result = await paginatedQuery(
      db.collection('guardian_writes'),
      'guardian_writes',
      params
    )
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('[GUARDIAN] writes error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to list writes'))
  }
})

// GET /alerts — Active anomaly alerts
guardianRoutes.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db
      .collection('anomaly_alerts')
      .where('acknowledged', '==', false)
      .orderBy('detected_at', 'desc')
      .get()

    const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    res.json(successResponse(alerts))
  } catch (err) {
    console.error('[GUARDIAN] alerts error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to list alerts'))
  }
})

// GET /baselines — List data_snapshots (newest first)
guardianRoutes.get('/baselines', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'timestamp'

    const result = await paginatedQuery(
      db.collection('data_snapshots'),
      'data_snapshots',
      params
    )
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('[GUARDIAN] baselines error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to list baselines'))
  }
})

// POST /baselines — Create new baseline snapshot record
guardianRoutes.post('/baselines', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const body = req.body as Record<string, unknown>
    const now = new Date().toISOString()

    const snapshot = {
      snapshot_id: randomUUID(),
      timestamp: now,
      triggered_by: (body.triggered_by as string) || 'manual',
      collections: (body.collections as Record<string, unknown>) || {},
      stored_at: now,
      created_by: getUserEmail(req),
    }

    const ref = await db.collection('data_snapshots').add(snapshot)
    res.status(201).json(successResponse({ id: ref.id, ...snapshot }))
  } catch (err) {
    console.error('[GUARDIAN] create baseline error:', (err as Error).message)
    res.status(500).json(errorResponse('Failed to create baseline'))
  }
})
