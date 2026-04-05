/**
 * CMO Wire API Routes (MUS-O05)
 *
 * REST endpoints for triggering CMO wire execution:
 *   POST /wires/brochure      → WIRE_BROCHURE
 *   POST /wires/campaign      → WIRE_CAMPAIGN
 *   POST /wires/landing-page  → WIRE_LANDING_PAGE
 *
 * All routes gated by Firebase Auth middleware (applied at /api prefix).
 */
import { Router, type Request, type Response } from 'express'
import {
  successResponse,
  errorResponse,
  validateRequired,
} from '../lib/helpers.js'
import {
  executeWire,
  WIRE_BROCHURE,
  WIRE_CAMPAIGN,
  WIRE_LANDING_PAGE,
  createBrochureRunner,
  createCampaignRunner,
  createLandingPageRunner,
} from '@tomachina/core'

export const cmoWireRoutes = Router()

/**
 * Stub MCP call — in production, this would call actual MCP tools.
 * Wired to real MCP tools when running on Cloud Run with MCP servers available.
 */
async function mcpCall(tool: string, params: Record<string, unknown>): Promise<unknown> {
  console.log(`[MUSASHI][MCP] calling ${tool}`)
  // MCP calls are handled by the VOLTRON agent layer or direct MCP client.
  // This stub returns a structured response for the wire executor to process.
  // In production: replace with actual MCP client call.
  return { tool, params, stub: true }
}

/**
 * Internal API call — calls toMachina API routes directly via fetch.
 */
async function apiCall(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 8080}`
  console.log(`[MUSASHI][API] ${method} ${path}`)
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// ─── POST /wires/brochure ───────────────────────────────────────────────────

cmoWireRoutes.post('/wires/brochure', async (req: Request, res: Response) => {
  try {
    const validation = validateRequired(req.body as Record<string, unknown>, ['market', 'product', 'target', 'tone'])
    if (validation) {
      res.status(400).json(errorResponse(validation))
      return
    }

    const toolRunner = createBrochureRunner(mcpCall, apiCall)
    const result = await executeWire(WIRE_BROCHURE, req.body as Record<string, unknown>, toolRunner)

    if (result.success) {
      res.json(successResponse(result))
    } else {
      res.status(422).json({
        success: false,
        error: `Wire halted at ${result.haltedAt}: ${result.error}`,
        data: result,
      })
    }
  } catch (err) {
    console.error('[MUSASHI] WIRE_BROCHURE error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})

// ─── POST /wires/campaign ──���─────────────────────────���──────────────────────

cmoWireRoutes.post('/wires/campaign', async (req: Request, res: Response) => {
  try {
    const validation = validateRequired(req.body as Record<string, unknown>, ['market', 'templateId', 'audience', 'schedule', 'sendChannels'])
    if (validation) {
      res.status(400).json(errorResponse(validation))
      return
    }

    const toolRunner = createCampaignRunner(apiCall)
    const result = await executeWire(WIRE_CAMPAIGN, req.body as Record<string, unknown>, toolRunner)

    if (result.success) {
      res.json(successResponse(result))
    } else {
      res.status(422).json({
        success: false,
        error: `Wire halted at ${result.haltedAt}: ${result.error}`,
        data: result,
      })
    }
  } catch (err) {
    console.error('[MUSASHI] WIRE_CAMPAIGN error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})

// ─── POST /wires/landing-page ───────────────────────────────────────────────

cmoWireRoutes.post('/wires/landing-page', async (req: Request, res: Response) => {
  try {
    const validation = validateRequired(req.body as Record<string, unknown>, ['market', 'purpose', 'content', 'slug'])
    if (validation) {
      res.status(400).json(errorResponse(validation))
      return
    }

    const toolRunner = createLandingPageRunner(mcpCall)
    const result = await executeWire(WIRE_LANDING_PAGE, req.body as Record<string, unknown>, toolRunner)

    if (result.success) {
      res.json(successResponse(result))
    } else {
      res.status(422).json({
        success: false,
        error: `Wire halted at ${result.haltedAt}: ${result.error}`,
        data: result,
      })
    }
  } catch (err) {
    console.error('[MUSASHI] WIRE_LANDING_PAGE error:', (err as Error).message)
    res.status(500).json(errorResponse('Internal error'))
  }
})
