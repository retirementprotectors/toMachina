import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  writeThroughBridge,
} from '../lib/helpers.js'
import type { ComplianceAuditData } from '@tomachina/core'
import { randomUUID } from 'crypto'

export const complianceRoutes = Router()

// ============================================================================
// QUARTERLY AUDIT
// ============================================================================

/**
 * POST /api/compliance/audit
 * Run a compliance audit (triggered via API or scheduled Cloud Task)
 *
 * Note: In GAS, this used AdminDirectory to scan Workspace users.
 * In toMachina, this reads from Firestore user collection and
 * external audit data. The actual Workspace scanning is done by
 * a Cloud Function that syncs Admin SDK data to Firestore.
 */
complianceRoutes.post('/audit', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const auditId = randomUUID()
    const userEmail = (req as any).user?.email || 'system'

    // Read users from Firestore (synced from Workspace via Cloud Function)
    const usersSnap = await db.collection('workspace_users').get()
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))

    const findings: string[] = []
    let criticalCount = 0

    // 1. User audit
    const active = users.filter((u) => !u.suspended)
    const suspended = users.filter((u) => u.suspended)
    const now_ms = Date.now()
    const thirtyDays = 30 * 86400000
    const ninetyDays = 90 * 86400000

    const stale90 = active.filter((u) => {
      const lastLogin = u.last_login_time ? new Date(u.last_login_time as string).getTime() : 0
      return lastLogin > 0 && (now_ms - lastLogin) > ninetyDays
    })

    const stale30 = active.filter((u) => {
      const lastLogin = u.last_login_time ? new Date(u.last_login_time as string).getTime() : 0
      return lastLogin > 0 && (now_ms - lastLogin) > thirtyDays && (now_ms - lastLogin) <= ninetyDays
    })

    const enrolled2FA = active.filter((u) => u.is_enrolled_2sv).length

    findings.push(
      `USER AUDIT: Total: ${users.length} | Active: ${active.length} | Suspended: ${suspended.length}`,
      `2FA Enrolled: ${enrolled2FA}/${active.length} (${Math.round((enrolled2FA / Math.max(active.length, 1)) * 100)}%)`
    )

    if (stale90.length > 0) {
      findings.push(`CRITICAL: ${stale90.length} users inactive 90+ days`)
      criticalCount += stale90.length
    }

    if (stale30.length > 0) {
      findings.push(`WARNING: ${stale30.length} users inactive 30+ days`)
    }

    // 2. Admin role audit
    const allowedSuperAdmins = ['josh@retireprotected.com', 'johnbehn@retireprotected.com']
    const superAdmins = active.filter((u) => u.is_admin)
    const unauthorized = superAdmins.filter((u) =>
      !allowedSuperAdmins.includes((u.email as string || '').toLowerCase())
    )

    findings.push(
      `ADMIN AUDIT: Super Admins: ${superAdmins.map((u) => u.email).join(', ')}`
    )

    if (unauthorized.length > 0) {
      findings.push(`CRITICAL: Unauthorized Super Admins: ${unauthorized.map((u) => u.email).join(', ')}`)
      criticalCount += unauthorized.length
    }

    // Store audit report
    const auditReport = {
      audit_id: auditId,
      audit_type: 'quarterly',
      findings,
      critical_count: criticalCount,
      user_stats: {
        total: users.length,
        active: active.length,
        suspended: suspended.length,
        enrolled_2fa: enrolled2FA,
        stale_30: stale30.length,
        stale_90: stale90.length,
      },
      run_by: userEmail,
      created_at: now,
    }

    await db.collection('compliance_audits').doc(auditId).set(auditReport)
    await writeThroughBridge('compliance_audits', 'insert', auditId, auditReport)

    res.json(successResponse(auditReport))
  } catch (err) {
    console.error('POST /api/compliance/audit error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// AUDIT HISTORY
// ============================================================================

/**
 * GET /api/compliance/audits
 * List past compliance audit reports
 */
complianceRoutes.get('/audits', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

    const snap = await db
      .collection('compliance_audits')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get()

    const audits = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    res.json(successResponse(audits, { pagination: { count: audits.length, total: audits.length } }))
  } catch (err) {
    console.error('GET /api/compliance/audits error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/compliance/audits/:id
 * Get a specific audit report
 */
complianceRoutes.get('/audits/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = req.params.id as string
    const doc = await db.collection('compliance_audits').doc(id).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Audit not found'))
      return
    }

    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/compliance/audits/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// STALE USER CHECK
// ============================================================================

/**
 * POST /api/compliance/stale-users
 * Check for stale users (30+ days inactive)
 */
complianceRoutes.post('/stale-users', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const usersSnap = await db
      .collection('workspace_users')
      .where('suspended', '==', false)
      .get()

    const now = Date.now()
    const thirtyDays = 30 * 86400000
    const stale: Array<{ email: string; days_inactive: number }> = []

    usersSnap.docs.forEach((d) => {
      const data = d.data()
      const lastLogin = data.last_login_time ? new Date(data.last_login_time).getTime() : 0
      if (lastLogin > 0 && (now - lastLogin) > thirtyDays) {
        stale.push({
          email: data.email || d.id,
          days_inactive: Math.floor((now - lastLogin) / 86400000),
        })
      }
    })

    stale.sort((a, b) => b.days_inactive - a.days_inactive)

    res.json(successResponse(stale, { pagination: { count: stale.length, total: stale.length } }))
  } catch (err) {
    console.error('POST /api/compliance/stale-users error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// NEW USER DETECTION
// ============================================================================

/**
 * POST /api/compliance/new-users
 * Detect users created in the last 7 days
 */
complianceRoutes.post('/new-users', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const usersSnap = await db
      .collection('workspace_users')
      .where('creation_time', '>=', sevenDaysAgo)
      .get()

    const newUsers = usersSnap.docs.map((d) => {
      const data = d.data()
      return {
        email: data.email || d.id,
        name: data.full_name || data.email || d.id,
        created: data.creation_time,
        ou: data.org_unit_path || '/',
      }
    })

    res.json(successResponse(newUsers, { pagination: { count: newUsers.length, total: newUsers.length } }))
  } catch (err) {
    console.error('POST /api/compliance/new-users error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
