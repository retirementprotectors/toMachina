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

    res.json(successResponse<unknown>({
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

    res.json(successResponse<unknown>({ months: trends, period_months: months }))
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

    res.json(successResponse<unknown>(ranked, { pagination: { count: ranked.length, total: ranked.length } }))
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

    res.json(successResponse<unknown>(ranked, { pagination: { count: ranked.length, total: ranked.length } }))
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

    res.json(successResponse<unknown>(breakdown, { pagination: { count: breakdown.length, total: breakdown.length } }))
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

    res.json(successResponse<unknown>({
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

    res.json(successResponse<unknown>({
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
      res.json(successResponse<unknown>({ account_id: accountId, schedule: [], total: 0 }))
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

    res.json(successResponse<unknown>({
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
    res.json(successResponse<unknown>(data, { pagination: result.pagination }))
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
    res.json(successResponse<unknown>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
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

    res.status(201).json(successResponse<unknown>({ id: gridId, ...data }))
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

    res.json(successResponse<unknown>({ ...summary, conversion_rate: conversionRate }))
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

    res.json(successResponse<unknown>({
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

    res.json(successResponse<unknown>({
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

// ============================================================================
// COMMISSION MANAGEMENT (Sprint 6)
// ============================================================================

/**
 * POST /api/cam/commission/reconcile — Compare calculated vs actual commissions
 * Body: { agent_id?, period?, auto_flag?: boolean }
 */
camRoutes.post('/commission/reconcile', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const { agent_id, period } = req.body

    let revenueQuery: Query<DocumentData> = db.collection('revenue')
    if (agent_id) revenueQuery = revenueQuery.where('agent_id', '==', agent_id)
    if (period) revenueQuery = revenueQuery.where('period', '==', period)

    const snap = await revenueQuery.get()
    const discrepancies: Record<string, unknown>[] = []
    const now = new Date().toISOString()

    for (const doc of snap.docs) {
      const d = doc.data()
      const actualAmount = parseFloat(String(d.amount)) || 0
      const rate = parseFloat(String(d.commission_rate || d.rate || 0.05))
      const premium = parseFloat(String(d.premium || d.total_premium || actualAmount))
      const calculatedAmount = calculateFYC(premium, rate)
      const diff = Math.abs(actualAmount - calculatedAmount)
      const threshold = Math.max(actualAmount, calculatedAmount) * 0.02 // 2% tolerance

      if (diff > threshold && diff > 1) {
        const discId = db.collection('commission_discrepancies').doc().id
        const disc = {
          discrepancy_id: discId,
          revenue_id: doc.id,
          agent_id: d.agent_id || '',
          carrier: d.carrier || '',
          product_type: d.product_type || '',
          period: d.period || '',
          actual_amount: actualAmount,
          calculated_amount: Math.round(calculatedAmount * 100) / 100,
          difference: Math.round(diff * 100) / 100,
          status: 'open',
          created_at: now,
          updated_at: now,
        }
        discrepancies.push(disc)

        if (req.body.auto_flag !== false) {
          await db.collection('commission_discrepancies').doc(discId).set(disc)
        }
      }
    }

    res.json(successResponse<unknown>({
      records_checked: snap.size,
      discrepancies_found: discrepancies.length,
      discrepancies: discrepancies.slice(0, 50),
    }))
  } catch (err) {
    console.error('POST /api/cam/commission/reconcile error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/commission/discrepancies — List unresolved discrepancies
 */
camRoutes.get('/commission/discrepancies', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('commission_discrepancies')

    const status = req.query.status as string
    if (status) query = query.where('status', '==', status)
    else query = query.where('status', '==', 'open')

    if (req.query.agent_id) query = query.where('agent_id', '==', req.query.agent_id)

    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'
    const result = await paginatedQuery(query, 'commission_discrepancies', params)
    res.json(successResponse<unknown>(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/cam/commission/discrepancies error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/cam/commission/discrepancies/:id — Resolve a discrepancy
 * Body: { status: 'accepted'|'adjusted'|'disputed', resolution_note? }
 */
camRoutes.patch('/commission/discrepancies/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection('commission_discrepancies').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Discrepancy not found')); return }

    const validStatuses = ['accepted', 'adjusted', 'disputed', 'open']
    if (req.body.status && !validStatuses.includes(req.body.status)) {
      res.status(400).json(errorResponse(`Invalid status. Use: ${validStatuses.join(', ')}`))
      return
    }

    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
      resolved_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
    }
    delete updates.discrepancy_id
    await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse<unknown>({ id, ...updated.data() }))
  } catch (err) {
    console.error('PATCH /api/cam/commission/discrepancies/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// COMP GRID MANAGEMENT (Sprint 6)
// ============================================================================

/**
 * PATCH /api/cam/comp-grids/:id — Update grid rates
 */
camRoutes.patch('/comp-grids/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection('comp_grids').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Comp grid not found')); return }

    const now = new Date().toISOString()
    const oldData = doc.data() || {}

    // Log change to history
    await db.collection('comp_grid_history').add({
      grid_id: id,
      change_type: 'update',
      old_rate: oldData.rate,
      new_rate: req.body.rate != null ? parseFloat(String(req.body.rate)) : oldData.rate,
      changed_by: (req as unknown as { user?: { email?: string } }).user?.email || 'api',
      changed_at: now,
      old_data: oldData,
    })

    const updates: Record<string, unknown> = {
      ...req.body,
      updated_at: now,
    }
    if (updates.rate != null) updates.rate = parseFloat(String(updates.rate))
    delete updates.grid_id
    delete updates.created_at

    const bridgeResult = await writeThroughBridge('comp_grids', 'update', id, updates)
    if (!bridgeResult.success) await docRef.update(updates)

    const updated = await docRef.get()
    res.json(successResponse<unknown>(stripInternalFields({ id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/cam/comp-grids/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/comp-grids/history — Grid change audit trail
 */
camRoutes.get('/comp-grids/history', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('comp_grid_history')

    if (req.query.grid_id) query = query.where('grid_id', '==', req.query.grid_id)

    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'changed_at'
    const result = await paginatedQuery(query, 'comp_grid_history', params)
    res.json(successResponse<unknown>(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/cam/comp-grids/history error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// AGENT COMMISSION (Sprint 6)
// ============================================================================

/**
 * GET /api/cam/agent/:agentId/commission — Agent's full commission history
 */
camRoutes.get('/agent/:agentId/commission', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const agentId = param(req.params.agentId)

    const snap = await db.collection('revenue')
      .where('agent_id', '==', agentId)
      .orderBy('created_at', 'desc')
      .limit(200)
      .get()

    let totalFYC = 0
    let totalRenewal = 0
    let totalOverride = 0
    const records = snap.docs.map((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const rType = String(d.revenue_type || '').toLowerCase()
      if (rType.includes('fyc') || rType.includes('first')) totalFYC += amount
      else if (rType.includes('renewal') || rType.includes('ren')) totalRenewal += amount
      else if (rType.includes('override') || rType.includes('ovr')) totalOverride += amount

      return stripInternalFields({
        id: doc.id,
        ...d,
        amount,
      } as Record<string, unknown>)
    })

    res.json(successResponse<unknown>({
      agent_id: agentId,
      records,
      totals: {
        fyc: Math.round(totalFYC * 100) / 100,
        renewal: Math.round(totalRenewal * 100) / 100,
        override: Math.round(totalOverride * 100) / 100,
        total: Math.round((totalFYC + totalRenewal + totalOverride) * 100) / 100,
      },
      record_count: records.length,
    }))
  } catch (err) {
    console.error('GET /api/cam/agent/:agentId/commission error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/agent/:agentId/statement — Generate commission statement
 * Query params: period (YYYY-MM), type (monthly|quarterly)
 */
camRoutes.get('/agent/:agentId/statement', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const agentId = param(req.params.agentId)
    const period = req.query.period as string || new Date().toISOString().slice(0, 7)

    // Get agent info
    const agentSnap = await db.collection('agents').where('agent_id', '==', agentId).limit(1).get()
    const agentData = agentSnap.empty ? null : agentSnap.docs[0].data()

    // Get revenue for this period
    const revSnap = await db.collection('revenue')
      .where('agent_id', '==', agentId)
      .where('period', '==', period)
      .get()

    const lineItems = revSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        revenue_id: doc.id,
        carrier: d.carrier || d.carrier_name || '',
        product_type: d.product_type || '',
        revenue_type: d.revenue_type || '',
        amount: parseFloat(String(d.amount)) || 0,
        policy_number: d.policy_number || '',
      }
    })

    const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0)

    res.json(successResponse<unknown>({
      statement: {
        agent_id: agentId,
        agent_name: agentData ? `${agentData.first_name || ''} ${agentData.last_name || ''}`.trim() : agentId,
        period,
        generated_at: new Date().toISOString(),
        line_items: lineItems,
        total: Math.round(totalAmount * 100) / 100,
        line_item_count: lineItems.length,
      },
    }))
  } catch (err) {
    console.error('GET /api/cam/agent/:agentId/statement error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/cam/agent/:agentId/override — Calculate override commissions for downline
 * Body: { downline_agent_ids: string[], period? }
 */
camRoutes.post('/agent/:agentId/override', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const agentId = param(req.params.agentId)
    const { downline_agent_ids, period } = req.body

    if (!downline_agent_ids || !Array.isArray(downline_agent_ids)) {
      res.status(400).json(errorResponse('downline_agent_ids array is required'))
      return
    }

    const overrides: Record<string, unknown>[] = []
    let totalOverride = 0
    const overrideRate = parseFloat(String(req.body.override_rate || 0.03))

    for (const dlAgentId of downline_agent_ids.slice(0, 20)) {
      let query: Query<DocumentData> = db.collection('revenue').where('agent_id', '==', dlAgentId)
      if (period) query = query.where('period', '==', period)

      const snap = await query.get()
      let dlTotal = 0
      snap.docs.forEach((doc) => {
        dlTotal += parseFloat(String(doc.data().amount)) || 0
      })

      const overrideAmount = calculateOverride(dlTotal, overrideRate)
      totalOverride += overrideAmount

      overrides.push({
        downline_agent_id: dlAgentId,
        downline_revenue: Math.round(dlTotal * 100) / 100,
        override_rate: overrideRate,
        override_amount: overrideAmount,
      })
    }

    res.json(successResponse<unknown>({
      agent_id: agentId,
      period: period || 'all',
      override_rate: overrideRate,
      overrides,
      total_override: Math.round(totalOverride * 100) / 100,
    }))
  } catch (err) {
    console.error('POST /api/cam/agent/:agentId/override error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ANALYTICS (Sprint 6)
// ============================================================================

/**
 * GET /api/cam/analytics/retention — Revenue retention rate (renewals vs lapses)
 */
camRoutes.get('/analytics/retention', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('revenue').get()

    let totalRenewal = 0
    let totalLapsed = 0
    let totalActive = 0

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const status = String(d.status || d.policy_status || '').toLowerCase()
      const rType = String(d.revenue_type || '').toLowerCase()

      if (rType.includes('renewal') || rType.includes('ren')) {
        totalRenewal += amount
        totalActive += amount
      } else if (status === 'lapsed' || status === 'cancelled') {
        totalLapsed += amount
      } else {
        totalActive += amount
      }
    })

    const totalBase = totalActive + totalLapsed
    const retentionRate = totalBase > 0 ? Math.round((totalActive / totalBase) * 10000) / 100 : 100
    const lapseRate = totalBase > 0 ? Math.round((totalLapsed / totalBase) * 10000) / 100 : 0

    res.json(successResponse<unknown>({
      retention_rate: retentionRate,
      lapse_rate: lapseRate,
      active_revenue: Math.round(totalActive * 100) / 100,
      renewal_revenue: Math.round(totalRenewal * 100) / 100,
      lapsed_revenue: Math.round(totalLapsed * 100) / 100,
      total_base: Math.round(totalBase * 100) / 100,
    }))
  } catch (err) {
    console.error('GET /api/cam/analytics/retention error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/analytics/seasonal — Seasonal revenue patterns
 */
camRoutes.get('/analytics/seasonal', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection('revenue').get()

    const byMonth: Record<number, { total: number; count: number }> = {}
    for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, count: 0 }

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const dateStr = String(d.created_at || d.payment_date || '')
      const month = parseInt(dateStr.slice(5, 7))
      if (month >= 1 && month <= 12) {
        byMonth[month].total += amount
        byMonth[month].count += 1
      }
    })

    const months = Object.entries(byMonth).map(([m, data]) => ({
      month: parseInt(m),
      month_name: new Date(2026, parseInt(m) - 1).toLocaleString('en-US', { month: 'short' }),
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      avg: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
    }))

    const avgMonthly = months.reduce((s, m) => s + m.total, 0) / 12
    const peakMonth = months.reduce((best, m) => m.total > best.total ? m : best, months[0])

    res.json(successResponse<unknown>({
      months,
      avg_monthly: Math.round(avgMonthly * 100) / 100,
      peak_month: peakMonth.month_name,
      peak_revenue: peakMonth.total,
    }))
  } catch (err) {
    console.error('GET /api/cam/analytics/seasonal error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/cam/analytics/carrier-rank — Carrier ranking by total commission paid
 */
camRoutes.get('/analytics/carrier-rank', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('revenue')
    if (req.query.period) query = query.where('period', '==', req.query.period)

    const snap = await query.get()
    const carriers: Record<string, { carrier: string; fyc: number; renewal: number; total: number; policy_count: number }> = {}

    snap.docs.forEach((doc) => {
      const d = doc.data()
      const amount = parseFloat(String(d.amount)) || 0
      const carrier = String(d.carrier || d.carrier_name || 'Unknown')
      const rType = String(d.revenue_type || '').toLowerCase()

      if (!carriers[carrier]) carriers[carrier] = { carrier, fyc: 0, renewal: 0, total: 0, policy_count: 0 }
      carriers[carrier].total += amount
      carriers[carrier].policy_count += 1

      if (rType.includes('fyc') || rType.includes('first')) carriers[carrier].fyc += amount
      else if (rType.includes('renewal') || rType.includes('ren')) carriers[carrier].renewal += amount
    })

    const ranked = Object.values(carriers)
      .map((c) => ({
        ...c,
        fyc: Math.round(c.fyc * 100) / 100,
        renewal: Math.round(c.renewal * 100) / 100,
        total: Math.round(c.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total)

    res.json(successResponse<unknown>(ranked, { pagination: { count: ranked.length, total: ranked.length } }))
  } catch (err) {
    console.error('GET /api/cam/analytics/carrier-rank error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
