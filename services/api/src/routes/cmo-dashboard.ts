/**
 * CMO Dashboard API Route (MUS-D15)
 *
 * GET /dashboard — aggregated live data for MUSASHI Command Center.
 * Inventory counts, parity gaps, brand compliance, campaign calendar, artisan health.
 *
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import { Router, type Request, type Response } from 'express'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import {
  CMO_ARTISANS,
  generateParityMap,
  generateCampaignCalendar,
  type CmoArtisanHealth,
  type CmoParityGap,
  type CmoCalendarEntry,
} from '@tomachina/core'

export const cmoDashboardRoutes = Router()

// ── Types for dashboard response ─────────────────────────────────────────

interface CmoDashboardInventory {
  canva: { total: number; stale: number }
  drive: { total: number; stale: number }
  wordpress: { total: number; gaps: number }
  c3: { total: number; stale: number }
}

interface CmoDashboardCompliance {
  passed7d: number
  failed7d: number
  lastViolation?: { assetType: string; artisan: string; checkedAt: string }
}

interface CmoDashboardData {
  inventory: CmoDashboardInventory
  parity: CmoParityGap[]
  compliance: CmoDashboardCompliance
  calendar: CmoCalendarEntry[]
  artisans: CmoArtisanHealth[]
}

// ── GET /dashboard ──────────────────────────────────���───────────────────

cmoDashboardRoutes.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    // Inventory counts — in production these come from cached scanner results.
    // For now return structure with zero counts until scanners are wired live.
    const inventory: CmoDashboardInventory = {
      canva: { total: 0, stale: 0 },
      drive: { total: 0, stale: 0 },
      wordpress: { total: 0, gaps: 0 },
      c3: { total: 0, stale: 0 },
    }

    // Parity gaps — from an empty inventory returns empty
    const parity = generateParityMap([])

    // Compliance — in production reads from compliance log collection
    const compliance: CmoDashboardCompliance = {
      passed7d: 0,
      failed7d: 0,
    }

    // Campaign calendar — next 30 days
    const now = new Date()
    const calendarResult = await generateCampaignCalendar(now)
    const thirtyDaysFromNow = new Date(now)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const calendarNext30 = calendarResult.entries.filter(
      (e) => e.scheduledDate <= thirtyDaysFromNow,
    )

    // Artisan health — derive from static config
    const artisans: CmoArtisanHealth[] = CMO_ARTISANS.map((a) => ({
      artisanId: a.id,
      status: a.status,
      lastExecutedAt: undefined,
      lastResult: undefined,
      errorMessage: undefined,
    }))

    const data: CmoDashboardData = {
      inventory,
      parity,
      compliance,
      calendar: calendarNext30,
      artisans,
    }

    res.json(successResponse(data))
  } catch (err) {
    console.error('[MUSASHI] Dashboard error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
