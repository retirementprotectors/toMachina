/**
 * CAM (Commission Accounting Module) API routes.
 * Provides revenue analytics, commission calculations, comp grid management,
 * pipeline tracking, and hypothetical projections.
 *
 * Uses @tomachina/core financial functions for all commission math.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData, FieldValue } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  validateRequired,
  writeThroughBridge,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import {
  calculateFYC,
  calculateRenewal,
  calculateOverride,
  projectRevenue,
  projectCashFlow,
  calculateNPV,
} from '@tomachina/core'

export const camRoutes = Router()

// ============================================================================
// REVENUE ANALYTICS
// ============================================================================

/**
 * GET /api/cam/revenue — Revenue summary with optional filters
 * Query params: agent_id, carrier, product_type, period, start_date, end_date
 */
camRoutes.get('/revenue', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('revenue')

    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)
    if (req.query.carrier) query = query.where('carrier', '==', req.query.carrier)
    if (req.query.product_type) query = query.where('product_type', '==', req.query.product_type)
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const snap = await query.get()

    let total = 0
    const byType: Record<string, { total: number; count: number }> = {}
    const byCarrier: Record<string, { total: number; count: number }> = {}
    const byAgent: Record<string, { total: number; count: number }> = {}

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      total += amount

      const rType = String(d.revenue_type || 'unknown')
      if (!byType[rType]) byType[rType] = { total: 0, count: 0 }
      byType[rType].total += amount
      byType[rType].count += 1

      const carrier = String(d.carrier || 'unknown')
      if (!byCarrier[carrier]) byCarrier[carrier] = { total: 0, count: 0 }
      byCarrier[carrier].total += amount
      byCarrier[carrier].count += 1

      const agentId = String(d.agent_id || 'unknown')
      if (!byAgent[agentId]) byAgent[agentId] = { total: 0, count: 0 }
      byAgent[agentId].total += amount
      byAgent[agentId].count += 1
    })

    res.json(successResponse({
      total: Math.round(total * 100) / 100,
      record_count: snap.size,
      by_type: byType,
      by_carrier: byCarrier,
      by_agent: byAgent,
    }))
  } catch (err) {
    console.error('GET /api/cam/revenue error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/revenue/trends — Monthly revenue trends (last 12 months)
 */
camRoutes.get('/revenue/trends', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const months = parseInt(req.query.months as string) || 12
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    const cutoffStr = cutoff.toISOString()

    let query: Query<DocumentData> = db.collection('revenue')
      .where('created_at', '>=', cutoffStr)

    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)

    const snap = await query.get()
    const monthly: Record<string, { total: number; count: number }> = {}

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const dateStr = String(d.created_at || d.payment_date || '')
      const monthKey = dateStr.slice(0, 7) // YYYY-MM
      if (!monthKey || monthKey.length < 7) return

      if (!monthly[monthKey]) monthly[monthKey] = { total: 0, count: 0 }
      monthly[monthKey].total += amount
      monthly[monthKey].count += 1
    })

    const trends = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
      }))

    res.json(successResponse({ months: trends, period_months: months }))
  } catch (err) {
    console.error('GET /api/cam/revenue/trends error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/revenue/by-carrier — Revenue ranked by carrier
 */
camRoutes.get('/revenue/by-carrier', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('revenue')
    if (req.query.period) query = query.where('period', '==', req.query.period)
    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)

    const snap = await query.get()
    const byCarrier: Record<string, { carrier: string; total: number; count: number }> = {}

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const carrier = String(d.carrier || 'unknown')
      if (!byCarrier[carrier]) byCarrier[carrier] = { carrier, total: 0, count: 0 }
      byCarrier[carrier].total += amount
      byCarrier[carrier].count += 1
    })

    const ranked = Object.values(byCarrier)
      .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)

    res.json(successResponse(ranked, { count: ranked.length }))
  } catch (err) {
    console.error('GET /api/cam/revenue/by-carrier error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/revenue/by-agent — Revenue ranked by agent
 */
camRoutes.get('/revenue/by-agent', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('revenue')
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const snap = await query.get()
    const byAgent: Record<string, { agent_id: string; total: number; count: number }> = {}

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const agentId = String(d.agent_id || 'unknown')
      if (!byAgent[agentId]) byAgent[agentId] = { agent_id: agentId, total: 0, count: 0 }
      byAgent[agentId].total += amount
      byAgent[agentId].count += 1
    })

    const ranked = Object.values(byAgent)
      .map((a) => ({ ...a, total: Math.round(a.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)

    res.json(successResponse(ranked, { count: ranked.length }))
  } catch (err) {
    console.error('GET /api/cam/revenue/by-agent error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/revenue/by-type — Revenue breakdown by product type
 */
camRoutes.get('/revenue/by-type', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('revenue')
    if (req.query.period) query = query.where('period', '==', req.query.period)
    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)

    const snap = await query.get()
    const byType: Record<string, { product_type: string; total: number; count: number }> = {}

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const pType = String(d.product_type || d.revenue_type || 'unknown')
      if (!byType[pType]) byType[pType] = { product_type: pType, total: 0, count: 0 }
      byType[pType].total += amount
      byType[pType].count += 1
    })

    const breakdown = Object.values(byType)
      .map((t) => ({ ...t, total: Math.round(t.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)

    res.json(successResponse(breakdown, { count: breakdown.length }))
  } catch (err) {
    console.error('GET /api/cam/revenue/by-type error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// COMMISSION CALCULATIONS
// ============================================================================

/**
 * POST /api/cam/commission/calculate — Calculate commission for an account
 * Body: { amount, rate, type: 'fyc'|'renewal'|'override', year? }
 */
camRoutes.post('/commission/calculate', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['amount', 'rate', 'type'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const { amount, rate, type, year } = req.body
    const parsedAmount = parseFloat(String(amount)) || 0
    const parsedRate = parseFloat(String(rate)) || 0

    let commission: number
    switch (String(type).toLowerCase()) {
      case 'fyc':
        commission = calculateFYC(parsedAmount, parsedRate)
        break
      case 'renewal':
        commission = calculateRenewal(parsedAmount, parsedRate, year)
        break
      case 'override':
        commission = calculateOverride(parsedAmount, parsedRate)
        break
      default:
        res.status(400).json(errorResponse(`Unknown commission type: ${type}. Use fyc, renewal, or override.`))
        return
    }

    res.json(successResponse({
      amount: parsedAmount,
      rate: parsedRate,
      type,
      commission,
      breakdown: {
        gross: parsedAmount,
        rate_applied: parsedRate,
        net_commission: commission,
      },
    }))
  } catch (err) {
    console.error('POST /api/cam/commission/calculate error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/cam/commission/project — Project commissions forward (FYC + renewal schedule)
 * Body: { accounts: [{ premium, product_type }], years, growth_rate, rates? }
 */
camRoutes.post('/commission/project', async (req: Request, res: Response) => {
  try {
    const { accounts, years, growth_rate, rates } = req.body
    if (!accounts || !Array.isArray(accounts)) {
      res.status(400).json(errorResponse('accounts array is required'))
      return
    }

    const projection = projectRevenue(accounts, years || 5, growth_rate || 0, rates)

    // Calculate NPV if discount rate provided
    let npv: number | undefined
    if (req.body.discount_rate) {
      const cashflows = projection.projections.map((p) => p.revenue)
      npv = calculateNPV(cashflows, parseFloat(String(req.body.discount_rate)))
    }

    res.json(successResponse({
      projection,
      npv,
      inputs: { account_count: accounts.length, years: years || 5, growth_rate: growth_rate || 0 },
    }))
  } catch (err) {
    console.error('POST /api/cam/commission/project error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/commission/schedule/:id — Get commission schedule for an account
 */
camRoutes.get('/commission/schedule/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const accountId = param(req.params.id)

    // Get revenue records for this account
    const snap = await db.collection('revenue')
      .where('account_id', '==', accountId)
      .orderBy('created_at', 'asc')
      .get()

    if (snap.empty) {
      res.json(successResponse({ account_id: accountId, schedule: [], total: 0 }))
      return
    }

    const schedule = snap.docs.map((doc) => {
      const d = doc.data()
      return stripInternalFields({
        id: doc.id,
        revenue_type: d.revenue_type,
        amount: parseFloat(String(d.amount)) || 0,
        period: d.period,
        payment_date: d.payment_date || d.created_at,
        status: d.status,
      } as Record<string, unknown>)
    })

    const total = schedule.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0)

    res.json(successResponse({
      account_id: accountId,
      schedule,
      total: Math.round(total * 100) / 100,
      record_count: schedule.length,
    }))
  } catch (err) {
    console.error('GET /api/cam/commission/schedule/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// COMP GRIDS
// ============================================================================

/**
 * GET /api/cam/comp-grids — List comp grids (filter by type)
 * Query params: type (life, annuity, medicare, advisory)
 */
camRoutes.get('/comp-grids', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('comp_grids')

    if (req.query.type) query = query.where('product_type', '==', req.query.type)

    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'product_type'

    const result = await paginatedQuery(query, 'comp_grids', params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/cam/comp-grids error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/comp-grids/:id — Get grid detail with rate tiers
 */
camRoutes.get('/comp-grids/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection('comp_grids').doc(id).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse('Comp grid not found'))
      return
    }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/cam/comp-grids/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/cam/comp-grids — Create or update a comp grid entry
 * Body: { carrier_id, product_type, rate, rate_type, effective_date? }
 */
camRoutes.post('/comp-grids', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['carrier_id', 'product_type', 'rate'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const gridId = req.body.grid_id || db.collection('comp_grids').doc().id

    const data: Record<string, unknown> = {
      ...req.body,
      grid_id: gridId,
      rate: parseFloat(String(req.body.rate)) || 0,
      rate_type: req.body.rate_type || 'percent',
      created_at: req.body.created_at || now,
      updated_at: now,
      _created_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    }

    const bridgeResult = await writeThroughBridge('comp_grids', 'insert', gridId, data)
    if (!bridgeResult.success) await db.collection('comp_grids').doc(gridId).set(data)

    res.status(201).json(successResponse({ id: gridId, ...data }))
  } catch (err) {
    console.error('POST /api/cam/comp-grids error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PIPELINE
// ============================================================================

/**
 * GET /api/cam/pipeline — Pipeline summary (new business, renewals, pending)
 */
camRoutes.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('pipelines').get()

    const summary = {
      submitted: { count: 0, value: 0 },
      issued: { count: 0, value: 0 },
      withdrawn: { count: 0, value: 0 },
      total: { count: 0, value: 0 },
    }

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const value = parseFloat(String(d.expected_premium || d.actual_premium || d.value || 0))
      const status = String(d.status || '').toLowerCase()
      summary.total.count += 1
      summary.total.value += value

      if (status === 'submitted' || status === 'pending') {
        summary.submitted.count += 1
        summary.submitted.value += value
      } else if (status === 'issued' || status === 'active') {
        summary.issued.count += 1
        summary.issued.value += value
      } else if (status === 'withdrawn' || status === 'cancelled') {
        summary.withdrawn.count += 1
        summary.withdrawn.value += value
      }
    })

    // Round values
    for (const key of Object.keys(summary) as (keyof typeof summary)[]) {
      summary[key].value = Math.round(summary[key].value * 100) / 100
    }

    const conversionRate = summary.total.count > 0
      ? Math.round((summary.issued.count / summary.total.count) * 10000) / 100
      : 0

    res.json(successResponse({ ...summary, conversion_rate: conversionRate }))
  } catch (err) {
    console.error('GET /api/cam/pipeline error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/pipeline/forecast — Revenue forecast (next 3/6/12 months)
 */
camRoutes.get('/pipeline/forecast', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()

    // Get issued/active pipeline entries with premium data
    const snap = await db.collection('pipelines')
      .where('status', 'in', ['issued', 'active', 'submitted'])
      .get()

    const accounts = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        premium: parseFloat(String(d.actual_premium || d.expected_premium || 0)),
        product_type: String(d.product_type || 'unknown'),
      }
    }).filter((a) => a.premium > 0)

    const forecast3 = projectRevenue(accounts, 1, 0) // 1 year = 12 months, slice for 3
    const forecast6 = projectRevenue(accounts, 1, 0)
    const forecast12 = projectRevenue(accounts, 1, 0)

    const monthlyBase = forecast12.total / 12

    res.json(successResponse({
      account_count: accounts.length,
      forecast_3m: Math.round(monthlyBase * 3 * 100) / 100,
      forecast_6m: Math.round(monthlyBase * 6 * 100) / 100,
      forecast_12m: Math.round(forecast12.total * 100) / 100,
      monthly_run_rate: Math.round(monthlyBase * 100) / 100,
    }))
  } catch (err) {
    console.error('GET /api/cam/pipeline/forecast error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PROJECTIONS
// ============================================================================

/**
 * POST /api/cam/projections/hypothetical — "What-if" scenario calculator
 * Body: { retail: { policies, velocity }, downline?: { policies, velocity, share },
 *         network?: { policies, velocity, share }, tier_key, revenue_per_client? }
 */
camRoutes.post('/projections/hypothetical', async (req: Request, res: Response) => {
  try {
    const {
      retail,
      downline,
      network,
      tier_key,
      revenue_per_client = 1200,
    } = req.body

    if (!retail) {
      res.status(400).json(errorResponse('retail object with policies and velocity is required'))
      return
    }

    const PARTNER_TIERS: Record<string, number> = {
      bronze: 0.50,
      silver: 0.60,
      gold: 0.70,
      platinum: 0.80,
    }

    const tierPercent = PARTNER_TIERS[String(tier_key || 'bronze').toLowerCase()] || 0.50
    const rpc = parseFloat(String(revenue_per_client)) || 1200

    // Retail projection
    const retailPolicies = parseFloat(String(retail?.policies || 0))
    const retailVelocity = parseFloat(String(retail?.velocity || 0)) // new policies per month
    const retailExisting = (retailPolicies / 12) * rpc * tierPercent
    const retailMonthly: { month: number; revenue: number }[] = []
    let retailYear1 = 0
    for (let m = 1; m <= 12; m++) {
      const existing = retailExisting
      const newRev = retailVelocity * m * (rpc / 12) * tierPercent
      const monthRev = Math.round((existing + newRev) * 100) / 100
      retailMonthly.push({ month: m, revenue: monthRev })
      retailYear1 += monthRev
    }

    // Downline projection
    let downlineYear1 = 0
    const downlineMonthly: { month: number; revenue: number }[] = []
    if (downline) {
      const dlPolicies = parseFloat(String(downline.policies || 0))
      const dlVelocity = parseFloat(String(downline.velocity || 0))
      const dlShare = parseFloat(String(downline.share || 0))
      const dlRetain = 1 - dlShare
      const dlExisting = (dlPolicies / 12) * rpc * tierPercent * dlRetain
      for (let m = 1; m <= 12; m++) {
        const existing = dlExisting
        const newRev = dlVelocity * m * (rpc / 12) * tierPercent * dlRetain
        const monthRev = Math.round((existing + newRev) * 100) / 100
        downlineMonthly.push({ month: m, revenue: monthRev })
        downlineYear1 += monthRev
      }
    }

    // Network projection
    let networkYear1 = 0
    const networkMonthly: { month: number; revenue: number }[] = []
    if (network) {
      const nPolicies = parseFloat(String(network.policies || 0))
      const nVelocity = parseFloat(String(network.velocity || 0))
      const nShare = parseFloat(String(network.share || 0))
      const nRetain = 1 - nShare
      const nExisting = (nPolicies / 12) * rpc * tierPercent * nRetain
      for (let m = 1; m <= 12; m++) {
        const existing = nExisting
        const newRev = nVelocity * m * (rpc / 12) * tierPercent * nRetain
        const monthRev = Math.round((existing + newRev) * 100) / 100
        networkMonthly.push({ month: m, revenue: monthRev })
        networkYear1 += monthRev
      }
    }

    res.json(successResponse({
      tier: { key: tier_key || 'bronze', percent: tierPercent },
      revenue_per_client: rpc,
      retail: { year1: Math.round(retailYear1 * 100) / 100, monthly: retailMonthly },
      downline: downline
        ? { year1: Math.round(downlineYear1 * 100) / 100, monthly: downlineMonthly }
        : null,
      network: network
        ? { year1: Math.round(networkYear1 * 100) / 100, monthly: networkMonthly }
        : null,
      total: {
        year1: Math.round((retailYear1 + downlineYear1 + networkYear1) * 100) / 100,
      },
    }))
  } catch (err) {
    console.error('POST /api/cam/projections/hypothetical error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
