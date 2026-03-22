import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import type { AnalyticsListDTO, AnalyticsSummaryData, AnalyticsPushResult } from '@tomachina/core'
import { randomUUID } from 'crypto'

export const analyticsRoutes = Router()
const COLLECTION = 'ai_analytics'

// ============================================================================
// LIST ANALYTICS
// ============================================================================

/**
 * GET /api/analytics
 * List analytics rows with optional filters
 * Filters: machine_id, date, start_date, end_date
 */
analyticsRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)

    if (req.query.machine_id) {
      query = query.where('machine_id', '==', req.query.machine_id)
    }

    if (req.query.date) {
      const dateStr = (req.query.date as string).slice(0, 10)
      query = query.where('date', '==', dateStr)
    }

    if (req.query.start_date) {
      const startStr = (req.query.start_date as string).slice(0, 10)
      query = query.where('date', '>=', startStr)
    }

    if (req.query.end_date) {
      const endStr = (req.query.end_date as string).slice(0, 10)
      query = query.where('date', '<=', endStr)
    }

    const snap = await query.orderBy('date', 'desc').limit(500).get()
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    res.json(successResponse(data, { pagination: { count: data.length, total: data.length } }))
  } catch (err) {
    console.error('GET /api/analytics error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET ANALYTICS ROW
// ============================================================================

/**
 * GET /api/analytics/summary
 * Aggregated summary for dashboard
 */
analyticsRoutes.get('/summary', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(COLLECTION)

    if (req.query.start_date) {
      query = query.where('date', '>=', (req.query.start_date as string).slice(0, 10))
    }
    if (req.query.end_date) {
      query = query.where('date', '<=', (req.query.end_date as string).slice(0, 10))
    }

    const snap = await query.get()
    const rows = snap.docs.map((d) => d.data())

    // Aggregate totals
    const totals: Record<string, number> = {
      cc_sessions: 0,
      cc_messages: 0,
      cc_tool_calls: 0,
      cc_tokens_out: 0,
      mcp_calls_total: 0,
      mcp_calls_workspace: 0,
      mcp_calls_business: 0,
      mcp_calls_healthcare: 0,
      mcp_calls_gdrive: 0,
      mcp_calls_slack: 0,
      mcp_calls_other: 0,
      mcp_errors: 0,
      hem_minutes: 0,
      hem_value_usd: 0,
      longest_session_min: 0,
    }

    const dates = new Set<string>()
    const machines = new Set<string>()
    const dailyTrend: Record<string, { cc_sessions: number; cc_messages: number; mcp_calls: number; hem_value: number }> = {}
    const machineBreakdown: Record<string, { days: number; cc_sessions: number; cc_messages: number; mcp_calls: number; hem_value: number }> = {}

    for (const r of rows) {
      const dateKey = String(r.date || '').slice(0, 10)
      dates.add(dateKey)
      machines.add(r.machine_id as string)

      totals.cc_sessions += Number(r.cc_sessions) || 0
      totals.cc_messages += Number(r.cc_messages) || 0
      totals.cc_tool_calls += Number(r.cc_tool_calls) || 0
      totals.cc_tokens_out += Number(r.cc_tokens_out) || 0
      totals.mcp_calls_total += Number(r.mcp_calls_total) || 0
      totals.mcp_calls_workspace += Number(r.mcp_calls_workspace) || 0
      totals.mcp_calls_business += Number(r.mcp_calls_business) || 0
      totals.mcp_calls_healthcare += Number(r.mcp_calls_healthcare) || 0
      totals.mcp_calls_gdrive += Number(r.mcp_calls_gdrive) || 0
      totals.mcp_calls_slack += Number(r.mcp_calls_slack) || 0
      totals.mcp_calls_other += Number(r.mcp_calls_other) || 0
      totals.mcp_errors += Number(r.mcp_errors) || 0
      totals.hem_minutes += Number(r.hem_minutes) || 0
      totals.hem_value_usd += Number(r.hem_value_usd) || 0
      if ((Number(r.cc_longest_session_min) || 0) > totals.longest_session_min) {
        totals.longest_session_min = Number(r.cc_longest_session_min)
      }

      // Daily trend
      if (!dailyTrend[dateKey]) {
        dailyTrend[dateKey] = { cc_sessions: 0, cc_messages: 0, mcp_calls: 0, hem_value: 0 }
      }
      dailyTrend[dateKey].cc_sessions += Number(r.cc_sessions) || 0
      dailyTrend[dateKey].cc_messages += Number(r.cc_messages) || 0
      dailyTrend[dateKey].mcp_calls += Number(r.mcp_calls_total) || 0
      dailyTrend[dateKey].hem_value += Number(r.hem_value_usd) || 0

      // Machine breakdown
      const mid = r.machine_id as string
      if (!machineBreakdown[mid]) {
        machineBreakdown[mid] = { days: 0, cc_sessions: 0, cc_messages: 0, mcp_calls: 0, hem_value: 0 }
      }
      machineBreakdown[mid].days++
      machineBreakdown[mid].cc_sessions += Number(r.cc_sessions) || 0
      machineBreakdown[mid].cc_messages += Number(r.cc_messages) || 0
      machineBreakdown[mid].mcp_calls += Number(r.mcp_calls_total) || 0
      machineBreakdown[mid].hem_value += Number(r.hem_value_usd) || 0
    }

    const trendArray = Object.keys(dailyTrend).sort().map((d) => ({
      date: d,
      ...dailyTrend[d],
    }))

    res.json(successResponse({
      totals: {
        ...totals,
        days: dates.size,
        machine_count: machines.size,
        hem_hours: (totals.hem_minutes / 60).toFixed(1),
      },
      machines: machineBreakdown,
      daily: trendArray,
      updated_at: rows.length > 0 ? rows[rows.length - 1].created_at : null,
    }))
  } catch (err) {
    console.error('GET /api/analytics/summary error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/analytics/:id
 * Get a specific analytics row
 */
analyticsRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = req.params.id as string
    const doc = await db.collection(COLLECTION).doc(id).get()

    if (!doc.exists) {
      res.status(404).json(errorResponse('Analytics row not found'))
      return
    }

    res.json(successResponse({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('GET /api/analytics/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PUSH ANALYTICS
// ============================================================================

/**
 * POST /api/analytics
 * Push daily aggregate from a machine (upserts by date + machine_id)
 */
analyticsRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const data = req.body

    if (!data.date || !data.machine_id) {
      res.status(400).json(errorResponse('date and machine_id are required'))
      return
    }

    const dateStr = String(data.date).slice(0, 10)

    // Check for existing row (upsert)
    const existingSnap = await db
      .collection(COLLECTION)
      .where('date', '==', dateStr)
      .where('machine_id', '==', data.machine_id)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      // Update existing
      const existingDoc = existingSnap.docs[0]
      await existingDoc.ref.update({
        ...data,
        date: dateStr,
        updated_at: new Date().toISOString(),
      })
      res.json(successResponse(data, { message: `Analytics updated for ${dateStr}` }))
      return
    }

    // Insert new
    data.analytics_id = data.analytics_id || randomUUID()
    data.date = dateStr
    data.created_at = data.created_at || new Date().toISOString()

    await db.collection(COLLECTION).doc(data.analytics_id).set(data)
    res.status(201).json(successResponse(data, { message: `Analytics pushed for ${dateStr}` }))
  } catch (err) {
    console.error('POST /api/analytics error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
