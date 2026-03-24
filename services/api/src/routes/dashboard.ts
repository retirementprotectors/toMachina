import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'

export const dashboardRoutes = Router()

/**
 * GET /api/dashboard/sales-stats
 * Returns aggregate stats for the authenticated user's pipeline.
 * Used by MDJ Mobile Sales Dashboard.
 */
dashboardRoutes.get('/sales-stats', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const userEmail = String(
      (req as unknown as Record<string, unknown>).user
        ? ((req as unknown as Record<string, unknown>).user as Record<string, string>).email
        : ''
    )

    // Fetch all instances assigned to the user
    const snap = await db.collection('flow_instances')
      .where('assigned_to', '==', userEmail)
      .get()

    let activeCases = 0
    let pendingQuotes = 0
    let closingSoon = 0
    let monthlyRevenue = 0

    const now = new Date()
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    for (const doc of snap.docs) {
      const d = doc.data()
      const status = String(d.stage_status || '')

      if (status === 'in_progress') {
        activeCases++

        // Check if stage suggests quoting
        const stage = String(d.current_stage || '').toLowerCase()
        if (stage.includes('quote') || stage.includes('proposal')) {
          pendingQuotes++
        }

        // Check if updated recently and in late stages (heuristic for "closing soon")
        const updatedAt = d.updated_at ? new Date(String(d.updated_at)) : null
        if (updatedAt && updatedAt >= now && updatedAt <= sevenDaysOut) {
          closingSoon++
        }
      }

      if (status === 'complete' && d.deal_value) {
        const completedAt = d.completed_at ? new Date(String(d.completed_at)) : null
        if (completedAt && completedAt.getMonth() === now.getMonth() && completedAt.getFullYear() === now.getFullYear()) {
          monthlyRevenue += Number(d.deal_value) || 0
        }
      }
    }

    res.json(successResponse({
      active_cases: activeCases,
      pending_quotes: pendingQuotes,
      closing_soon: closingSoon,
      monthly_revenue: monthlyRevenue,
    }))
  } catch (err) {
    console.error('GET /api/dashboard/sales-stats error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
